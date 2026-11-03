import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseSKUs } from "./csv";
import { portfolio, scenario, defaults, type SKU } from "./engine";
import {
  prepareRules,
  improvePlan,
  initialGoal,
  profitStatus,
  parsePromotionCSV,
  adjustmentPath,
  planWarnings,
  groupWarnings,
  optimizeCampaign,
  type PromotionRule,
} from "./planner";
const skus = parseSKUs(
  readFileSync(new URL("../sku_master.csv", import.meta.url), "utf8"),
).skus;
const one: SKU = {
  ...skus[0],
  id: "A",
  priority: "P3",
  min: 0,
  max: 0.8,
  price: 100,
  cost: 20,
  units: 1,
  inventory: 1,
  feeRate: 0,
  fixedFee: 0,
  fulfillment: 0,
  shipping: 0,
  returnRate: 0,
  extraCost: 0,
};
describe("merchant planning rules", () => {
  it("reconfirms synthetic uniform 20% scenario without hard-coded app output", () => {
    const p = portfolio(skus, scenario(skus, 0.2));
    expect(p.revenue).toBeCloseTo(253256.8, 5);
    expect(p.contribution).toBeCloseTo(-14608.758, 2);
    expect(p.negative).toBe(22);
    expect(profitStatus(p.contribution, 0)).toBe("Losing Money");
  });
  it("initializes goal to half positive baseline, never to the demo floor", () => {
    expect(initialGoal([one])).toBe(40);
    expect(initialGoal([{ ...one, cost: 120 }])).toBe(0);
  });
  it("distinguishes positive profit from goal achievement including buffer", () => {
    expect(profitStatus(20, 30)).toBe("Profit Goal at Risk");
    expect(profitStatus(30, 30, 1)).toBe("Profit Goal at Risk");
    expect(profitStatus(31, 30, 1)).toBe("Profitable Plan");
    expect(profitStatus(-1, 0)).toBe("Losing Money");
  });
  it("combines exact/min/max rules without upgrading every selected product to P1", () => {
    const r = prepareRules(
      [one],
      [{ id: "A", min: 0.1, max: 0.4, exact: 0.3, preferred: 0.4 }],
    );
    expect(r.errors).toEqual([]);
    expect(r.skus[0]).toMatchObject({ min: 0.3, max: 0.3, priority: "P3" });
    const result = improvePlan(
      [one],
      { A: 0.5 },
      [{ id: "A", min: 0.1, max: 0.4, exact: 0.3 }],
      40,
    );
    expect(result.feasible).toBe(true);
    expect(result.discounts?.A).toBe(0.3);
  });
  it.each<PromotionRule>([
    { id: "A", min: 0.4, max: 0.2 },
    { id: "A", min: 0.3, exact: 0.2 },
    { id: "A", min: 0, max: 0.2, exact: 0.3 },
    { id: "A", min: NaN },
    { id: "missing", min: 0 },
  ])("rejects impossible or invalid hard rules %j", (r) => {
    const p = improvePlan([one], { A: 0.5 }, [r], 0);
    expect(p.feasible).toBe(false);
    expect(p.discounts).toBeNull();
    expect(p.errors.length).toBeGreaterThan(0);
  });
  it("retains dataset minimums, caps, and P1 locking", () => {
    const r = improvePlan(skus, scenario(skus, 0.2), [], 20000);
    expect(r.feasible).toBe(true);
    for (const s of skus) {
      expect(r.discounts![s.id]).toBeGreaterThanOrEqual(s.min);
      expect(r.discounts![s.id]).toBeLessThanOrEqual(s.max);
      if (s.priority === "P1") expect(r.discounts![s.id]).toBe(s.min);
    }
  });
  it("reduces discretionary discounts by only enough to meet the buffered goal", () => {
    const r = improvePlan([one], { A: 0.5 }, [], 40, 10);
    expect(r.feasible).toBe(true);
    expect(r.discounts!.A).toBeCloseTo(0.3);
    expect(portfolio([one], r.discounts!).contribution).toBeCloseTo(50);
    expect(r.changes).toEqual([{ id: "A", before: 0.5, after: 0.3 }]);
  });
  it("leaves already-safe offers unchanged", () => {
    const r = improvePlan([one], { A: 0.2 }, [], 40);
    expect(r.discounts).toEqual({ A: 0.2 });
    expect(r.changes).toEqual([]);
  });
  it("does not label unattainable buffer as feasible", () => {
    const r = improvePlan([one], { A: 0.5 }, [{ id: "A", min: 0.2 }], 60, 1);
    expect(r.feasible).toBe(false);
    expect(r.discounts).toBeNull();
  });
  it("keeps ordinary products ahead of must-promote products, with deterministic ID ties", () => {
    const items = [{ ...one, id: "B" }, one],
      rules = [{ id: "A", min: 0, preferred: 0.5 }];
    const r = improvePlan(items, { A: 0.5, B: 0.5 }, rules, 80);
    expect(r.discounts).toEqual({ B: 0.3, A: 0.5 });
    expect(
      improvePlan([...items].reverse(), { A: 0.5, B: 0.5 }, rules, 80)
        .discounts,
    ).toEqual(r.discounts);
  });
  it("can relax soft preference when needed but never a hard minimum", () => {
    const r = improvePlan(
      [one],
      { A: 0.5 },
      [{ id: "A", min: 0.1, preferred: 0.5 }],
      60,
    );
    expect(r.feasible).toBe(true);
    expect(r.discounts!.A).toBeCloseTo(0.2);
    expect(r.preferredWarnings).toHaveLength(1);
  });
  it("uses active stress inputs in feasibility, calculations and before/after", () => {
    const a = { stack: 0.1, shipping: 5, returns: 0 };
    const r = improvePlan([one], { A: 0.5 }, [], 40, 0, a);
    expect(r.feasible).toBe(true);
    expect(portfolio([one], r.discounts!, a).contribution).toBeCloseTo(40);
    expect(portfolio([one], { A: 0.5 }, a).contribution).toBe(20);
  });
  it("handles zero sales and zero discount loss without division errors", () => {
    const z = { ...one, inventory: 0 };
    const r = improvePlan([z], { A: 0.5 }, [], 0);
    expect(r.feasible).toBe(true);
    expect(
      adjustmentPath([z], { A: 0.5 }, r.discounts!, defaults, 0, 0).hasSales,
    ).toBe(false);
  });
  it("advanced objectives also respect exact and custom maximum rules", () => {
    const r = optimizeCampaign(
      [one],
      0,
      [{ id: "A", min: 0, exact: 0.3 }],
      defaults,
      "discount",
    );
    expect(r.feasible).toBe(true);
    expect(r.discounts.A).toBe(0.3);
    const m = optimizeCampaign(
      [one],
      0,
      [{ id: "A", min: 0, max: 0.2 }],
      defaults,
      "discount",
    );
    expect(m.discounts.A).toBe(0.2);
  });
  it("rejects invalid goals and negative buffers", () => {
    expect(() => improvePlan([one], { A: 0.5 }, [], NaN)).toThrow();
    expect(() => improvePlan([one], { A: 0.5 }, [], 0, -1)).toThrow();
  });
  it("groups separate issues by kind then category and identifies products", () => {
    const ws = planWarnings(
      [one],
      { A: 0.9 },
      [{ id: "A", min: 0, max: 0.4, exact: 0.3 }],
      40,
      0,
      defaults,
      ["Shipping cost missing: using 0."],
    );
    const groups = groupWarnings(ws);
    expect(groups.has("Above maximum")).toBe(true);
    expect(groups.has("Exact discount")).toBe(true);
    expect(groups.has("Product losing money")).toBe(true);
    expect(groups.has("Profit goal")).toBe(true);
    expect(groups.has("Missing costs or input assumptions")).toBe(true);
    expect(groups.get("Above maximum")!.get(one.category)![0].id).toBe("A");
  });
  it("represents an endpoint-to-endpoint path with fixed sales weights and valid zero crossing", () => {
    const path = adjustmentPath(
      [one],
      { A: 0.9 },
      { A: 0.3 },
      defaults,
      40,
      10,
    );
    expect(path.start).toEqual({ discount: 0.9, profit: -10.000000000000002 });
    expect(path.end.discount).toBeCloseTo(0.3);
    expect(path.end.profit).toBe(50);
    expect(path.zero!.discount).toBeCloseTo(0.8);
    expect(path.goal!.discount).toBeCloseTo(0.4);
    expect(path.buffer!.discount).toBeCloseTo(0.3);
    expect(
      adjustmentPath([one], { A: 0.3 }, { A: 0.3 }, defaults, 0, 0).zero,
    ).toBeNull();
  });
  it("accepts legacy and extended promotion CSVs, rejects malformed rates/IDs, exposes contradictory hard goals", () => {
    expect(parsePromotionCSV("SKU,Exact_Discount\nA,0.2", [one])[0].exact).toBe(
      0.2,
    );
    expect(
      parsePromotionCSV("SKU,Minimum_Discount,Preferred_Discount\nA,0.1,0.3", [
        one,
      ])[0].min,
    ).toBe(0.1);
    for (const csv of [
      "SKU,Exact_Discount\nA,20",
      "SKU,Minimum_Discount\nX,.1",
      "SKU,Maximum_Discount\nA,",
      "SKU,Exact_Discount\nA,.2\nA,.3",
    ])
      expect(() => parsePromotionCSV(csv, [one])).toThrow();
    const rules = parsePromotionCSV(
      "SKU,Minimum_Discount,Maximum_Discount\nA,.5,.2",
      [one],
    );
    expect(improvePlan([one], { A: 0.3 }, rules, 0).feasible).toBe(false);
  });
});
