# MarginGuard

**Plan Smarter Discounts. Protect Your Profit.**

See how your promotions affect profit, protect important products, and find better discount plans.

MarginGuard is a browser-only React/TypeScript/Vite planner for everyday, seasonal, clearance, launch, flash and storewide promotions. Simple Mode is the default; Advanced Mode retains detailed financial analysis and the validated continuous optimizer. Financial calculations and merchant-tier recommendation policies are unchanged.

Current merchant documentation: [beta user guide](docs/BETA_USER_GUIDE.md) and [public launch copy](docs/PUBLIC_LAUNCH_COPY.md). Original reference files (`README`, `README.txt`, workbook and synthetic data) and phase reports are historical engineering evidence, not current product positioning. They remain intact for reproducibility.

Canonical, social-sharing and sitemap URLs are generated from [config/site.json](config/site.json). PR #10 now targets the owner-verified evergreen origin, [https://marginguard.pages.dev/](https://marginguard.pages.dev/). This configuration change is not deployed until owner-approved integration. See the [migration and rollback plan](docs/DOMAIN_MIGRATION.md); this work does not create projects, rename the repository, merge or deploy.

## One product file to get started

Step 1 offers **Upload Products**, **Download Simple Template** and **Download Advanced Template**. Five columns are required: `SKU`, `Regular_Price_USD`, `Unit_COGS_USD`, `Inventory_Units`, `Expected_Units`. A five-column file works; no required cell can be blank. Optional names, categories, merchant tiers, targets, hard bounds and planned offers load through one coordinated transaction.

The Simple template's exact column order is:

```csv
SKU,Product_Name,Category,Regular_Price_USD,Unit_COGS_USD,Inventory_Units,Expected_Units,Priority_Tier,Target_Discount,Min_Discount,Max_Discount
```

The Advanced template adds all original optional costs/rates and legacy fields, plus `Planned_Discount`, `Exact_Discount`, and `Preferred_Discount`. Cost cells are intentionally blank for merchants to supply actual values or explicit zeros. Percentages are fractions: `0.30` = 30%. Templates contain fictional products, not real projections.

A successful import loads products, separate tier assignments, explicit rules, planned SKU offers and cost-quality metadata together. Structural errors leave the old campaign untouched. Financially infeasible but internally consistent campaigns can be reviewed with warnings; they are never called feasible recommendations. Standalone tier/rule updates remain under **Advanced Import Tools** for compatibility.

## Understand what was loaded

- `Planned_Discount` is the actual initial product offer and overrides category/storewide discounts until explicitly changed or cleared.
- `Target_Discount` is a soft tier preference; it never automatically raises the planned offer.
- `Min_Discount`, `Max_Discount`, and `Exact_Discount` are hard requirements, subject to the validated precedence model. Imported Min is an explicit SKU minimum as well as an assigned tier's minimum; Max remains the legacy file cap as well as the assigned tier maximum.
- `Preferred_Discount` remains an explicit SKU soft preference and governs within-tier protection when supplied.
- Merchant `Priority_Tier` (1/2/3) never creates legacy `Priority=P1`. Missing legacy Priority defaults to P3; historical P1/P2/P3 behavior is preserved.

Missing planned values use the editable 10% storewide starting offer. A target without a tier gets Flexible Tier 3, with a warning. A tier minimum without a target uses that supplied minimum as its default soft target, with a warning. Targets and minima are never silently interchanged as hard requirements. See [Phase 2D mappings and validation](docs/PHASE_2D.md) for full semantics and optional defaults.

## Check cost completeness before relying on profit

**Some Costs Missing** means omitted optional cost/rate fields are currently zero estimates. Estimated profit may be overstated. **Cost Data Complete** means every modeled variable-cost input was supplied, including explicit zeros, or explicitly confirmed zero/not applicable after review. The importer distinguishes absent/blank fields, zero values and positive values. Confirmation changes metadata only; it does not change calculations or fabricate costs. It persists across modes and resets on a new product import.

Fixed overhead, taxes, excluded costs, future sales and final accounting net profit are not certified by this status. No costs are inferred from category. The synthetic demo explicitly assumes its missing other-variable-cost field is zero; merchant uploads require their own data or confirmation. A local cost-input report preserves source and confirmation states.

Uploaded financial data stays in browser memory. No backend, database, account, analytics, remote financial API or external runtime assets are used. Refresh loses all campaign state and confirmations.

## Run and verify locally

Requires Node.js 22.12+ and npm (tested on Node 24.19).

