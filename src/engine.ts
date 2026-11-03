export interface SKU {
  id: string;
  name: string;
  category: string;
  priority: string;
  price: number;
  cost: number;
  fulfillment: number;
  shipping: number;
  units: number;
  inventory: number;
  min: number;
  max: number;
  step: number;
  feeRate: number;
  fixedFee: number;
  returnRate: number;
  returnCost: number;
  weight: number;
  extraCost: number;
}
export interface Assumptions {
  stack: number;
  shipping: number;
  returns: number;
}
export const defaults: Assumptions = { stack: 0, shipping: 0, returns: 0 };
export type Discounts = Record<string, number>;
export const discountFor = (
  values: Discounts,
  key: string,
): number | undefined => (Object.hasOwn(values, key) ? values[key] : undefined);
export interface Priority {
  id: string;
  min: number;
  preferred?: number;
}
export interface Line {
  sku: SKU;
  discount: number;
  units: number;
  revenue: number;
  gross: number;
  contribution: number;
  margin: number | null;
}
export const validRate = (n: number) => Number.isFinite(n) && n >= 0 && n <= 1;
export function validateSKU(s: SKU): string[] {
  const errors: string[] = [];
  for (const k of [
    "price",
    "cost",
    "fulfillment",
    "shipping",
    "units",
    "inventory",
    "fixedFee",
    "returnCost",
    "weight",
    "extraCost",
  ] as const)
    if (!Number.isFinite(s[k]) || s[k] < 0)
      errors.push(`${s.id}: ${k} must be finite and nonnegative`);
  for (const k of ["min", "max", "feeRate", "returnRate"] as const)
    if (!validRate(s[k])) errors.push(`${s.id}: ${k} must be between 0 and 1`);
  if (!Number.isFinite(s.step) || s.step <= 0 || s.step > 1)
    errors.push(`${s.id}: step must be greater than 0 and at most 1`);
  if (s.min > s.max) errors.push(`${s.id}: minimum exceeds maximum discount`);
  if (!s.id.trim()) errors.push("SKU is required");
  return errors;
}
export function validateAssumptions(a: Assumptions) {
  if (
    !validRate(a.stack) ||
    !validRate(a.returns) ||
    !Number.isFinite(a.shipping) ||
    a.shipping < 0
  )
    throw Error("Invalid stress assumptions");
}
export function line(s: SKU, d = 0, a: Assumptions = defaults): Line {
  const errors = validateSKU(s);
  if (errors.length) throw Error(errors.join("; "));
  if (!validRate(d)) throw Error(`${s.id}: invalid discount`);
  validateAssumptions(a);
  if (s.returnRate + a.returns > 1)
    throw Error(`${s.id}: combined return rate exceeds 100%`);
  const units = Math.min(s.units, s.inventory),
    revenue = s.price * (1 - d) * (1 - a.stack) * units;
  const gross = revenue - s.cost * units;
  const contribution =
    gross -
    revenue * s.feeRate -
    units *
      (s.fixedFee +
        s.fulfillment +
        s.shipping +
        a.shipping +
        s.extraCost +
        (s.returnRate + a.returns) * s.returnCost);
  if (!Number.isFinite(revenue) || !Number.isFinite(contribution))
    throw Error("Financial inputs overflow; reduce their size");
  return {
    sku: s,
    discount: d,
    units,
    revenue,
    gross,
    contribution,
    margin: revenue ? gross / revenue : null,
  };
}
export function portfolio(
  skus: SKU[],
  discounts: Discounts = {},
  a: Assumptions = defaults,
) {
  const lines = skus.map((s) => line(s, discountFor(discounts, s.id) ?? 0, a));
  const revenue = lines.reduce((t, x) => t + x.revenue, 0),
    gross = lines.reduce((t, x) => t + x.gross, 0),
    contribution = lines.reduce((t, x) => t + x.contribution, 0);
  if (![revenue, gross, contribution].every(Number.isFinite))
    throw Error("Portfolio totals overflow");
  return {
    lines,
    revenue,
    gross,
    contribution,
    grossMargin: revenue ? gross / revenue : null,
    contributionMargin: revenue ? contribution / revenue : null,
    negative: lines.filter((x) => x.contribution < 0).length,
  };
}
export const minimums = (skus: SKU[]): Discounts =>
  Object.fromEntries(skus.map((s) => [s.id, s.min]));
