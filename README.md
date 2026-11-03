# MarginGuard BFCM — Phase 2A

A browser-only discount planning tool for small e-commerce merchants, built with React, TypeScript, and Vite. Simple Mode is the default; Advanced Mode retains Phase 1 financial analysis and continuous optimization. Both views share the same campaign state and unchanged financial calculation engine.

No backend, database, account, analytics, merchant-data API, or external runtime assets. Uploaded financial data remains in browser memory and is lost on refresh. Existing Cloudflare Pages settings and the `phase-1-browser-planner` production branch are unchanged. Phase 2A is developed on `phase-2a-merchant-ux`; no deployment or merge is performed.

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

`dist/` is static production output. No service credentials or environment variables are needed. See [Phase 2A product rules and QA](docs/PHASE_2A.md), [release notes](docs/RELEASE_NOTES.md), and the [financial model](docs/FINANCIAL_MODEL.md).

## A quick merchant workflow

1. **Upload Products:** use the synthetic demo or download the CSV template. Supply selling price, unit cost, expected campaign sales, inventory, and available variable costs. Review missing-cost assumptions; nothing is estimated from category or merchant identity.
2. **Set Discounts:** enter a storewide discount, category offers, or special product offers. Product offers override category offers, which override storewide offers. Select multiple products for bulk updates. Must-Promote checkboxes initially require at least the current offer; expand the rule editor to change or remove that commitment, add exact/maximum discounts, or set a non-guaranteed preferred target. You can upload a commitment list.
3. **Check Profit:** see expected sales, profit after variable costs, change from baseline, loss-making product count, and goal achievement. This is not accounting net profit: fixed overhead, taxes, and other excluded costs are not deducted. Warnings are collapsed and grouped by issue type, category, and affected product.
4. **Improve My Plan:** edit the minimum profit goal and optional additional safety buffer. Review a deterministic rule-compliant suggestion, before/after financials, and exact discount changes before using it. Export the current plan and proposed recommendations to CSV.

New uploads start a fresh campaign with a 10% storewide offer, goal = 50% of positive no-discount baseline contribution (otherwise $0), and $0 buffer. Custom commitments, overrides, snapshots, and extra stress assumptions reset on dataset replacement. This editable goal is a planning starting point, not a financial guarantee. Switching Simple/Advanced views does **not** reset campaign inputs. An active advanced allocation remains active until the user changes the plan.

## Must-Promote rules

- **Exact:** discount must equal the stated percentage.
- **Minimum:** discount must not fall below it.
- **Maximum:** discount must not exceed it.
- **Preferred:** soft target; never a guarantee or a reason to break a hard goal.

Dataset minimums and maximums always remain in force. P1 retains the original engine's lock at its required minimum; a stricter custom minimum or allowed exact value can raise that requirement within the file cap. Merely marking another product must-promote does not convert it to P1. Contradictory rules are reported and produce no suggested plan. Current manual previews can violate rules to support exploration; warnings stay visible and exports are not approvals.

## CSV contract

Required product columns: `SKU`, `Regular_Price_USD`, `Unit_COGS_USD`, `Inventory_Units`, `Expected_Units`. Optional columns match the original 18-column fixture plus `Other_Variable_Cost_USD`. Use decimal percentages (`0.2` = 20%), USD costs per unit, and expected units for the same campaign period. Expected quantities can be fractional and are capped by inventory.

Missing optional costs/rates default to zero, minimum discount to zero, maximum to one, reference step to 0.05, and allocation weight to one. These defaults produce warnings; edit the CSV and re-upload to supply actual costs. Text defaults: name = SKU, category = Uncategorized, priority = P3. Unknown product columns are flagged and excluded. Field mapping is explicitly deferred: use the template's exact headers.

Must-promote CSV columns: `SKU,Minimum_Discount,Maximum_Discount,Exact_Discount,Preferred_Discount`. Only SKU and at least one rule value per row are needed; unused rule cells can be blank. Legacy `SKU,Minimum_Discount,Preferred_Discount` lists still work. Unknown headers/IDs, duplicates, malformed records, and invalid rates are rejected. Syntactically valid conflicting hard rules are loaded and explained as infeasible rather than silently rewritten. Uploading a list replaces custom commitments, never file rules.

Imports are limited to 5 MB / 10,000 rows. Export uses local browser Blob downloads and escapes spreadsheet formulas. Recommendations are exported at full precision; rounding them can change goal feasibility. Extra order discounts remain a separate Advanced Mode assumption and are not included in the chart's overall product discount percentage.

## Advanced Mode and modeling limits

Advanced Mode retains gross/contribution profit, margins, per-SKU financial analysis, editable allocation weights, stress inputs, scenario snapshots, original ordered cumulative frontier, and exact continuous objectives. Simple Mode's recommendation uses a separate explicit policy to reduce discretionary discounts; it does not claim to maximize future sales or economic profit. The advanced optimizer retains its original weighted-discount or contribution-profit objectives, with custom hard rules adapted into bounds before calling the unchanged engine.

Fixed demand only; no elasticity, demand lift, checkout integration, tax, fixed overhead, multi-currency, full returned-sale refund accounting, or saved campaigns. One representative single-SKU order per unit. Loss-making products can remain in an overall safe campaign. Preferred discounts may be missed. Continuous fractions are supported; discrete `Step_Discount` remains reference-only. Real-browser visual/accessibility QA was unavailable; jsdom tests cover interactions, not rendered layout.

## Source layout

- `src/engine.ts`, `src/csv.ts`: unchanged Phase 1 financial/optimization engine and base CSV implementation.
- `src/planner.ts`: new rule adapter, recommendation policy, statuses, warnings, extended list parser, defaults, and chart path.
- `src/App.tsx`: shared campaign state and Advanced dashboard.
- `src/MerchantView.tsx`: Simple workflow and shared rule management.
- `src/*.test.ts*`: original regressions plus Phase 2A policy and UI tests.
- `docs/`: methodology, initial audit, validation, Phase 2A product rules, release notes.
- Original eight root fixture files: preserved byte-for-byte and SHA-256 checked by tests. `public/demo-skus.csv` remains a data copy.