```sh
npm ci
npm run dev
```

Open the URL printed by Vite, normally http://localhost:5173.

```sh
npm test
npm run build
```

`dist/` is static production output. No service credentials or environment variables are needed. See [Phase 2D unified import, cost quality and beta gates](docs/PHASE_2D.md), [Phase 2C tiers and policy](docs/PHASE_2C.md), [Phase 2B UX changes and browser QA](docs/PHASE_2B.md), [Phase 2A product rules](docs/PHASE_2A.md), [release notes](docs/RELEASE_NOTES.md), and the [financial model](docs/FINANCIAL_MODEL.md).

Optional real-browser verification after building (requires an installed Chromium):

```sh
npm run test:browser
```

See `docs/PHASE_2B.md` for browser executable selection, container sandbox requirements, generated reports and verification limits. The test harness uses a temporary loopback server only; the application remains static and browser-only.

## A quick merchant workflow

1. **Upload Products:** use the synthetic demo or download the Simple/Advanced template. Supply selling price, unit cost, expected campaign sales, inventory, and available variable costs. Review missing-cost assumptions; nothing is estimated from category or merchant identity.
2. **Set Discounts:** enter a storewide discount, category offers, or special product offers. Product offers override category offers, which override storewide offers. Select multiple products for bulk updates. Must-Promote checkboxes initially require at least the current offer; expand the rule editor to change or remove that commitment, add exact/maximum discounts, or set a non-guaranteed preferred target. You can upload a commitment list.
3. **Check Profit:** see expected sales, profit after variable costs, change from baseline, loss-making product count, and goal achievement. This is not accounting net profit: fixed overhead, taxes, and other excluded costs are not deducted. Warnings are collapsed and grouped by issue type, category, and affected product.
4. **Improve My Plan:** edit the minimum profit goal and optional additional safety buffer. Review a deterministic rule-compliant suggestion, before/after financials, and exact discount changes before using it. Export the current plan and proposed recommendations to CSV.

New uploads start a fresh campaign with a 10% storewide offer, goal = 50% of positive no-discount baseline contribution (otherwise $0), and $0 buffer. Custom commitments, tier settings/assignments, overrides, snapshots, and extra stress assumptions reset on dataset replacement. This editable goal is a planning starting point, not a financial guarantee. Switching Simple/Advanced views does **not** reset campaign inputs. An active advanced allocation remains active until the user changes the plan.

## Protect Your Important Products

Merchant tiers are a separate mapping from original P1/P2/P3 file priorities:

- **Must Promote — Tier 1:** strongest preference protection; reductions last.
- **Important — Tier 2:** reductions after Tier 3.
- **Flexible — Tier 3:** reductions first. Unassigned products join this recovery group without being counted as assigned Tier 3.

Expand the section in Step 2 to bulk-select and assign products, edit target/minimum/maximum defaults, or add per-product tier overrides. Defaults are neutral (0% target, 0% minimum, 100% maximum) until edited; assigning a tier does not apply an offer or create an exact lock. A blank override inherits its default. Tier hard limits intersect file and explicit SKU rules; contradictions are infeasible, never silently loosened.

Targets are non-guaranteed preferences. Improve My Plan corrects hard-rule violations, then recovers profit strictly from Tier 3 → 2 → 1. Within each tier it protects soft offers where possible before relaxing them to hard minima. An explicit SKU preferred discount overrides the tier target for recovery policy; target reporting still shows the tier target separately. Current offers below their targets are not automatically increased. See PHASE_2C.md for precise precedence and tradeoffs.

Tier CSV: `SKU,Priority_Tier,Target_Discount,Min_Discount,Max_Discount`. Tiers are 1–3 and percentages are decimals. Blank offers inherit defaults. Duplicate/unknown SKUs, invalid rates, inconsistent tier values and hard conflicts reject the upload atomically. The standalone template, portable resolved-assignment snapshot export and detailed recommendation export are in the tier section/summary. Re-imported snapshot values become explicit product overrides; clear them to inherit defaults again. A tier upload changes assignments only; original product/promotion CSV contracts are unchanged.

Reports distinguish soft-target achievement, verified hard rules, goal plus buffer, current/suggested offers and reasons. Legacy P1 locks remain separate. All recommendations undergo full independent financial and per-SKU bound validation. Without merchant tier assignments, the previous recommendation policy is retained exactly.

## Explicit product promotion rules

- **Exact:** discount must equal the stated percentage.
- **Minimum:** discount must not fall below it.
- **Maximum:** discount must not exceed it.
- **Preferred:** soft target; never a guarantee or a reason to break a hard goal.

