# Phase 2B — UX refinement and responsive QA

## Review scope

Starts from `445d78d` on `phase-2a-merchant-ux`; changes are isolated to `phase-2b-ux-polish`. No changes to `engine.ts`, `planner.ts`, `csv.ts`, financial/optimization assumptions, data contracts, the original eight fixture files, production branch, or Cloudflare settings. All 71 Phase 2A tests remain intact.

## Visible changes

- The four workflow sections are in actual DOM and visual order: Upload Products → Set Discounts → Check Profit → Improve My Plan. They remain vertically ordered on desktop and mobile. Step navigation targets the corresponding section; Step 3 opens with its reactive KPIs.
- Advanced Mode collapses its desktop sidebar to an inline mobile Navigation menu, retaining all four analytical destinations. The menu closes after selection or Escape. Scenario Builder stacks above the analytical results on narrow screens. Grid children can shrink; long controls and labels wrap; wide tables scroll internally.
- Charts scale to their parent rather than requiring a 600px minimum width. Supporting HTML labels expose precise current/suggested profit even when chart text is small on mobile.
- A financially identical, rule-compliant Current/Suggested pair replaces the near-empty adjustment chart with “Your current discount plan already meets your profit goal. No changes are needed.” Current profit, minimum goal, and any buffer remain visible. Discount-vector tolerance is 1e-9; revenue/gross/contribution comparisons use 1e-7 USD. The original engine's validations/tolerances are unchanged. Any unresolved hard rule or buffered goal prevents an all-clear message. Different product discount vectors retain the detailed chart even when portfolio totals happen to coincide.
- Supporting financial labels, axes and tooltips use USD cents; headline KPIs can use whole dollars. Monetary inputs show practical two-decimal values, with six digits available for percentage displays. Formatting never writes values back into campaign state: focus, blur and mode switching preserve the original precision; explicit user edits are retained at their entered precision, subject to existing bounds. CSV exports retain numeric precision.
- Warning summaries distinguish warning count from unique products with product-specific warnings. Campaign-wide/input warnings are explained separately. Details group by issue type then category and retain every message. Infeasible plans show a short primary reason before expandable diagnostics, not a long repetitive list.
- The existing campaign-wide Advanced safety-buffer control appeared once per SKU row. It now appears once, correctly beside the profit floor in Scenario Builder. The underlying buffer value and calculations are unchanged.

## What caused the overflow

The Advanced single-column grid used an automatic minimum track size, allowing table/control min-content widths to expand the whole page. Long unbroken labels, no-wrap buttons, and category-chart names also contributed. Explicit `minmax(0,1fr)`, zero minimums on grid/flex children, wrapping labels/buttons, bounded form controls, and dedicated table scrollers address the causes. The fix does not set document overflow to hidden or remove analytical features.

The baseline Chromium measurement found Advanced document scroll widths around 1,347px at 320–430px viewports and 1,426px at 768px. These measurements used the unmodified Phase 2A UI. Stress testing then found additional long-label overflow, fixed before completion.

## Automated verification

- `npm test`: **88 tests pass**, including all 71 existing regressions and 17 new UX regressions.
- `npm run build`: strict TypeScript and Vite static production build pass.
- `npm run test:browser`: optional built-in Node/CDP test harness using an installed Chromium; no new npm browser dependency. It serves the production build on loopback for QA only, launches an isolated temporary browser profile under `work/`, and shuts down owned processes afterward. No test server is part of the application.
- **55 real Chromium layout/state checks** cover Simple/Advanced at 320, 375, 390, 430, 768 and 1440px. Cases include expanded disclosures, suggestions, applied identical plans, mobile navigation, advanced allocations, infeasible goals, native CSV uploads and very long product/category/SKU strings. All document and body widths fit the usable viewport; visible controls outside tables stay within it. No runtime exceptions or external page requests were recorded.
- Uniform 20% synthetic results remain approximately $253,257 sales, −$14,609 contribution, and 22 losing products. The browser harness also verifies byte-identical CSV exports before/after focus, blur and mode switching.
- Sample 375px and 1440px screenshots were inspected. The harness saves screenshots and its JSON report in ignored `work/browser-qa/`; generated browser profiles and test CSVs contain synthetic test data only.

| Requested viewport | Usable document width | Maximum document scroll width | Result |
| ---: | ---: | ---: | --- |
| 320 | 320 | 320 | Pass |
| 375 | 375 | 375 | Pass |
| 390 | 390 | 390 | Pass |
| 430 | 430 | 430 | Pass |
| 768 | 753 | 753 | Pass |
| 1440 | 1425 | 1425 | Pass |

At tablet/desktop emulation Chromium reserves 15px for its vertical scrollbar; scroll width is checked against `documentElement.clientWidth`, not just the larger outer emulated viewport. Tables may be wider than their own visible scroller, as intended.

## Reproduce browser checks

```sh
npm ci
npm test
npm run build
npm run test:browser
```

An installed `chromium` is required. Set `CHROMIUM_BIN` to another compatible Chrome/Chromium executable if necessary. In a disposable sandboxed container where Chromium's own sandbox cannot start, use `CHROMIUM_NO_SANDBOX=1 npm run test:browser`; keep the browser sandbox enabled on an ordinary machine. `BROWSER_CDP_URL` can point to an already running local CDP endpoint; that browser remains owned by its caller. The default run needs Node 22.12+ and permission to bind loopback ports. No dependency or browser download is performed by the script.

## Remaining verification limits

This is headless Chromium emulation, not physical iOS/Android device testing. Firefox, Safari, screen-reader behavior, touch/virtual-keyboard interaction, browser zoom, and a timed merchant usability study were not tested. Native file uploads and programmatic control interactions were exercised in Chromium. Existing financial-model limits remain as documented in FINANCIAL_MODEL.md and PHASE_2A.md. No deployment or merge was performed.
