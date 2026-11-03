import { describe, expect, it } from "vitest";
import Papa from "papaparse";
import { line, portfolio, defaults, crossing, type SKU } from "./engine";
import { importCampaign, costColumns, costQuality, advancedProductTemplate } from "./unifiedImport";
import { exportCSV, records } from "./csv";
import { emptyTiers, improveTierPlan, optimizeTierCampaign, verifyTierPlan } from "./tiers";

// Independent reference values are worked in docs/BETA_RELEASE_AUDIT.md.
// Do not derive these expected amounts from production financial helpers.
const product = (extra: Partial<SKU> = {}): SKU => ({
  id: "A", name: "Audit product", category: "Audit", priority: "P3",
  price: 100, cost: 40, units: 10, inventory: 8, fulfillment: 2,
  shipping: 4, feeRate: 0.03, fixedFee: 0.3, returnRate: 0.1,
  returnCost: 10, extraCost: 1, min: 0, max: 1, step: 0.05, weight: 1,
  ...extra,
});
const cheap = (id = "A", extra: Partial<SKU> = {}) => product({
  id, price: 100, cost: 20, units: 1, inventory: 1, fulfillment: 0,
  shipping: 0, feeRate: 0, fixedFee: 0, returnRate: 0, returnCost: 0,
  extraCost: 0, ...extra,
});
const core = { SKU: "A", Regular_Price_USD: 50, Unit_COGS_USD: 20, Inventory_Units: 100, Expected_Units: 10 };

describe("beta independent financial references", () => {
  it.each([
    [0, defaults, 800, 480, 389.6],
    [0.2, defaults, 640, 320, 234.4],
    [0.2, { stack: 0.1, shipping: 2, returns: 0.05 }, 576, 256, 152.32],
    [1, defaults, 0, -320, -386.4],
  ])("checks independently worked discount %s and stresses %j", (d, a, revenue, gross, contribution) => {
    const result = line(product(), d, a);
    expect(result.units).toBe(8);
    expect(result.revenue).toBeCloseTo(revenue, 8);
    expect(result.gross).toBeCloseTo(gross, 8);
    expect(result.contribution).toBeCloseTo(contribution, 8);
  });
  it("checks portfolio sums and revenue-weighted margins", () => {
    const b = cheap("B", { price: 50, cost: 20, units: 4, inventory: 10 });
    const result = portfolio([product(), b], { A: 0.2, B: 0.1 });
    expect(result.revenue).toBe(820);
    expect(result.gross).toBe(420);
    expect(result.contribution).toBeCloseTo(334.4, 8);
    expect(result.grossMargin).toBeCloseTo(420 / 820, 10);
    expect(result.contributionMargin).toBeCloseTo(334.4 / 820, 10);
  });
  it("does not manufacture sales at a deeper discount; zero inventory produces zero totals", () => {
    expect(line(product(), 0).units).toBe(line(product(), 0.9).units);
    const result = portfolio([product({ inventory: 0 })]);
    expect(result.revenue).toBe(0);
    expect(result.gross).toBe(0);
    expect(result.contribution).toBe(0);
    expect(result.grossMargin).toBeNull();
  });
  it("rejects impossible combined return probabilities", () => {
    expect(() => line(product({ returnRate: 0.95 }), 0, { ...defaults, returns: 0.1 })).toThrow(/return rate/);
  });
  it("recovers Tier 3 then Tier 2, protecting Tier 1 and meeting goal plus buffer", () => {
    const skus = [cheap("A"), cheap("B"), cheap("C")], tiers = emptyTiers();
    tiers.assignments = { A: { tier: 1, target: 0.3 }, B: { tier: 2, target: 0.3 }, C: { tier: 3, target: 0.3 } };
    const result = improveTierPlan(skus, { A: 0.4, B: 0.4, C: 0.4 }, [], 170, 10, defaults, tiers);
    expect(result.feasible).toBe(true);
    expect(result.discounts!.A).toBeCloseTo(0.4, 10);
    expect(result.discounts!.B).toBeCloseTo(0.2, 10);
    expect(result.discounts!.C).toBeCloseTo(0, 10);
    expect(portfolio(skus, result.discounts!).contribution).toBeCloseTo(180, 8);
    expect(improveTierPlan(skus, {}, [], 240, 1, defaults, tiers)).toMatchObject({ feasible: false, discounts: null });
  });
  it("rejects exact/min/max conflicts and refuses to verify a financially adequate hard-rule violation", () => {
    const skus = [cheap()], tiers = emptyTiers();
    const rules = [{ id: "A", min: 0.2, max: 0.4, exact: 0.3 }];
    expect(verifyTierPlan(skus, { A: 0.1 }, rules, tiers, 0, 0, defaults).feasible).toBe(false);
    expect(verifyTierPlan(skus, { A: 0.3 }, rules, tiers, 40, 10, defaults).feasible).toBe(true);
    expect(improveTierPlan(skus, {}, [{ id: "A", min: 0.4, max: 0.2 }], 0)).toMatchObject({ feasible: false, discounts: null });
  });
  it("retains legacy P1 lock separately from adjustable P2/P3", () => {
    const skus = [cheap("A", { priority: "P1", min: 0.1 }), cheap("B", { priority: "P2" }), cheap("C")];
    const result = optimizeTierCampaign(skus, 0, [], defaults, "discount", emptyTiers());
    expect(result.feasible).toBe(true);
    expect(result.discounts).toEqual({ A: 0.1, B: 1, C: 1 });
    // P1 may be raised by a valid explicit exact requirement; it stays locked there.
    const exact = improveTierPlan(skus, {}, [{ id: "A", min: 0, exact: 0.2 }], 0);
    expect(exact.discounts!.A).toBe(0.2);
  });
  it("retains existing strict-below crossing semantics including equality and initial losses", () => {
    const point = (step: number, contribution: number) => ({ step, id: "A", discount: 0, contribution, belowFloor: false, negative: contribution < 0 });
    expect(crossing([point(0, 100), point(1, 50)], 50)).toBeNull();
    expect(crossing([point(0, 100), point(1, 50), point(2, 0)], 50)).toBe(1);
    expect(crossing([point(0, -1)], 0)).toBe(0);
    expect(crossing([point(0, 100), point(1, -100)], 0)).toBe(0.5);
  });
});

