# MarginGuard BFCM — Phase 1

A responsive, browser-only React + TypeScript + Vite discount profitability planner. No backend, database, analytics, external fonts, runtime API calls, or merchant data uploads. Nothing is deployed by this implementation.

## Run locally

Requires Node.js 22.12+ (tested with 24.19) and npm.

```sh
npm ci
npm run dev
```

Open the URL printed by Vite, normally http://localhost:5173. For verification:

```sh
npm test
npm run build
```

`dist/` is the static production output, suitable for a managed static host using `npm run build` and output directory `dist`. No hosting account, payment setup, environment variables, or deployment is needed. The UI works at the site root.

## Workflow

1. Start with the **synthetic demo** (30 fictional SKUs) or download the CSV template and upload your SKU inputs. All processing uses browser memory. Refreshing loses all changes and snapshots.
2. Review visible missing-field defaults and inventory-cap warnings. Replace missing costs in the CSV before using results to make decisions.
3. Choose manual uniform discounts, category overrides, or SKU overrides. Precedence: SKU → category → uniform. Manual scenarios deliberately allow out-of-bound offers for exploration and show constraint warnings. Dataset minimums always apply when checking feasibility.
4. Select or upload priority SKUs, with required minimums and optional preferred discounts. Uploaded lists replace the custom list, not the dataset minimums. A priority list alone does not change a SKU's P1/P2/P3 class.
5. Choose **Maximize weighted discounts** or **Maximize contribution profit**, set a contribution floor, and inspect allocation feasibility. P1 discounts are fixed at the greater of dataset/custom minimums during optimization. P2/P3 can increase within caps. Preferences are soft targets with unmet-target warnings, not a second objective.
6. Explore the cumulative allocation curve, category comparison, searchable SKU table, and scenario snapshots. Export SKU results as CSV. Snapshots are financial summaries, not reloadable full scenario configurations.

## Financial model and data contract

See [financial methodology](docs/FINANCIAL_MODEL.md), [repository audit](docs/REPOSITORY_AUDIT.md), and [validation report](docs/VALIDATION.md).

CSV headers follow the original fixture schema; percentages use decimal fractions (`0.2` = 20%), costs are USD per unit, and quantities may be fractional expected values. Required: `SKU`, `Regular_Price_USD`, `Unit_COGS_USD`, `Inventory_Units`, `Expected_Units`. Downloadable template includes all optional fields, including `Other_Variable_Cost_USD`.

Optional defaults, always surfaced in the UI: missing monetary variable costs and rates = 0, required discount = 0, maximum discount = 1, reference step = 0.05, allocation weight = 1, priority = P3, category = Uncategorized, name = SKU. Text-field defaults are labels rather than financial assumptions. Unknown columns produce warnings and are excluded. **No missing financial cost is inferred from merchant category or other data.** Re-upload a corrected CSV to configure defaults per SKU.

Priority CSV: `SKU,Minimum_Discount,Preferred_Discount`. Preferred is optional. Unknown/duplicate SKUs, bad numbers, malformed rows, duplicate headers, discount bounds outside [0,1], invalid rates, nonfinite or negative financial inputs are rejected. Required minimum above maximum produces an explicit infeasibility report when coming from the priority list (invalid dataset bounds reject the upload). Limit: 5 MB / 10,000 rows. Outputs escape spreadsheet formulas.

## Implementation layout

- `src/engine.ts`: pure validated financial calculations, scenario resolution, constraint checks, exact continuous optimizer, frontier crossing interpolation.
- `src/csv.ts`: parsing, validation, templates, local CSV download/export.
- `src/App.tsx`, `src/style.css`, `src/main.tsx`: responsive dashboard and browser interactions.
- `src/*.test.ts*`: financial, fixture, optimization, CSV, and UI regressions.
- `public/demo-skus.csv`: downloadable copy of the preserved fixture.
- Root original CSV/JSON/XLSX and `README` / `README.txt`: unchanged reference fixtures, never executed as application code. The UI reads the synthetic CSV as data only.

## Limits

Fixed expected sales; no demand-response model, inferred elasticity, multi-currency, tax, fixed overhead, full returned-sale refunds, checkout platform integration, or real-world forecasts. The optimizer has continuous discount bounds, so it can return fractions of a percentage point; reference `Step_Discount` is intentionally not enforced. Rounding an allocation can break the floor: the manual preview rechecks the rounded scenario. Monetary calculations retain floating-point precision; fixtures are compared at their published rounding precision. A portfolio floor can coexist with loss-making SKUs, which remain flagged. Import only data you trust to represent the relevant campaign window.