export function scenario(
  skus: SKU[],
  uniform: number,
  categories: Discounts = {},
  overrides: Discounts = {},
): Discounts {
  return Object.fromEntries(
    skus.map((s) => [
      s.id,
      discountFor(overrides, s.id) ??
        discountFor(categories, s.category) ??
        uniform,
    ]),
  );
}
export function constraintErrors(
  skus: SKU[],
  ds: Discounts,
  priorities: Priority[] = [],
) {
  const errors: string[] = [];
  for (const p of priorities) {
    const s = skus.find((s) => s.id === p.id);
    if (!s) errors.push(`Unknown priority SKU: ${p.id}`);
    if (
      !validRate(p.min) ||
      (p.preferred !== undefined &&
        (!validRate(p.preferred) || p.preferred < p.min))
    )
      errors.push(`${p.id}: invalid priority discounts`);
  }
  for (const s of skus) {
    const d = discountFor(ds, s.id) ?? 0,
      min = Math.max(
        s.min,
        ...priorities.filter((p) => p.id === s.id).map((p) => p.min),
      );
    if (!validRate(d) || d < min - 1e-9 || d > s.max + 1e-9)
      errors.push(
        `${s.id}: discount must be ${(min * 100).toFixed(1)}–${s.max * 100}%`,
      );
  }
  return errors;
}
export interface Point {
  step: number;
  id: string;
  discount: number;
  contribution: number;
  belowFloor: boolean;
  negative: boolean;
}
// Continuous fractional knapsack: each discount fraction consumes a constant amount of contribution.
// Objective sum(weight * discount); a SKU is divisible, so descending weight / loss is exact.
export function optimize(
  skus: SKU[],
  floor: number,
  priorities: Priority[] = [],
  a: Assumptions = defaults,
  objective: "discount" | "profit" = "discount",
) {
  if (!Number.isFinite(floor)) throw Error("Profit floor must be finite");
  const ds = minimums(skus);
  for (const p of priorities)
    if (p.id in ds) ds[p.id] = Math.max(ds[p.id], p.min);
  const errors = constraintErrors(skus, ds, priorities);
  if (errors.length)
    return {
      feasible: false,
      errors,
      discounts: ds,
      points: [] as Point[],
      preferredWarnings: [] as string[],
    };
  const start = portfolio(skus, ds, a).contribution;
  if (start < floor - 1e-7)
    return {
      feasible: false,
      errors: [
        `Required discounts yield ${start.toFixed(2)}, below the ${floor.toFixed(2)} contribution floor. No feasible allocation exists.`,
      ],
      discounts: ds,
      points: [] as Point[],
      preferredWarnings: [] as string[],
    };
  const ordered = skus
    .map((s) => ({
      s,
      loss:
        s.price *
        Math.min(s.units, s.inventory) *
        (1 - a.stack) *
        (1 - s.feeRate),
    }))
    .filter(({ s }) => s.priority !== "P1" && s.weight > 0 && s.max > ds[s.id])
    .sort(
      (x, y) =>
        (y.loss === 0 ? Infinity : y.s.weight / y.loss) -
          (x.loss === 0 ? Infinity : x.s.weight / x.loss) ||
        (x.s.id < y.s.id ? -1 : x.s.id > y.s.id ? 1 : 0),
    );
  let running = start;
  const points: Point[] = [
    {
      step: 0,
      id: "Required discounts",
      discount: 0,
      contribution: start,
      belowFloor: start < floor,
      negative: start < 0,
    },
  ];
  // Frontier continues to every cap even after floor breach. Optimized allocation stops at the floor.
  for (const { s, loss } of ordered) {
    const initial = ds[s.id],
      capacity = s.max - initial;
    running -= loss * capacity;
    points.push({
      step: points.length,
      id: s.id,
      discount: s.max,
      contribution: running,
      belowFloor: running < floor - 1e-7,
      negative: running < 0,
    });
  }
  if (objective === "discount") {
    let budget = Math.max(0, start - floor);
    for (const { s, loss } of ordered) {
      const delta =
        loss === 0
          ? s.max - ds[s.id]
          : Math.min(s.max - ds[s.id], budget / loss);
      ds[s.id] += Math.max(0, delta);
      budget = Math.max(0, budget - loss * delta);
    }
  }
  const preferredWarnings = priorities
    .filter(
      (p) => p.preferred !== undefined && (ds[p.id] ?? 0) < p.preferred! - 1e-8,
    )
    .map(
      (p) =>
        `${p.id}: preferred ${(p.preferred! * 100).toFixed(1)}% not reached (soft target; only minimum is guaranteed).`,
    );
  return { feasible: true, errors, discounts: ds, points, preferredWarnings };
}
export function crossing(points: Point[], threshold: number) {
  if (!points.length) return null;
  if (points[0].contribution < threshold) return 0;
  for (let i = 1; i < points.length; i++)
    if (points[i].contribution < threshold) {
      const prev = points[i - 1].contribution;
      return i - 1 + (prev - threshold) / (prev - points[i].contribution);
    }
  return null;
}