Dataset minimums and maximums always remain in force. P1 retains the original engine's lock at its required minimum; a stricter custom minimum or allowed exact value can raise that requirement within the file cap. Merely marking another product must-promote does not convert it to P1. Contradictory rules are reported and produce no suggested plan. Current manual previews can violate rules to support exploration; warnings stay visible and exports are not approvals.

## CSV contract

Required product columns: `SKU`, `Regular_Price_USD`, `Unit_COGS_USD`, `Inventory_Units`, `Expected_Units`. Optional financial fields retain the original 18-column contract plus `Other_Variable_Cost_USD`; the unified promotion/tier columns above are supported in the same file. Use decimal percentages (`0.2` = 20%), USD costs per unit, and expected units for the same campaign period. Expected quantities can be fractional and are capped by inventory.

Missing optional costs/rates default to zero, minimum discount to zero, maximum to one, reference step to 0.05, and allocation weight to one. These defaults produce warnings; edit the CSV and re-upload to supply actual costs. Text defaults: name = SKU, category = Uncategorized, priority = P3. Unknown product columns are flagged and excluded. Field mapping is explicitly deferred: use the template's exact headers.

Must-promote CSV columns: `SKU,Minimum_Discount,Maximum_Discount,Exact_Discount,Preferred_Discount`. Only SKU and at least one rule value per row are needed; unused rule cells can be blank. Legacy `SKU,Minimum_Discount,Preferred_Discount` lists still work. Unknown headers/IDs, duplicates, malformed records, and invalid rates are rejected. In this legacy standalone rule workflow, syntactically valid conflicting hard rules can be loaded for repair and are reported infeasible; the primary unified import rejects contradictory hard rules atomically. Uploading a standalone list under Advanced Import Tools replaces custom commitments, never file rules.

Imports are limited to 5 MB / 10,000 rows. Export uses local browser Blob downloads and escapes spreadsheet formulas. Recommendations are exported at full precision; rounding them can change goal feasibility. Extra order discounts remain a separate Advanced Mode assumption and are not included in the chart's overall product discount percentage.

## Advanced Mode and modeling limits

Advanced Mode retains gross/contribution profit, margins, per-SKU financial analysis, editable allocation weights, stress inputs, scenario snapshots, original ordered cumulative frontier, and exact continuous objectives. Simple Mode's recommendation uses a separate explicit policy to reduce discretionary discounts; it does not claim to maximize future sales or economic profit. The advanced optimizer retains its original weighted-discount or contribution-profit objectives, with custom hard rules adapted into bounds before calling the unchanged engine.

Fixed demand only; no elasticity, demand lift, checkout integration, tax, fixed overhead, multi-currency, full returned-sale refund accounting, or saved campaigns. One representative single-SKU order per unit. Loss-making products can remain in an overall safe campaign. Preferred discounts may be missed. Continuous fractions are supported; discrete `Step_Discount` remains reference-only. Phase 2D extends the Chromium harness to 98 layout/state checks at six viewport sizes, including native unified/legacy uploads, atomic rollback, cost confirmation and mode preservation. Physical devices, Firefox/Safari, assistive technology, and touch/virtual-keyboard behavior remain unverified.

## Source layout

- `src/engine.ts`, `src/csv.ts`: unchanged Phase 1 financial/optimization engine and base CSV implementation.
- `src/planner.ts`: unchanged Phase 2A rule/recommendation layer, statuses, warnings and chart path.
- `src/tiers.ts`, `src/TierControls.tsx`: isolated merchant tiers, policy adapter, CSV validation, controls and outcome reporting.
- `src/unifiedImport.ts`, `src/ImportSection.tsx`: pure unified transaction, both templates, source cost metadata, shared onboarding and legacy import tools.
- `src/App.tsx`: atomic imported campaign state and Advanced dashboard.
- `src/MerchantView.tsx`: Simple workflow and shared rule management.
- `src/presentation.tsx`: display-only currency/input formatting and grouped warning/diagnostic presentation.
- `src/*.test.ts*`: original regressions plus Phase 2A policy, Phase 2B UX and Phase 2C tier and Phase 2D unified import/quality tests.
- `scripts/browser-qa.mjs`: optional real Chromium checks against the production build.
- `docs/`: methodology, initial audit, validation, Phase 2A product rules, release notes.
- Original eight root fixture files: preserved byte-for-byte and SHA-256 checked by tests. `public/demo-skus.csv` remains a data copy.
