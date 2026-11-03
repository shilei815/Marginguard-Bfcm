import {
  portfolio,
  line,
  minimums,
  discountFor,
  validRate,
  defaults,
  optimize,
  type SKU,
  type Discounts,
  type Assumptions,
} from "./engine";
import {
  prepareRules,
  improvePlan,
  planWarnings,
  type PromotionRule,
  type PlanWarning,
} from "./planner";
import { records, exportCSV } from "./csv";
export type MerchantTier = 1 | 2 | 3;
export interface TierOffer {
  target: number;
  min: number;
  max: number;
}
export interface TierAssignment {
  tier: MerchantTier;
  target?: number;
  min?: number;
  max?: number;
}
export interface TierState {
  defaults: Record<MerchantTier, TierOffer>;
  assignments: Record<string, TierAssignment>;
}
export const tierNumbers: MerchantTier[] = [1, 2, 3];
export const tierLabels: Record<MerchantTier, string> = {
  1: "Must Promote — Tier 1",
  2: "Important — Tier 2",
  3: "Flexible — Tier 3",
};
export const emptyTiers = (): TierState => ({
  defaults: {
    1: { target: 0, min: 0, max: 1 },
    2: { target: 0, min: 0, max: 1 },
    3: { target: 0, min: 0, max: 1 },
  },
  assignments: {},
});
export const assignmentFor = (state: TierState, id: string) =>
  Object.hasOwn(state.assignments, id) ? state.assignments[id] : undefined;
export function effectiveTier(state: TierState, id: string) {
  const assignment = assignmentFor(state, id);
  return assignment
    ? ({
        ...state.defaults[assignment.tier],
        ...Object.fromEntries(
          Object.entries(assignment).filter(([, v]) => v !== undefined),
        ),
      } as TierOffer & { tier: MerchantTier })
    : undefined;
}
export function tierOfferErrors(offer: TierOffer, label: string) {
  const errors: string[] = [];
  for (const k of ["target", "min", "max"] as const)
    if (!validRate(offer[k]))
      errors.push(`${label}: ${k} must be a decimal from 0 to 1.`);
  if (offer.min > offer.max)
    errors.push(`${label}: minimum discount exceeds maximum.`);
  if (offer.target < offer.min || offer.target > offer.max)
    errors.push(
      `${label}: target must be between its tier minimum and maximum.`,
    );
  return errors;
}
export function assignTier(
  state: TierState,
  ids: string[],
  tier: MerchantTier | null,
): TierState {
  const assignments = { ...state.assignments };
  for (const id of ids) {
    if (tier === null) delete assignments[id];
    else assignments[id] = { ...(assignmentFor(state, id) ?? {}), tier };
  }
  return { ...state, assignments };
}
export function resolveTiers(
  skus: SKU[],
  rules: PromotionRule[],
  state: TierState,
) {
  const errors: string[] = [],
    ids = new Set(skus.map((s) => s.id)),
    base = prepareRules(skus, rules),
    byRule = new Map(rules.map((r) => [r.id, r]));
  errors.push(...base.errors);
  for (const [id, entry] of Object.entries(state.assignments)) {
    if (!ids.has(id)) errors.push(`Unknown tier product ${id}`);
    if (!tierNumbers.includes(entry.tier))
      errors.push(`${id}: tier must be 1, 2, or 3.`);
  }
  const combined = skus.flatMap((s): PromotionRule[] => {
    const r = byRule.get(s.id),
      entry = assignmentFor(state, s.id);
    if (!entry || !tierNumbers.includes(entry.tier)) return r ? [r] : [];
    const offer = effectiveTier(state, s.id)!;
    errors.push(...tierOfferErrors(offer, s.id));
    return [
      {
        ...r,
        id: s.id,
        min: Math.max(r?.min ?? 0, offer.min),
        max: Math.min(r?.max ?? 1, offer.max),
        preferred: r?.preferred ?? offer.target,
      },
    ];
  });
  const bounded = prepareRules(skus, combined);
  errors.push(...bounded.errors);
  const uniqueErrors = [...new Set(errors)];
  const softWarnings: PlanWarning[] = [],
    boundMap = new Map(bounded.skus.map((s) => [s.id, s]));
  for (const s of skus) {
    const offer = effectiveTier(state, s.id),
      bound = boundMap.get(s.id);
    if (
      offer &&
      bound &&
      validRate(offer.target) &&
      offer.target > bound.max + 1e-9
    )
      softWarnings.push({
        kind: "Preferred target",
        category: s.category,
        id: s.id,
        message: `Tier ${offer.tier} target ${(offer.target * 100).toFixed(1)}% exceeds the effective hard maximum ${(bound.max * 100).toFixed(1)}%. The hard rule is kept; this soft target cannot be reached.`,
      });
  }
  return {
    errors: uniqueErrors,
    skus: bounded.skus,
    rules: combined,
    softWarnings,
  };
}
export function verifyTierPlan(
  skus: SKU[],
  ds: Discounts,
  rules: PromotionRule[],
  state: TierState,
  goal: number,
  buffer: number,
  a: Assumptions,
) {
  const resolved = resolveTiers(skus, rules, state),
    errors = [...resolved.errors];
  if (
    !Number.isFinite(goal) ||
    !Number.isFinite(buffer) ||
    buffer < 0 ||
    !Number.isFinite(goal + buffer)
  )
    errors.push(
      "Minimum profit goal and buffer must be finite; the buffer cannot be negative.",
    );
  for (const s of resolved.skus) {
    const d = discountFor(ds, s.id);
    if (
      d === undefined ||
      !validRate(d) ||
      d < s.min - 1e-9 ||
      d > s.max + 1e-9
    )
      errors.push(
        `${s.id}: suggested discount violates its effective hard bounds.`,
      );
  }
  let financials: ReturnType<typeof portfolio> | null = null;
  try {
    financials = portfolio(skus, ds, a);
    if (financials.contribution < goal + buffer - 1e-7)
      errors.push(
        "Suggested profit is below the minimum goal plus safety buffer.",
      );
  } catch (error) {
    errors.push(`Financial validation failed: ${(error as Error).message}`);
  }
  return { feasible: errors.length === 0, errors, financials };
}

