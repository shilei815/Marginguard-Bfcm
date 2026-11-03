import { records, parseSKUs, exportCSV } from "./csv";
import {
  portfolio,
  scenario,
  defaults,
  validRate,
  type SKU,
  type Discounts,
} from "./engine";
import { initialGoal, type PromotionRule } from "./planner";
import {
  emptyTiers,
  resolveTiers,
  type TierState,
  type TierAssignment,
  type MerchantTier,
} from "./tiers";
export const simpleColumns = [
  "SKU",
  "Product_Name",
  "Category",
  "Regular_Price_USD",
  "Unit_COGS_USD",
  "Inventory_Units",
  "Expected_Units",
  "Priority_Tier",
  "Target_Discount",
  "Min_Discount",
  "Max_Discount",
] as const;
export const costColumns = [
  "Fulfillment_Cost_USD",
  "Merchant_Shipping_USD",
  "Payment_Fee_Rate",
  "Order_Fixed_Fee_Allocated_USD",
  "Expected_Return_Rate",
  "Return_Cost_Per_Return_USD",
  "Other_Variable_Cost_USD",
] as const;
export const advancedColumns = [
  ...simpleColumns,
  ...costColumns,
  "Planned_Discount",
  "Exact_Discount",
  "Preferred_Discount",
  "Locked_Min_Discount",
  "Step_Discount",
  "Allocation_Weight",
  "Priority",
] as const;
const examples = [
  [
    "ELE-001",
    "Wireless Earbuds",
    "Electronics",
    80,
    45,
    200,
    150,
    1,
    0.3,
    0.25,
    0.35,
  ],
  ["HOM-001", "Kitchen Organizer", "Home", 40, 18, 150, 100, 2, 0.2, 0.15, 0.3],
  ["ACC-001", "Phone Case", "Accessories", 20, 7, 300, 180, 3, 0.1, 0, 0.2],
];
export const simpleProductTemplate =
  simpleColumns.join(",") +
  "\n" +
  examples.map((r) => r.join(",")).join("\n") +
  "\n";
// Advanced cost cells are deliberately blank: replace them with actual values or explicit zeros.
export const advancedProductTemplate =
  advancedColumns.join(",") +
  "\n" +
  examples
    .map((row) =>
      [
        ...row,
        ...Array(advancedColumns.length - simpleColumns.length).fill(""),
      ].join(","),
    )
    .join("\n") +
  "\n";
export type CostColumn = (typeof costColumns)[number];
export interface CostCell {
  id: string;
  field: CostColumn;
  state: "missing" | "zero" | "provided";
}
export interface ImportedCampaign {
  skus: SKU[];
  rules: PromotionRule[];
  tiers: TierState;
  planned: Discounts;
  warnings: string[];
  costs: CostCell[];
  costsConfirmed: boolean;
  goal: number;
  demo?: boolean;
}
export const costLabels: Record<CostColumn, string> = {
  Fulfillment_Cost_USD: "Fulfillment cost",
  Merchant_Shipping_USD: "Merchant shipping",
  Payment_Fee_Rate: "Payment fee rate",
  Order_Fixed_Fee_Allocated_USD: "Fixed payment fee per unit",
  Expected_Return_Rate: "Expected return rate",
  Return_Cost_Per_Return_USD: "Cost per return",
  Other_Variable_Cost_USD: "Other variable costs",
};
const present = (row: Record<string, string>, column: string) =>
  Object.hasOwn(row, column) && row[column] !== "";
