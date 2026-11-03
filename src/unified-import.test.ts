import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import Papa from "papaparse";
import {
  importCampaign,
  costQuality,
  costReport,
  costColumns,
  simpleColumns,
  advancedColumns,
  simpleProductTemplate,
  advancedProductTemplate,
} from "./unifiedImport";
import { records, parseSKUs, template } from "./csv";
import { portfolio, scenario, defaults } from "./engine";
import { improveTierPlan } from "./tiers";
const core = {
  SKU: "A",
  Regular_Price_USD: 50,
  Unit_COGS_USD: 20,
  Inventory_Units: 100,
  Expected_Units: 10,
};
const csv = (rows: Record<string, unknown>[]) => Papa.unparse(rows);
describe("unified product transaction", () => {
  it("loads only five required columns without creating a tier, P1 lock or hard planned offer", () => {
    const c = importCampaign(csv([core]));
    expect(c.skus).toHaveLength(1);
    expect(c.skus[0]).toMatchObject({
      priority: "P3",
      price: 50,
      cost: 20,
      inventory: 100,
      units: 10,
    });
    expect(c.rules).toEqual([]);
    expect(Object.keys(c.tiers.assignments)).toHaveLength(0);
    expect(Object.keys(c.planned)).toHaveLength(0);
    expect(c.goal).toBe(150);
    expect(costQuality(c.costs).status).toBe("Some Costs Missing");
  });
  it("loads products, tiers, exact/min/preferred rules and planned offers into one prepared value", () => {
    const c = importCampaign(
      csv([
        {
          ...core,
          Priority_Tier: 1,
          Target_Discount: 0.3,
          Min_Discount: 0.1,
          Max_Discount: 0.4,
          Planned_Discount: 0.25,
          Exact_Discount: 0.25,
          Preferred_Discount: 0.3,
        },
      ]),
    );
    expect(c.tiers.assignments.A).toEqual({
      tier: 1,
      target: 0.3,
      min: 0.1,
      max: 0.4,
    });
    expect(c.rules[0]).toEqual({
      id: "A",
      min: 0.1,
      exact: 0.25,
      preferred: 0.3,
    });
    expect(c.planned.A).toBe(0.25);
    expect(c.skus[0].priority).toBe("P3");
    expect(portfolio(c.skus, c.planned).contribution).toBe(175);
    expect(
      c.warnings.some((w) =>
        /Unrecognized column (Priority_Tier|Target_Discount|Min_Discount|Planned_Discount|Exact_Discount|Preferred_Discount)/.test(
          w,
        ),
      ),
    ).toBe(false);
  });
  it("uses the exact Simple template schema and accepts both downloadable templates", () => {
    expect(simpleProductTemplate.split("\n")[0].split(",")).toEqual([
      ...simpleColumns,
    ]);
    expect(importCampaign(simpleProductTemplate).skus).toHaveLength(3);
    expect(importCampaign(advancedProductTemplate).skus).toHaveLength(3);
    expect(new Set(advancedColumns).size).toBe(advancedColumns.length);
    for (const legacy of template.split("\n")[0].split(","))
      expect(advancedColumns).toContain(legacy);
  });
  it("does not promote merchant Tier 1 to legacy P1, and preserves explicit legacy Priority", () => {
    const c = importCampaign(
      csv([
        {
          ...core,
          Priority_Tier: 1,
          Target_Discount: 0.4,
          Planned_Discount: 0.3,
        },
      ]),
    );
    expect(c.skus[0].priority).toBe("P3");
    const r = improveTierPlan(
      c.skus,
      c.planned,
      c.rules,
      200,
      0,
      defaults,
      c.tiers,
    );
    expect(r.discounts!.A).toBeCloseTo(0.2);
    const legacy = importCampaign(
      csv([
        {
          ...core,
          Priority: "P1",
          Locked_Min_Discount: 0.2,
          Max_Discount: 0.5,
          Priority_Tier: 1,
          Target_Discount: 0.4,
          Planned_Discount: 0.3,
        },
      ]),
    );
    expect(
      improveTierPlan(
        legacy.skus,
        legacy.planned,
        legacy.rules,
        0,
        0,
        defaults,
        legacy.tiers,
      ).discounts!.A,
    ).toBe(0.2);
  });
  it("keeps planned offers separate from targets, including explicit zero and precedence over category/storewide", () => {
    const c = importCampaign(
      csv([
        {
          ...core,
          Priority_Tier: 1,
          Target_Discount: 0.4,
          Min_Discount: 0,
          Max_Discount: 0.5,
          Planned_Discount: 0,
        },
      ]),
    );
    expect(c.planned.A).toBe(0);
    expect(scenario(c.skus, 0.3, { Uncategorized: 0.2 }, c.planned).A).toBe(0);
    expect(
      improveTierPlan(c.skus, c.planned, c.rules, 0, 0, defaults, c.tiers)
        .discounts!.A,
    ).toBe(0);
  });
  it("loads a structurally valid plan that violates a hard rule rather than silently correcting it", () => {
    const c = importCampaign(
      csv([
        {
          ...core,
          Priority_Tier: 1,
          Target_Discount: 0.3,
          Min_Discount: 0.2,
          Max_Discount: 0.4,
          Planned_Discount: 0.1,
        },
      ]),
    );
    expect(c.planned.A).toBe(0.1);
    expect(c.rules[0].min).toBe(0.2);
    expect(
      improveTierPlan(c.skus, c.planned, c.rules, 0, 0, defaults, c.tiers)
        .discounts!.A,
    ).toBe(0.2);
  });
  it("distinguishes a financially infeasible campaign from malformed input", () => {
    const c = importCampaign(
      csv([
        {
          ...core,
          Unit_COGS_USD: 60,
          Min_Discount: 0.2,
          Planned_Discount: 0.2,
        },
      ]),
    );
    expect(c.goal).toBe(0);
    expect(
      improveTierPlan(c.skus, c.planned, c.rules, c.goal, 0, defaults, c.tiers)
        .feasible,
    ).toBe(false);
  });
  it.each([
    "SKU",
    "Regular_Price_USD",
    "Unit_COGS_USD",
    "Inventory_Units",
    "Expected_Units",
  ])("rejects missing or blank mandatory %s", (field) => {
    const row = { ...core } as Record<string, unknown>;
    delete row[field];
    expect(() => importCampaign(csv([row]))).toThrow();
    expect(() => importCampaign(csv([{ ...core, [field]: "" }]))).toThrow();
  });
  it.each([
    { Priority_Tier: 4 },
    { Planned_Discount: 20 },
    { Target_Discount: -0.1 },
    { Min_Discount: NaN },
    { Exact_Discount: 1.1 },
    { Preferred_Discount: "no" },
    { Min_Discount: 0.4, Max_Discount: 0.2 },
    { Exact_Discount: 0.3, Max_Discount: 0.2 },
    { Locked_Min_Discount: 0.3, Max_Discount: 0.2 },
    { Priority_Tier: 1, Target_Discount: 0.1, Min_Discount: 0.2 },
    { Payment_Fee_Rate: 2 },
    { Other_Variable_Cost_USD: -1 },
  ])("rejects structural errors atomically %j", (extra) =>
    expect(() => importCampaign(csv([{ ...core, ...extra }]))).toThrow(),
  );
  it("preserves original legacy SKU data and financial regression results", () => {
    const data = readFileSync(
        new URL("../sku_master.csv", import.meta.url),
        "utf8",
      ),
      c = importCampaign(data);
    expect(c.skus).toEqual(parseSKUs(data).skus);
    expect(c.rules).toEqual([]);
    expect(Object.keys(c.tiers.assignments)).toHaveLength(0);
    const p = portfolio(c.skus, scenario(c.skus, 0.2));
    expect(p.revenue).toBeCloseTo(253256.8);
    expect(p.contribution).toBeCloseTo(-14608.758, 2);
    expect(p.negative).toBe(22);
  });
  it("defines omitted tier/target defaults explicitly without creating a P1 lock", () => {
    const a = importCampaign(csv([{ ...core, Target_Discount: 0.3 }]));
    expect(a.tiers.assignments.A.tier).toBe(3);
    expect(a.warnings.some((w) => w.includes("without Priority_Tier"))).toBe(
      true,
    );
    const b = importCampaign(
      csv([
        { ...core, Priority_Tier: 1, Min_Discount: 0.2, Max_Discount: 0.4 },
      ]),
    );
    expect(b.tiers.assignments.A.target).toBe(0.2);
    expect(b.planned.A).toBeUndefined();
  });
  it("supports BOM/CRLF and quoted names, rejects duplicates/malformed/over-limit files", () => {
    const c = importCampaign(
      "\uFEFF" +
        csv([{ ...core, Product_Name: 'A, "quoted" product' }]).replaceAll(
          "\n",
          "\r\n",
        ),
    );
    expect(c.skus[0].name).toBe('A, "quoted" product');
    for (const text of [
      csv([core, core]),
      "SKU,SKU\nA,A",
      'SKU,Product_Name\nA,"bad',
      csv([core]) + "\nA",
      "x".repeat(5_000_001),
      "SKU,Regular_Price_USD,Unit_COGS_USD,Inventory_Units,Expected_Units\n" +
        Array(10001).fill("A,50,20,100,10").join("\n"),
    ])
      expect(() => importCampaign(text)).toThrow();
  });
  it("keeps unusual prototype-like SKU IDs and spreadsheet-safe exports intact", () => {
    const c = importCampaign(
      csv([
        { ...core, SKU: "__proto__", Priority_Tier: 1, Target_Discount: 0.2 },
        { ...core, SKU: "=SUM(1)", Priority_Tier: 3 },
      ]),
    );
    expect(Object.keys(c.tiers.assignments)).toContain("__proto__");
    expect(c.tiers.assignments["__proto__"].tier).toBe(1);
    expect(costReport(c.costs, false)).toContain("'=SUM(1)");
  });
  it("warns about genuinely unknown columns without dropping recognized unified fields", () => {
    const c = importCampaign(
      csv([{ ...core, Planned_Discount: 0.2, Something_Unknown: 7 }]),
    );
    expect(c.planned.A).toBe(0.2);
    expect(c.warnings.some((w) => w.includes("Something_Unknown"))).toBe(true);
  });
});
describe("cost presence versus numeric assumptions", () => {
  it("distinguishes absent/blank costs, explicit zeros and positive supplied values", () => {
    const c = importCampaign(
      csv([
        {
          ...core,
          Fulfillment_Cost_USD: 0,
          Merchant_Shipping_USD: 2,
          Payment_Fee_Rate: "",
        },
      ]),
    );
    expect(c.costs.find((x) => x.field === "Fulfillment_Cost_USD")!.state).toBe(
      "zero",
    );
    expect(
      c.costs.find((x) => x.field === "Merchant_Shipping_USD")!.state,
    ).toBe("provided");
    expect(c.costs.find((x) => x.field === "Payment_Fee_Rate")!.state).toBe(
      "missing",
    );
    expect(costQuality(c.costs)).toMatchObject({
      complete: false,
      zeros: 1,
      provided: 1,
      missing: 5,
    });
  });
  it("requires supplied or explicitly confirmed costs without changing arithmetic", () => {
    const c = importCampaign(csv([core])),
      before = portfolio(c.skus).contribution;
    expect(costQuality(c.costs, false).complete).toBe(false);
    expect(costQuality(c.costs, true)).toMatchObject({
      complete: true,
      missing: 7,
      confirmedMissing: 7,
    });
    expect(portfolio(c.skus).contribution).toBe(before);
    expect(c.skus[0].fulfillment).toBe(0);
  });
  it("marks all explicit zeros as complete and all positive/zero inputs as supplied", () => {
    const allZero = Object.fromEntries(costColumns.map((k) => [k, 0]));
    const c = importCampaign(csv([{ ...core, ...allZero }]));
    expect(costQuality(c.costs)).toMatchObject({
      complete: true,
      zeros: 7,
      missing: 0,
    });
  });
});