function failed(errors: string[]) {
  return {
    feasible: false,
    errors,
    discounts: null,
    changes: [],
    preferredWarnings: [],
  } as ReturnType<typeof improvePlan>;
}
export function improveTierPlan(
  skus: SKU[],
  current: Discounts,
  rules: PromotionRule[],
  goal: number,
  buffer = 0,
  a: Assumptions = defaults,
  state: TierState = emptyTiers(),
): ReturnType<typeof improvePlan> {
  if (
    !Number.isFinite(goal) ||
    !Number.isFinite(buffer) ||
    buffer < 0 ||
    !Number.isFinite(goal + buffer)
  )
    throw Error("Use a finite profit goal and nonnegative safety buffer.");
  const resolved = resolveTiers(skus, rules, state);
  if (resolved.errors.length) return failed(resolved.errors);
  // Keep the prior policy exactly when merchant tiers have not been introduced.
  if (!Object.keys(state.assignments).length) {
    const legacy = improvePlan(skus, current, rules, goal, buffer, a);
    if (legacy.feasible && legacy.discounts) {
      const check = verifyTierPlan(
        skus,
        legacy.discounts,
        rules,
        state,
        goal,
        buffer,
        a,
      );
      if (!check.feasible) return failed(check.errors);
    }
    return legacy;
  }
  const bounded = resolved.skus,
    target = goal + buffer;
  const best = portfolio(skus, minimums(bounded), a).contribution;
  if (best < target - 1e-7)
    return failed([
      `Your discount goals can't all be met. Required offers leave at most $${best.toFixed(2)} after variable costs, below the goal plus buffer of $${target.toFixed(2)}.`,
    ]);
  const ds: Discounts = Object.fromEntries(
    bounded.map((s) => [
      s.id,
      Math.min(s.max, Math.max(s.min, discountFor(current, s.id) ?? 0)),
    ]),
  );
  const custom = new Set(rules.map((r) => r.id)),
    preferred = new Map(resolved.rules.map((r) => [r.id, r.preferred]));
  const ordered = bounded
    .map((s) => ({
      s,
      tier: assignmentFor(state, s.id)?.tier ?? 3,
      loss:
        s.price *
        Math.min(s.units, s.inventory) *
        (1 - a.stack) *
        (1 - s.feeRate),
    }))
    .sort(
      (x, y) =>
        Number(custom.has(x.s.id)) - Number(custom.has(y.s.id)) ||
        y.loss - x.loss ||
        (x.s.id < y.s.id ? -1 : x.s.id > y.s.id ? 1 : 0),
    );
  let shortfall = Math.max(0, target - portfolio(skus, ds, a).contribution);
  for (const tier of [3, 2, 1])
    for (const protectTarget of [true, false])
      for (const { s, loss, tier: rank } of ordered) {
        if (rank !== tier || loss <= 0 || shortfall <= 1e-8) continue;
        const soft = preferred.get(s.id) ?? s.min,
          lower = protectTarget
            ? Math.max(s.min, Math.min(ds[s.id], soft))
            : s.min;
        const delta = Math.max(0, Math.min(ds[s.id] - lower, shortfall / loss));
        ds[s.id] -= delta;
        shortfall = Math.max(0, shortfall - delta * loss);
      }
  // Independent full financial and per-product validation, not just budget arithmetic.
  const verified = verifyTierPlan(skus, ds, rules, state, goal, buffer, a);
  if (!verified.feasible) return failed(verified.errors);
  const changes = skus
    .filter(
      (s) => Math.abs(ds[s.id] - (discountFor(current, s.id) ?? 0)) > 1e-9,
    )
    .map((s) => ({
      id: s.id,
      before: discountFor(current, s.id) ?? 0,
      after: ds[s.id],
    }));
  const preferredWarnings = resolved.rules
    .filter((r) => r.preferred !== undefined && ds[r.id] < r.preferred - 1e-9)
    .map(
      (r) =>
        `${r.id}: preferred ${(r.preferred! * 100).toFixed(1)}% could not be kept. The profit goal and hard rules take precedence.`,
    );
  return {
    feasible: true,
    errors: [],
    discounts: ds,
    changes,
    preferredWarnings,
  };
}
export function optimizeTierCampaign(
  skus: SKU[],
  goal: number,
  rules: PromotionRule[],
  a: Assumptions,
  objective: "discount" | "profit",
  state: TierState,
) {
  const r = resolveTiers(skus, rules, state);
  if (r.errors.length)
    return {
      feasible: false,
      errors: r.errors,
      discounts: minimums(skus),
      points: [],
      preferredWarnings: [],
    };
  // Hard minima/exact/max rules are already encoded in the SKU bounds. Keeping
  // soft warnings outside the core avoids an unnecessary per-SKU rule scan.
  const result = optimize(r.skus, goal, [], a, objective);
  if (result.feasible)
    result.preferredWarnings = r.rules
      .filter(
        (p) =>
          p.preferred !== undefined &&
          result.discounts[p.id] < p.preferred - 1e-8,
      )
      .map(
        (p) =>
          `${p.id}: preferred ${(p.preferred! * 100).toFixed(1)}% not reached (soft target; only minimum is guaranteed).`,
      );
  if (result.feasible) {
    const check = verifyTierPlan(
      skus,
      result.discounts,
      rules,
      state,
      goal,
      0,
      a,
    );
    if (!check.feasible)
      return { ...result, feasible: false, errors: check.errors };
  }
  return result;
}
export function tierPlanWarnings(
  skus: SKU[],
  ds: Discounts,
  rules: PromotionRule[],
  state: TierState,
  goal: number,
  buffer: number,
  a: Assumptions,
  assumptions: string[] = [],
) {
  const resolved = resolveTiers(skus, rules, state);
  // Invalid tier configurations must remain reportable without entering financial functions with bad bounds.
  const normal = planWarnings(
    skus,
    ds,
    resolved.rules,
    goal,
    buffer,
    a,
    assumptions,
  );
  const explicitById = new Map(rules.map((r) => [r.id, r]));
  for (const product of skus) {
    const offer = effectiveTier(state, product.id),
      explicit = explicitById.get(product.id)?.preferred;
    if (
      offer &&
      explicit !== undefined &&
      Math.abs(explicit - offer.target) > 1e-9 &&
      (discountFor(ds, product.id) ?? 0) < offer.target - 1e-9
    )
      normal.push({
        kind: "Preferred target",
        id: product.id,
        category: product.category,
        message: `Tier ${offer.tier} target ${(offer.target * 100).toFixed(1)}% is not met. The explicit product preferred offer governs soft protection; neither soft target can override hard rules.`,
      });
  }
  const existing = new Set(normal.map((w) => w.message));
  return [
    ...normal,
    ...resolved.errors
      .filter((message) => !existing.has(message))
      .map((message) => ({
        kind: "Conflicting rules" as const,
        category: "Campaign",
        message,
      })),
    ...resolved.softWarnings,
  ];
}
export function tierReport(
  skus: SKU[],
  current: Discounts,
  suggested: Discounts | null,
  rules: PromotionRule[],
  state: TierState,
  goal: number,
  buffer: number,
  a: Assumptions,
) {
  const resolved = resolveTiers(skus, rules, state),
    bounds = new Map(resolved.skus.map((s) => [s.id, s])),
    ruleMap = new Map(rules.map((r) => [r.id, r]));
  const products = skus.map((s) => {
    const offer = effectiveTier(state, s.id),
      before = discountFor(current, s.id) ?? 0,
      after = suggested ? (discountFor(suggested, s.id) ?? 0) : null,
      b = bounds.get(s.id)!;
    const targetAchieved =
      offer && after !== null ? after >= offer.target - 1e-9 : null;
    let reason = "No change needed.";
    if (after === null) reason = "No feasible suggestion is available.";
    else if (after > before + 1e-9)
      reason = "Increased only to honor a hard minimum or exact offer.";
    else if (after < before - 1e-9) {
      if (before > b.max + 1e-9)
        reason = "Corrected an offer above its hard maximum or exact lock.";
      else
        reason = `Recovered profit from ${offer ? `Tier ${offer.tier}` : "Flexible / unassigned products"} to meet the goal plus buffer; Tier 3 is reduced before Tier 2, then Tier 1.`;
    }
    if (offer && !targetAchieved && after !== null) {
      if (offer.target > b.max + 1e-9)
        reason += " The target is above a hard cap or legacy file lock.";
      else if (before < offer.target - 1e-9)
        reason +=
          " The current offer was below target; soft targets are not automatically applied.";
      else
        reason +=
          " This soft target was relaxed because the hard profit goal takes precedence.";
    }
    const explicitPreferred = ruleMap.get(s.id)?.preferred;
    if (
      offer &&
      explicitPreferred !== undefined &&
      Math.abs(explicitPreferred - offer.target) > 1e-9
    )
      reason +=
        " An explicit product preferred offer overrides the tier target for protection ordering; the tier target is still reported separately.";
    return {
      id: s.id,
      category: s.category,
      tier: offer?.tier ?? null,
      target: offer?.target ?? null,
      effectivePreferred: explicitPreferred ?? offer?.target ?? null,
      min: b.min,
      max: b.max,
      current: before,
      suggested: after,
      targetAchieved,
      hardRulesMet:
        after === null || resolved.errors.length
          ? null
          : after >= b.min - 1e-9 && after <= b.max + 1e-9,
      reason,
    };
  });
  return {
    products,
    tiers: tierNumbers.map((tier) => {
      const items = products.filter((p) => p.tier === tier);
      return {
        tier,
        count: items.length,
        achieved: items.filter((p) => p.targetAchieved === true).length,
        currentAchieved: items.filter(
          (p) => p.target !== null && p.current >= p.target - 1e-9,
        ).length,
      };
    }),
    adjustedCount: products.filter(
      (p) => p.suggested !== null && Math.abs(p.suggested - p.current) > 1e-9,
    ).length,
    goalMet: suggested
      ? portfolio(skus, suggested, a).contribution >= goal + buffer - 1e-7
      : null,
  };
}
export function parseTierCSV(
  csv: string,
  skus: SKU[],
  rules: PromotionRule[],
  state: TierState,
): TierState {
  const rows = records(csv),
    allowed = new Set([
      "SKU",
      "Priority_Tier",
      "Target_Discount",
      "Min_Discount",
      "Max_Discount",
    ]);
  for (const header of Object.keys(rows[0]))
    if (!allowed.has(header))
      throw Error(`Unknown tier column ${header}. Use the tier template.`);
  for (const required of ["SKU", "Priority_Tier"])
    if (!Object.hasOwn(rows[0], required))
      throw Error(`Missing required tier column: ${required}`);
  const ids = new Set(skus.map((s) => s.id)),
    seen = new Set<string>(),
    assignments: Record<string, TierAssignment> = Object.create(null);
  for (const r of rows) {
    if (!ids.has(r.SKU))
      throw Error(`Unknown tier product: ${r.SKU || "(empty SKU)"}`);
    if (seen.has(r.SKU)) throw Error(`Duplicate tier product: ${r.SKU}`);
    seen.add(r.SKU);
    if (!/^[123]$/.test(r.Priority_Tier))
      throw Error(`${r.SKU}: Priority_Tier must be 1, 2, or 3.`);
    const row: TierAssignment = {
      tier: Number(r.Priority_Tier) as MerchantTier,
    };
    for (const [key, column] of [
      ["target", "Target_Discount"],
      ["min", "Min_Discount"],
      ["max", "Max_Discount"],
    ] as const) {
      const text = r[column];
      if (text === undefined || text === "") continue;
      const n = /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(text) ? Number(text) : NaN;
      if (!validRate(n))
        throw Error(
          `${r.SKU}: ${column} must be a decimal from 0 to 1 (0.2 = 20%).`,
        );
      row[key] = n;
    }
    assignments[r.SKU] = row;
  }
  const candidate = { ...state, assignments },
    validation = resolveTiers(skus, rules, candidate);
  if (validation.errors.length) throw Error(validation.errors.join("\n"));
  return candidate;
}
export const tierTemplate =
  "SKU,Priority_Tier,Target_Discount,Min_Discount,Max_Discount\nEXAMPLE-001,1,0.2,0.1,0.4\n";
export function exportTierCSV(state: TierState) {
  return exportCSV(
    Object.keys(state.assignments)
      .sort()
      .map((id) => {
        const a = effectiveTier(state, id)!;
        return {
          SKU: id,
          Priority_Tier: a.tier,
          Target_Discount: a.target,
          Min_Discount: a.min,
          Max_Discount: a.max,
        };
      }),
  );
}
