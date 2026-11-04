import {
  portfolio,
  line,
  optimize,
  defaults,
  validRate,
  discountFor,
  minimums,
  type SKU,
  type Priority,
  type Discounts,
  type Assumptions,
} from "./engine";
import { records } from "./csv";
export interface PromotionRule extends Priority {
  exact?: number;
  max?: number;
}
export const initialGoal = (skus: SKU[]) =>
  Math.max(0, portfolio(skus).contribution * 0.5);
export function profitStatus(profit: number, goal: number, buffer = 0) {
  return profit < -1e-7
    ? "Losing Money"
    : profit < goal + buffer - 1e-7
      ? "Profit Goal at Risk"
      : "Profitable Plan";
}
export function prepareRules(skus: SKU[], rules: PromotionRule[]) {
  const errors: string[] = [],
    byId = new Map<string, PromotionRule>();
  const ids = new Set(skus.map((s) => s.id));
  for (const r of rules) {
    if (!ids.has(r.id)) errors.push(`Unknown product ${r.id}`);
    if (byId.has(r.id)) errors.push(`Duplicate product rule ${r.id}`);
    byId.set(r.id, r);
    for (const key of ["min", "max", "exact", "preferred"] as const)
      if (r[key] !== undefined && !validRate(r[key]!))
        errors.push(`${r.id}: ${key} discount must be 0–100%.`);
  }
  const bounded = skus.map((s) => {
    const r = byId.get(s.id);
    let min = Math.max(s.min, r?.min ?? 0),
      max = Math.min(s.max, r?.max ?? 1);
    if (r?.exact !== undefined) {
      min = Math.max(min, r.exact);
      max = Math.min(max, r.exact);
    }
    if (s.priority === "P1") max = Math.min(max, min);
    if (min > max)
      errors.push(
        `${s.id}: required and maximum/exact discounts conflict with product-file rules.`,
      );
    return { ...s, min, max };
  });
  return { skus: bounded, errors };
}
export function optimizeCampaign(
  skus: SKU[],
  goal: number,
  rules: PromotionRule[],
  a: Assumptions,
  objective: "profit" | "discount",
) {
  const prepared = prepareRules(skus, rules);
  if (prepared.errors.length)
    return {
      feasible: false,
      errors: prepared.errors,
      discounts: minimums(skus),
      points: [],
      preferredWarnings: [],
    };
  return optimize(
    prepared.skus,
    goal,
    rules.map((r) => ({ id: r.id, min: 0, preferred: r.preferred })),
    a,
    objective,
  );
}
export function improvePlan(
  skus: SKU[],
  current: Discounts,
  rules: PromotionRule[],
  goal: number,
  buffer = 0,
  a: Assumptions = defaults,
) {
  if (!Number.isFinite(goal) || !Number.isFinite(buffer) || buffer < 0)
    throw Error("Use a finite profit goal and a nonnegative safety buffer.");
  const prepared = prepareRules(skus, rules),
    errors = [...prepared.errors];
  if (errors.length)
    return {
      feasible: false,
      errors,
      discounts: null,
      changes: [],
      preferredWarnings: [],
    };
  const target = goal + buffer;
  if (!Number.isFinite(target))
    throw Error("Profit goal plus buffer is too large.");
  const bounded = prepared.skus,
    ds: Discounts = Object.fromEntries(
      bounded.map((s) => [
        s.id,
        Math.min(s.max, Math.max(s.min, discountFor(current, s.id) ?? 0)),
      ]),
    );
  const best = portfolio(bounded, minimums(bounded), a).contribution;
  if (best < target - 1e-7)
    return {
      feasible: false,
      errors: [
        `Your discount goals can't all be met. Keeping required offers leaves at most $${best.toFixed(2)} after variable costs; your goal plus buffer is $${target.toFixed(2)}.`,
      ],
      discounts: null,
      changes: [],
      preferredWarnings: [],
    };
  const ruleMap = new Map(rules.map((r) => [r.id, r]));
  const ordered = bounded
    .map((s) => ({
      s,
      loss: line(s, 0, a).contribution - line(s, 1, a).contribution,
    }))
    .sort(
      (x, y) =>
        Number(ruleMap.has(x.s.id)) - Number(ruleMap.has(y.s.id)) ||
        y.loss - x.loss ||
        (x.s.id < y.s.id ? -1 : x.s.id > y.s.id ? 1 : 0),
    );
  let shortfall = Math.max(0, target - portfolio(skus, ds, a).contribution);
  // First retain soft preferences. Only sacrifice them if needed to meet the hard goal.
  for (const preservePreferred of [true, false])
    for (const { s, loss } of ordered) {
      const preferred = ruleMap.get(s.id)?.preferred ?? s.min;
      const lower = preservePreferred
        ? Math.max(s.min, Math.min(ds[s.id], preferred))
        : s.min;
      if (loss <= 0 || shortfall <= 1e-8) continue;
      const reduction = Math.min(ds[s.id] - lower, shortfall / loss);
      ds[s.id] -= Math.max(0, reduction);
      shortfall = Math.max(0, shortfall - reduction * loss);
    }
  const feasible = portfolio(skus, ds, a).contribution >= target - 1e-7;
  const changes = skus
    .filter(
      (s) => Math.abs(ds[s.id] - (discountFor(current, s.id) ?? 0)) > 1e-9,
    )
    .map((s) => ({
      id: s.id,
      before: discountFor(current, s.id) ?? 0,
      after: ds[s.id],
    }));
  const preferredWarnings = rules
    .filter((r) => r.preferred !== undefined && ds[r.id] < r.preferred - 1e-9)
    .map(
      (r) =>
        `${r.id}: preferred ${(r.preferred! * 100).toFixed(1)}% could not be kept. This is a non-guaranteed target.`,
    );
  return {
    feasible,
    errors: feasible ? [] : ["A safe recommendation could not be verified."],
    discounts: feasible ? ds : null,
    changes,
    preferredWarnings,
  };
}
export type WarningKind =
  | "Above maximum"
  | "Below minimum"
  | "Exact discount"
  | "Product-file locked offer"
  | "Profit goal"
  | "Product losing money"
  | "Missing costs or input assumptions"
  | "Conflicting rules"
  | "Preferred target";
