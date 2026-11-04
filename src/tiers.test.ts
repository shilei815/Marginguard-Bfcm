import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseSKUs, template } from "./csv";
import {
  portfolio,
  scenario,
  defaults,
  type SKU,
  type Discounts,
} from "./engine";
import { improvePlan } from "./planner";
import {
  emptyTiers,
  assignTier,
  effectiveTier,
  resolveTiers,
  improveTierPlan,
  verifyTierPlan,
  parseTierCSV,
  exportTierCSV,
  optimizeTierCampaign,
  tierReport,
  tierPlanWarnings,
  type TierState,
  type MerchantTier,
} from "./tiers";
const base: SKU = {
  ...parseSKUs(template).skus[0],
  id: "A",
  price: 100,
  cost: 20,
  inventory: 1,
  units: 1,
  fulfillment: 0,
  shipping: 0,
  feeRate: 0,
  fixedFee: 0,
  returnRate: 0,
  extraCost: 0,
  min: 0,
  max: 1,
  priority: "P3",
  weight: 1,
};
const products = [base, { ...base, id: "B" }, { ...base, id: "C" }];
const assigned = (): TierState => ({
  ...emptyTiers(),
  assignments: {
    A: { tier: 1, target: 0.4 },
    B: { tier: 2, target: 0.4 },
    C: { tier: 3, target: 0.4 },
  },
});
const current: Discounts = { A: 0.5, B: 0.5, C: 0.5 };
describe("separate merchant tier configuration", () => {
  it("bulk assigns, changes and removes tiers without changing legacy SKU classes", () => {
    const first = assignTier(emptyTiers(), ["A", "B"], 1);
    expect(first.assignments).toEqual({ A: { tier: 1 }, B: { tier: 1 } });
    first.assignments.A.target = 0.3;
    const changed = assignTier(first, ["A"], 2);
    expect(changed.assignments.A).toEqual({ tier: 2, target: 0.3 });
    expect(assignTier(changed, ["A"], null).assignments).toEqual({
      B: { tier: 1 },
    });
    expect(products[0].priority).toBe("P3");
  });
  it("inherits defaults and applies each SKU tier override independently", () => {
    const state = assignTier(emptyTiers(), ["A", "B"], 1);
    state.defaults[1] = { target: 0.3, min: 0.1, max: 0.6 };
    state.assignments.B.min = 0.2;
    expect(effectiveTier(state, "A")).toEqual({
      tier: 1,
      target: 0.3,
      min: 0.1,
      max: 0.6,
    });
    expect(effectiveTier(state, "B")).toEqual({
      tier: 1,
      target: 0.3,
      min: 0.2,
      max: 0.6,
    });
  });
  it("allows an explicit tier override to replace a default but never weaken file or explicit bounds", () => {
    const state = assignTier(emptyTiers(), ["A"], 1);
    state.defaults[1] = { target: 0.4, min: 0.3, max: 0.8 };
    state.assignments.A.min = 0;
    const r = resolveTiers(
      [{ ...base, min: 0.15, max: 0.7 }],
      [{ id: "A", min: 0.2, max: 0.6 }],
      state,
    );
    expect(r.errors).toEqual([]);
    expect(r.skus[0]).toMatchObject({ min: 0.2, max: 0.6 });
  });
  it("does not apply unused defaults to unrelated products", () => {
    const state = emptyTiers();
    state.defaults[1] = { target: 0.2, min: 0.5, max: 0.1 };
    expect(resolveTiers(products, [], state).errors).toEqual([]);
    expect(
      improveTierPlan(products, current, [], 0, 0, defaults, state).feasible,
    ).toBe(true);
  });
  it("reports contradictory inherited settings without mutating merchant rules", () => {
    const state = assignTier(emptyTiers(), ["A"], 1);
    state.defaults[1] = { target: 0.1, min: 0.3, max: 0.2 };
    const json = JSON.stringify(state);
    expect(
      improveTierPlan(products, current, [], 100, 0, defaults, state).feasible,
    ).toBe(false);
    expect(JSON.stringify(state)).toBe(json);
  });
  it("explicit preferred discounts override tier targets for soft protection only", () => {
    const state = assignTier(emptyTiers(), ["A"], 1);
    state.assignments.A.target = 0.4;
    const r = resolveTiers(
      [base],
      [{ id: "A", min: 0, preferred: 0.2 }],
      state,
    );
    expect(r.rules[0].preferred).toBe(0.2);
    expect(r.skus[0].min).toBe(0);
  });
  it("reports targets blocked by caps as soft, not as permission to weaken a hard rule", () => {
    const state = assigned();
    const r = resolveTiers([{ ...base, max: 0.2 }], [], {
      ...state,
      assignments: { A: { tier: 1, target: 0.4 } },
    });
    expect(r.errors).toEqual([]);
    expect(r.softWarnings[0].message).toContain("hard rule is kept");
    expect(r.skus[0].max).toBe(0.2);
  });
  it("rejects unknown or invalid programmatic assignments", () => {
    const state = emptyTiers();
    state.assignments.X = { tier: 1 };
    expect(resolveTiers([base], [], state).errors[0]).toContain(
      "Unknown tier product",
    );
    state.assignments = { A: { tier: 4 as MerchantTier } };
    expect(
      improveTierPlan([base], { A: 0.5 }, [], 0, 0, defaults, state).feasible,
    ).toBe(false);
  });
});
describe("tier-aware deterministic recovery", () => {
  it.each([
    [120, { A: 0.5, B: 0.5, C: 0.2 }],
    [160, { A: 0.5, B: 0.3, C: 0 }],
    [200, { A: 0.4, B: 0, C: 0 }],
  ])(
    "recovers profit for goal %s strictly from Tier 3, then 2, then 1",
    (goal, expected) => {
      const r = improveTierPlan(
        products,
        current,
        [],
        goal as number,
        0,
        defaults,
        assigned(),
      );
      expect(r.feasible).toBe(true);
      for (const id of ["A", "B", "C"])
        expect(r.discounts![id]).toBeCloseTo((expected as Discounts)[id], 10);
      expect(portfolio(products, r.discounts!).contribution).toBeCloseTo(
        goal as number,
      );
    },
  );
  it("relaxes a Tier 3 soft target before touching a higher tier even above that higher target", () => {
    const r = improveTierPlan(
      products,
      current,
      [],
      120,
      0,
      defaults,
      assigned(),
    );
    expect(r.discounts!.C).toBeCloseTo(0.2);
    expect(r.discounts!.A).toBe(0.5);
    expect(r.discounts!.B).toBe(0.5);
    expect(r.preferredWarnings.length).toBe(1);
  });
  it("Tier 1 is not an exact lock and can be reduced below a target when required", () => {
    const r = improveTierPlan([base], { A: 0.5 }, [], 60, 0, defaults, {
      ...emptyTiers(),
      assignments: { A: { tier: 1, target: 0.5 } },
    });
    expect(r.feasible).toBe(true);
    expect(r.discounts!.A).toBeCloseTo(0.2);
  });
  it("keeps exact/minimum/maximum rules, corrects violations first, and verifies all hard bounds", () => {
    const r = improveTierPlan(
      products,
      current,
      [
        { id: "A", min: 0, exact: 0.3 },
        { id: "B", min: 0.2, max: 0.4 },
        { id: "C", min: 0.1 },
      ],
      130,
      0,
      defaults,
      assigned(),
    );
    expect(r.feasible).toBe(true);
    expect(r.discounts!.A).toBe(0.3);
    expect(r.discounts!.B).toBeGreaterThanOrEqual(0.2);
    expect(r.discounts!.B).toBeLessThanOrEqual(0.4);
    expect(r.discounts!.C).toBeGreaterThanOrEqual(0.1 - 1e-9);
    expect(
      verifyTierPlan(
        products,
        r.discounts!,
        [
          { id: "A", min: 0, exact: 0.3 },
          { id: "B", min: 0.2, max: 0.4 },
          { id: "C", min: 0.1 },
        ],
        assigned(),
        130,
        0,
        defaults,
      ).feasible,
    ).toBe(true);
  });
  it("preserves the original P1 required-minimum lock independently of a Tier 3 or Tier 1 preference", () => {
    const locked = { ...base, priority: "P1", min: 0.2, max: 0.8 };
    for (const tier of [1, 3] as const) {
      const r = improveTierPlan([locked], { A: 0.5 }, [], 0, 0, defaults, {
        ...emptyTiers(),
        assignments: { A: { tier, target: 0.6 } },
      });
      expect(r.discounts!.A).toBe(0.2);
    }
  });
  it("never increases an offer solely to reach a soft target, even with spare profit", () => {
    const r = improveTierPlan([base], { A: 0.1 }, [], 0, 0, defaults, {
      ...emptyTiers(),
      assignments: { A: { tier: 1, target: 0.5 } },
    });
    expect(r.discounts!.A).toBe(0.1);
    expect(r.preferredWarnings.length).toBe(1);
  });
  it("fails impossible goals and conflicting tier/explicit hard constraints without discounts", () => {
    expect(
      improveTierPlan(products, current, [], 241, 0, defaults, assigned())
        .discounts,
    ).toBeNull();
    const state = assigned();
    state.assignments.A.min = 0.4;
    expect(
      improveTierPlan(
        products,
        current,
        [{ id: "A", min: 0, max: 0.2 }],
        0,
        0,
        defaults,
        state,
      ).feasible,
    ).toBe(false);
  });
  it("honors a buffer and active stress costs with independent financial recalculation", () => {
    const a = { stack: 0.1, shipping: 2, returns: 0 };
    const r = improveTierPlan(products, current, [], 100, 5, a, assigned());
    expect(r.feasible).toBe(true);
    expect(portfolio(products, r.discounts!, a).contribution).toBeCloseTo(105);
  });
  it("uses binary ID ties and is deterministic across input order", () => {
    const state = {
      ...emptyTiers(),
      assignments: {
        A: { tier: 3 as const, target: 0.4 },
        B: { tier: 3 as const, target: 0.4 },
        C: { tier: 1 as const, target: 0.4 },
      },
    };
    const r = improveTierPlan(products, current, [], 100, 0, defaults, state);
    expect(r.discounts!.A).toBeCloseTo(0.4);
    expect(r.discounts!.B).toBe(0.5);
    expect(
      improveTierPlan(
        [...products].reverse(),
        current,
        [],
        100,
        0,
        defaults,
        state,
      ).discounts,
    ).toEqual(r.discounts);
  });
  it("retains the exact legacy recommendation when there are no merchant assignments", () => {
    expect(
      improveTierPlan(
        products,
        current,
        [{ id: "A", min: 0.1, preferred: 0.3 }],
        160,
        0,
        defaults,
        emptyTiers(),
      ),
    ).toEqual(
      improvePlan(
        products,
        current,
        [{ id: "A", min: 0.1, preferred: 0.3 }],
        160,
      ),
    );
  });
  it("independently rejects suggested discounts that breach bounds, omit SKUs, or miss the floor", () => {
    const state = assigned();
    expect(
      verifyTierPlan(
        products,
        { A: 1.1, B: 0, C: 0 },
        [],
        state,
        0,
        0,
        defaults,
      ).feasible,
    ).toBe(false);
    expect(
      verifyTierPlan(products, { A: 0, B: 0 }, [], state, 0, 0, defaults)
        .feasible,
    ).toBe(false);
    expect(
      verifyTierPlan(products, current, [], state, 200, 0, defaults).feasible,
    ).toBe(false);
  });
  it("independent verification rejects invalid goals and buffers rather than approving them", () => {
    for (const [goal, buffer] of [
      [NaN, 0],
      [0, -1],
      [1e308, 1e308],
    ])
      expect(
        verifyTierPlan(
          products,
          { A: 0, B: 0, C: 0 },
          [],
          assigned(),
          goal,
          buffer,
          defaults,
        ).feasible,
      ).toBe(false);
  });
  it("keeps the advanced optimizer and ratio curve but intersects tier hard bounds", () => {
    const state = assignTier(emptyTiers(), ["A"], 1);
    state.assignments.A = { tier: 1, target: 0.3, min: 0.2, max: 0.4 };
    const r = optimizeTierCampaign([base], 0, [], defaults, "discount", state);
    expect(r.feasible).toBe(true);
    expect(r.discounts.A).toBe(0.4);
    expect(r.points.length).toBe(2);
  });
});
describe("standalone tier CSV", () => {
  it("round-trips resolved offers and full precision under different campaign defaults without mutating inheritance", () => {
    const state = assigned();
    state.assignments.B = { tier: 2 };
    state.assignments.A.target = 0.123456789;
    const before = JSON.stringify(state),
      fresh = emptyTiers();
    fresh.defaults[2] = { target: 0.8, min: 0.1, max: 1 };
    const parsed = parseTierCSV(exportTierCSV(state), products, [], fresh);
    for (const id of ["A", "B", "C"])
      expect(effectiveTier(parsed, id)).toEqual(effectiveTier(state, id));
    expect(parsed.defaults).toEqual(fresh.defaults);
    expect(JSON.stringify(state)).toBe(before);
  });
  it("supports blank optional fields and treats CSV numbers as decimal percentages", () => {
    const state = parseTierCSV(
      "SKU,Priority_Tier,Target_Discount,Min_Discount,Max_Discount\nA,1,.3,.1,.4",
      products,
      [],
      emptyTiers(),
    );
    expect(effectiveTier(state, "A")).toEqual({
      tier: 1,
      target: 0.3,
      min: 0.1,
      max: 0.4,
    });
    expect(
      parseTierCSV("SKU,Priority_Tier\nA,2", products, [], emptyTiers())
        .assignments.A,
    ).toEqual({ tier: 2 });
  });
  it.each([
    "SKU,Priority_Tier\nA,4",
    "SKU,Priority_Tier\nA,1.0",
    "SKU,Priority_Tier\nX,1",
    "SKU,Priority_Tier\nA,1\nA,2",
    "SKU,Priority_Tier,Target_Discount\nA,1,30",
    "SKU,Priority_Tier,Target_Discount\nA,1,NaN",
    "SKU,Priority_Tier,Target_Discount,Min_Discount,Max_Discount\nA,1,.5,.1,.4",
    "SKU,Priority_Tier,Min_Discount,Max_Discount\nA,1,.6,.2",
    "SKU,Tier\nA,1",
  ])("rejects invalid tier CSV %s", (csv) =>
    expect(() => parseTierCSV(csv, products, [], emptyTiers())).toThrow(),
  );
  it("rejects imported hard conflicts with product-file bounds and explicit exact rules", () => {
    expect(() =>
      parseTierCSV(
        "SKU,Priority_Tier,Target_Discount,Min_Discount,Max_Discount\nA,1,.3,.25,.4",
        [{ ...base, max: 0.2 }],
        [],
        emptyTiers(),
      ),
    ).toThrow(/conflict/);
    expect(() =>
      parseTierCSV(
        "SKU,Priority_Tier,Target_Discount,Min_Discount,Max_Discount\nA,1,.3,.25,.4",
        [base],
        [{ id: "A", min: 0, exact: 0.1 }],
        emptyTiers(),
      ),
    ).toThrow(/conflict/);
  });
  it("allows an unreachable soft target but explicitly reports the hard cap", () => {
    const state = parseTierCSV(
      "SKU,Priority_Tier,Target_Discount\nA,1,.5",
      [{ ...base, max: 0.2 }],
      [],
      emptyTiers(),
    );
    expect(
      tierPlanWarnings(
        [{ ...base, max: 0.2 }],
        { A: 0.2 },
        [],
        state,
        0,
        0,
        defaults,
      ).some((w) => w.message.includes("cannot be reached")),
    ).toBe(true);
  });
});
describe("tier reporting", () => {
  it("computes live target counts, hard-rule verification and reduction reasons", () => {
    const state = assigned(),
      r = improveTierPlan(products, current, [], 120, 0, defaults, state),
      report = tierReport(
        products,
        current,
        r.discounts,
        [],
        state,
        120,
        0,
        defaults,
      );
    expect(report.tiers.map((t) => t.achieved)).toEqual([1, 1, 0]);
    expect(report.goalMet).toBe(true);
    expect(report.adjustedCount).toBe(1);
    expect(report.products.find((p) => p.id === "C")!.reason).toContain(
      "soft target was relaxed",
    );
    expect(report.products.every((p) => p.hardRulesMet)).toBe(true);
  });
  it("distinguishes explicit preference policy and an offer originally below target", () => {
    const state = {
      ...emptyTiers(),
      assignments: { A: { tier: 1 as const, target: 0.4 } },
    };
    const r = tierReport(
      [base],
      { A: 0.1 },
      { A: 0.1 },
      [{ id: "A", min: 0, preferred: 0.2 }],
      state,
      0,
      0,
      defaults,
    );
    expect(r.products[0].reason).toContain("not automatically applied");
    expect(r.products[0].reason).toContain(
      "explicit product preferred offer overrides",
    );
  });
  it("reports infeasibility without implying target or goal achievement", () => {
    const report = tierReport(
      products,
      current,
      null,
      [],
      assigned(),
      999,
      0,
      defaults,
    );
    expect(report.goalMet).toBeNull();
    expect(
      report.products.every(
        (p) => p.targetAchieved === null && p.hardRulesMet === null,
      ),
    ).toBe(true);
  });
  it("reconfirms the unchanged synthetic 20% regression", () => {
    const synthetic = parseSKUs(
        readFileSync(new URL("../sku_master.csv", import.meta.url), "utf8"),
      ).skus,
      p = portfolio(synthetic, scenario(synthetic, 0.2));
    expect(p.revenue).toBeCloseTo(253256.8);
    expect(p.contribution).toBeCloseTo(-14608.758, 2);
    expect(p.negative).toBe(22);
  });
});