function rate(row: Record<string, string>, column: string) {
  if (!present(row, column)) return undefined;
  const value = /^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(row[column])
    ? Number(row[column])
    : NaN;
  if (!validRate(value))
    throw Error(
      `${row.SKU}: ${column} must be a decimal from 0 to 1 (0.30 means 30%).`,
    );
  return value;
}
export function importCampaign(csv: string): ImportedCampaign {
  const rows = records(csv),
    base = parseSKUs(csv),
    rules: PromotionRule[] = [],
    tiers = emptyTiers(),
    planned: Discounts = Object.create(null),
    costs: CostCell[] = [],
    extraWarnings: string[] = [];
  tiers.assignments = Object.create(null);
  const recognizedNew = new Set([
    "Priority_Tier",
    "Target_Discount",
    "Min_Discount",
    "Planned_Discount",
    "Exact_Discount",
    "Preferred_Discount",
  ]);
  for (const row of rows) {
    const target = rate(row, "Target_Discount"),
      min = rate(row, "Min_Discount"),
      max = rate(row, "Max_Discount"),
      exact = rate(row, "Exact_Discount"),
      preferred = rate(row, "Preferred_Discount"),
      offer = rate(row, "Planned_Discount");
    let tier: MerchantTier | undefined;
    if (present(row, "Priority_Tier")) {
      if (!/^[123]$/.test(row.Priority_Tier))
        throw Error(
          `${row.SKU}: Priority_Tier must be 1, 2, or 3. It is separate from legacy Priority P1/P2/P3.`,
        );
      tier = Number(row.Priority_Tier) as MerchantTier;
    } else if (target !== undefined) {
      tier = 3;
      extraWarnings.push(
        `${row.SKU}: Target_Discount without Priority_Tier is assigned to Flexible — Tier 3; legacy Priority is unchanged.`,
      );
    }
    if (tier) {
      const assignment: TierAssignment = { tier };
      if (target !== undefined) assignment.target = target;
      if (min !== undefined) assignment.min = min;
      if (max !== undefined) assignment.max = max;
      // A missing soft target adds no protection beyond an explicitly supplied hard tier minimum.
      if (target === undefined && min !== undefined) {
        assignment.target = min;
        extraWarnings.push(
          `${row.SKU}: omitted Target_Discount defaults to its supplied Min_Discount (${(min * 100).toFixed(2)}%). This does not add an exact lock or change the planned offer.`,
        );
      }
      tiers.assignments[row.SKU] = assignment;
    }
    // Max_Discount always retains its original product-file cap meaning; it appears once in both templates.
    if (min !== undefined || exact !== undefined || preferred !== undefined)
      rules.push({
        id: row.SKU,
        min: min ?? 0,
        ...(exact === undefined ? {} : { exact }),
        ...(preferred === undefined ? {} : { preferred }),
      });
    if (offer !== undefined) planned[row.SKU] = offer;
    for (const field of costColumns)
      costs.push({
        id: row.SKU,
        field,
        state: !present(row, field)
          ? "missing"
          : Number(row[field]) === 0
            ? "zero"
            : "provided",
      });
  }
  const resolved = resolveTiers(base.skus, rules, tiers);
  if (resolved.errors.length) throw Error(resolved.errors.join("\n"));
  const goal = initialGoal(base.skus);
  // Validate all financial totals before the caller can change any campaign state.
  portfolio(base.skus, scenario(base.skus, 0.1, {}, planned), defaults);
  const warnings = base.warnings.filter((w) => {
    const match = w.match(/^Unrecognized column (.*): excluded/);
    return !match || !recognizedNew.has(match[1]);
  });
  return {
    skus: base.skus,
    rules,
    tiers,
    planned,
    warnings: [...warnings, ...extraWarnings],
    costs,
    costsConfirmed: false,
    goal,
  };
}
export function costQuality(cells: CostCell[], confirmed = false) {
  const missing = cells.filter((c) => c.state === "missing").length,
    zeros = cells.filter((c) => c.state === "zero").length,
    provided = cells.length - missing - zeros;
  return {
    complete: missing === 0 || confirmed,
    status:
      missing === 0 || confirmed ? "Cost Data Complete" : "Some Costs Missing",
    missing,
    zeros,
    provided,
    confirmedMissing: confirmed ? missing : 0,
  };
}
export function costReport(cells: CostCell[], confirmed: boolean) {
  return exportCSV(
    cells.map((c) => ({
      SKU: c.id,
      Cost_Field: c.field,
      Source_State: c.state,
      Explicitly_Confirmed_Zero: c.state === "missing" && confirmed,
    })),
  );
}