export interface PlanWarning {
  kind: WarningKind;
  category: string;
  id?: string;
  message: string;
}
const friendlyFields: Record<string, string> = {
  Regular_Price_USD: "Selling price",
  Unit_COGS_USD: "Unit cost",
  Fulfillment_Cost_USD: "Fulfillment cost",
  Merchant_Shipping_USD: "Shipping cost",
  Payment_Fee_Rate: "Payment fee rate",
  Order_Fixed_Fee_Allocated_USD: "Fixed payment fee per unit",
  Expected_Return_Rate: "Expected return rate",
  Return_Cost_Per_Return_USD: "Cost per return",
  Other_Variable_Cost_USD: "Other variable costs",
  Locked_Min_Discount: "Required discount",
  Max_Discount: "Maximum discount",
  Step_Discount: "Reference discount step",
  Allocation_Weight: "Advanced recommendation priority",
};
export function friendlyAssumption(message: string) {
  for (const [key, label] of Object.entries(friendlyFields))
    message = message.replaceAll(key, label);
  return message.replace(
    "missing: using 0.",
    "not provided: counted as zero until you supply it.",
  );
}
export function planWarnings(
  skus: SKU[],
  ds: Discounts,
  rules: PromotionRule[],
  goal: number,
  buffer: number,
  a: Assumptions,
  assumptions: string[] = [],
) {
  const out: PlanWarning[] = [],
    prepared = prepareRules(skus, rules),
    byId = new Map(rules.map((r) => [r.id, r]));
  for (const message of prepared.errors)
    out.push({ kind: "Conflicting rules", category: "Campaign", message });
  for (const s of skus) {
    const r = byId.get(s.id),
      d = discountFor(ds, s.id) ?? 0,
      min = Math.max(s.min, r?.min ?? 0),
      max = Math.min(s.max, r?.max ?? 1);
    const add = (kind: WarningKind, message: string) =>
      out.push({ kind, category: s.category, id: s.id, message });
    if (d > max + 1e-9)
      add(
        "Above maximum",
        `Discount ${(d * 100).toFixed(1)}% exceeds allowed ${(max * 100).toFixed(1)}%.`,
      );
    if (d < min - 1e-9)
      add(
        "Below minimum",
        `Discount must be at least ${(min * 100).toFixed(1)}%.`,
      );
    if (r?.exact !== undefined && Math.abs(d - r.exact) > 1e-9)
      add(
        "Exact discount",
        `Keep the exact ${(r.exact * 100).toFixed(1)}% offer.`,
      );
    if (
      s.priority === "P1" &&
      Math.abs(d - Math.max(min, r?.exact ?? 0)) > 1e-9
    )
      add(
        "Product-file locked offer",
        `Product file locks this offer at its required discount during recommendations.`,
      );
    if (r?.preferred !== undefined && d < r.preferred - 1e-9)
      add(
        "Preferred target",
        `Preferred ${(r.preferred * 100).toFixed(1)}% is not reached (non-guaranteed).`,
      );
    if (line(s, d, a).contribution < 0)
      add(
        "Product losing money",
        "This product loses money after variable costs.",
      );
  }
  if (portfolio(skus, ds, a).contribution < goal + buffer - 1e-7)
    out.push({
      kind: "Profit goal",
      category: "Campaign",
      message: "Profit is below your minimum goal plus safety buffer.",
    });
  for (const message of assumptions)
    out.push({
      kind: "Missing costs or input assumptions",
      category: "Input review",
      message: friendlyAssumption(message),
    });
  return out;
}
export function groupWarnings(warnings: PlanWarning[]) {
  const groups = new Map<string, Map<string, PlanWarning[]>>();
  for (const w of warnings) {
    if (!groups.has(w.kind)) groups.set(w.kind, new Map());
    const cats = groups.get(w.kind)!;
    if (!cats.has(w.category)) cats.set(w.category, []);
    cats.get(w.category)!.push(w);
  }
  return groups;
}
export function parsePromotionCSV(csv: string, skus: SKU[]): PromotionRule[] {
  const rows = records(csv),
    ids = new Set(skus.map((s) => s.id)),
    seen = new Set<string>();
  const allowed = new Set([
    "SKU",
    "Minimum_Discount",
    "Maximum_Discount",
    "Exact_Discount",
    "Preferred_Discount",
  ]);
  for (const header of Object.keys(rows[0]))
    if (!allowed.has(header))
      throw Error(
        `Unknown must-promote column ${header}. Use the list template headers.`,
      );
  if (!Object.hasOwn(rows[0], "SKU"))
    throw Error("Must-promote CSV requires a SKU column.");
  return rows.map((r) => {
    if (!ids.has(r.SKU))
      throw Error(`Unknown product: ${r.SKU || "(empty SKU)"}`);
    if (seen.has(r.SKU)) throw Error(`Duplicate product: ${r.SKU}`);
    seen.add(r.SKU);
    const rule: PromotionRule = { id: r.SKU, min: 0 };
    let count = 0;
    for (const [field, column] of [
      ["min", "Minimum_Discount"],
      ["max", "Maximum_Discount"],
      ["exact", "Exact_Discount"],
      ["preferred", "Preferred_Discount"],
    ] as const) {
      if (r[column] === undefined || r[column] === "") continue;
      const value = /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(r[column])
        ? Number(r[column])
        : NaN;
      if (!validRate(value))
        throw Error(
          `${r.SKU}: ${column} must be a decimal from 0 to 1 (0.2 means 20%).`,
        );
      rule[field] = value;
      count++;
    }
    if (!count) throw Error(`${r.SKU}: provide at least one discount rule.`);
    return rule;
  });
}
export const promotionTemplate =
  "SKU,Minimum_Discount,Maximum_Discount,Exact_Discount,Preferred_Discount\nEXAMPLE-001,0.1,0.4,,0.2\n";