describe("beta rounded checkout references (nearest increment)", () => {
  it.each([1, 0.5, 0.1])("%s percentage-point rounding can break minimum, maximum, exact and profit constraints", (increment) => {
    const rateStep = increment / 100;
    const round = (d: number) => Math.round(d / rateStep) * rateStep;
    const skus = [cheap()], tiers = emptyTiers();
    const min = 0.2 + rateStep * 0.2, max = 0.2 + rateStep * 0.8;
    expect(verifyTierPlan(skus, { A: min }, [{ id: "A", min }], tiers, 0, 0, defaults).feasible).toBe(true);
    expect(verifyTierPlan(skus, { A: round(min) }, [{ id: "A", min }], tiers, 0, 0, defaults).feasible).toBe(false);
    expect(verifyTierPlan(skus, { A: round(max) }, [{ id: "A", min: 0, max }], tiers, 0, 0, defaults).feasible).toBe(false);
    expect(verifyTierPlan(skus, { A: round(min) }, [{ id: "A", min: 0, exact: min }], tiers, 0, 0, defaults).feasible).toBe(false);
    // C = $80 - $100d. The continuous optimum uses exactly goal + $5 buffer.
    const goal = 75 - 100 * max;
    const result = optimizeTierCampaign(skus, goal + 5, [], defaults, "discount", tiers);
    expect(result.feasible).toBe(true);
    expect(result.discounts.A).toBeCloseTo(max, 10);
    const rounded = { A: round(result.discounts.A) };
    expect(verifyTierPlan(skus, rounded, [], tiers, goal, 5, defaults).feasible).toBe(false);
    expect(portfolio(skus, rounded).contribution).toBeCloseTo(goal + 5 - 100 * rateStep * 0.2, 8);
  });
});

describe("beta CSV boundary and security checks", () => {
  it("loads a complete Advanced template with actual supplied cost inputs", () => {
    const rows = records(advancedProductTemplate).map(r => ({ ...r, ...Object.fromEntries(costColumns.map(c => [c, c === "Payment_Fee_Rate" ? 0.03 : c === "Expected_Return_Rate" ? 0.1 : 1])) }));
    const campaign = importCampaign(Papa.unparse(rows));
    expect(costQuality(campaign.costs)).toMatchObject({ complete: true, missing: 0, provided: 21 });
  });
  it("accepts 10,000 unique products below 5 MB and rejects the next row", () => {
    const rows = Array.from({ length: 10000 }, (_, i) => ({ ...core, SKU: `AUDIT-${i}`, Product_Name: "x".repeat(430) }));
    const text = Papa.unparse(rows);
    expect(new TextEncoder().encode(text).length).toBeLessThan(5_000_000);
    expect(text.length).toBeGreaterThan(4_000_000);
    expect(importCampaign(text).skus).toHaveLength(10000);
    expect(() => importCampaign(Papa.unparse([...rows, { ...core, SKU: "extra" }]))).toThrow(/10,000/);
  });
  it.each(["=1+1", "+SUM(1)", "-1+2", "@SUM(1)", "\t=1+1", "\r=1+1"])("escapes spreadsheet formula prefix %j", (SKU) => {
    expect(records(exportCSV([{ SKU, Value: 1 }]))[0].SKU).toBe("'" + SKU);
  });
});