// A single straight adjustment path from the current plan to the suggested plan.
// Base-price sales weighting is fixed on both endpoints, so both axes interpolate linearly.
export function adjustmentPath(
  skus: SKU[],
  current: Discounts,
  suggested: Discounts,
  a: Assumptions,
  goal: number,
  buffer: number,
) {
  const denominator = skus.reduce(
    (t, s) => t + s.price * Math.min(s.units, s.inventory),
    0,
  );
  const average = (ds: Discounts) =>
    denominator
      ? skus.reduce(
          (t, s) =>
            t +
            s.price *
              Math.min(s.units, s.inventory) *
              (discountFor(ds, s.id) ?? 0),
          0,
        ) / denominator
      : 0;
  const start = {
      discount: average(current),
      profit: portfolio(skus, current, a).contribution,
    },
    end = {
      discount: average(suggested),
      profit: portfolio(skus, suggested, a).contribution,
    };
  const cross = (threshold: number) => {
    if (start.profit === end.profit) return null;
    const t = (threshold - start.profit) / (end.profit - start.profit);
    return t >= 0 && t <= 1
      ? {
          discount: start.discount + t * (end.discount - start.discount),
          profit: threshold,
        }
      : null;
  };
  return {
    start,
    end,
    zero: cross(0),
    goal: cross(goal),
    buffer: cross(goal + buffer),
    hasSales: denominator > 0,
  };
}
