# Current Phase 2D verification

188 tests pass: all prior 143 functional regressions retained (one headline expectation updated for the requested branding) plus 32 pure importer/quality tests and 13 UI tests. TypeScript and Vite production compilation pass. Chromium passes 98 layout/state checks at 320, 375, 390, 430, 768 and 1440px, including native unified/minimal imports, atomic rollback, cost confirmation without metric changes, shared modes, templates and earlier tier/financial cases. No document/body horizontal overflow, runtime exceptions or external page requests were recorded in tested states. Financial/recommendation engines, base CSV parser and all eight original fixture files remain unchanged. See [Phase 2D report, semantics and beta gates](PHASE_2D.md). Historical phase results below describe the verification available at their completion.

# Historical Phase 2C verification

143 automated tests (all 88 prior regressions unchanged plus 55 tier policy/CSV/report/UI tests), strict TypeScript and production build pass. Chromium passes 68 layout/state checks at 320, 375, 390, 430, 768 and 1440px, now including tier bulk assignment, native tier CSV import, shared-state preservation, and long tier IDs with conflicting rules. No document/body overflow, runtime exceptions, or external page requests occurred in tested states. The original engines, base CSV module and eight reference fixtures remain unchanged. See [Phase 2C methodology and beta gates](PHASE_2C.md). Older phase results below are historical.

# Historical Phase 2B verification

88 automated unit/UI tests and the TypeScript/Vite build pass. The 71 earlier regressions remain unchanged. An optional production-build Chromium harness passes 55 layout/state checks at 320, 375, 390, 430, 768 and 1440px, with no document/body horizontal overflow, runtime errors, or external page requests in tested states. Native synthetic CSV uploads, long/conflicting labels, menu navigation, identical-plan handling and export precision are exercised. Sample desktop/mobile screenshots were inspected. See [Phase 2B report and limits](PHASE_2B.md); older sections below record the verification available in earlier phases.

## Historical Phase 1 validation report

## Automated checks

- `npm test`: 37 tests in two suites (financial/CSV/fixtures/optimizer and React UI).
- `npm run build`: strict TypeScript check and Vite production build pass.
- Original references: SHA-256 verification confirms all eight original files are byte-for-byte unchanged, enforced by a regression test and `original-fixture-sha256.json`.
- No runtime network requests exist in application source; UI SKU/priority uploads tested with `fetch` stubbed to throw. No analytics, remote assets, backend, database, persistence, or API clients are used.
- Production artifact is static HTML/CSS/JS; no server runtime needed.

## Reference reconciliation

USD contribution and revenue are compared within half a cent plus floating-point epsilon; margins are compared at the five decimal precision published by the fixtures. No per-unit rounding is introduced.

| Scenario | Revenue | Contribution | Loss SKUs | Validation |
| --- | ---: | ---: | ---: | --- |
| BASE_NO_DISCOUNTS | 316,571.00 | 46,869.33 | 2 | Matches |
| PRIORITY_LOCKED_ONLY | 304,731.05 | 35,372.74 | 9 | Matches |
| OPTIMIZER_GREEDY | 296,985.35 | 27,851.66 | 13 | Matches sequence replay |
| STACK_10PCT_ORDER | 267,286.82 | -985.61 | 18 | Matches |
| SHIPPING_PLUS_5 | 296,985.35 | 6,001.66 | 16 | Matches |
| RETURN_RATE_PLUS_10PP | 296,985.35 | 23,095.86 | 13 | Matches |
| INFEASIBLE_PRIORITY | 302,491.05 | 33,197.70 | 10 | Target reproduced with documented reconstruction; original modified inputs unspecified |

All scenario floor flags and minimum-discount pass flags match. All 16 optimization intermediate contribution/margin values match. All 21 original cumulative frontier contribution/margin/breach values match. First breach: step 8, HOM-005, $27,153.71 contribution versus $27,590.74 floor.

The new continuous optimizer intentionally differs from the discrete greedy fixture. For the demo it consumes headroom to the $27,590.74 floor, with fixed P1 discounts and remaining bounds respected. Tests verify determinism, required minimums, impossible bounds/floors/IDs, soft preferences, zero crossings, a small exhaustive-grid objective check, and contribution-maximizing behavior.

## Boundary and UI coverage

Coverage includes BOM/CRLF CSV, quoted commas and escaped quotes, malformed rows, duplicate headers/SKUs, missing columns and financials, invalid numbers and rates, missing-cost warnings, inventory caps, zero revenue/inventory, contribution versus gross, stacked discounts, shipping/return shocks, priority list validation, export formula escaping, uniform/category/SKU precedence, filters, snapshot save/removal, failed-upload state retention, uploads without network calls, CSV download, and frontier range exploration.

React UI tests run in jsdom. Desktop/mobile layouts use responsive CSS breakpoints, semantic form labels, keyboard-compatible controls, visible focus styles, and scrollable tables. **No real browser, screenshot, or assistive-technology verification was available in this environment.** Live browser testing and merchant review of actual financial inputs remain recommended before operational use.

## Remaining scope limits

No demand model, discrete optimization, tax/multi-currency, overhead, full return/refund cash flow, checkout integration, scenario persistence, or deployment. Preferred discounts are reported soft targets. Unknown financial columns are warned and excluded until mapped into template fields. An infeasible allocation is shown only as a diagnostic and cannot be saved as an optimized snapshot. Manual previews can be exported despite warnings for review. Do not interpret an export as approval of violated constraints.

## Phase 2A validation

Phase 2A run at `445d78d`: **71 tests pass across four suites** (the 37 Phase 1 regressions plus 34 new policy/UI tests). `npm run build` passes strict TypeScript and Vite static production compilation. Phase 1 UI assertions are preserved with an explicit Advanced Mode setup; financial regression tests, `engine.ts`, `csv.ts`, and all eight original fixtures are unchanged.

Uniform 20% synthetic regression: $253,256.80 revenue, approximately −$14,608.76 contribution, 22 negative-contribution products. These values are computed from the original dataset, not inserted into application output.

New tests cover rule intersections and infeasibility, exact/min/max/preferred behavior, P1 locks, safety buffers, dataset-derived goals, deterministic recommendations, stress-aware before/after metrics, warning grouping, weighted chart semantics/zero crossing, mode-state preservation, bulk updates, uploads, local exports, and narrow-window presence of controls. See [Phase 2A methodology and browser checklist](PHASE_2A.md). No real-browser visual, layout, accessibility, or timed usability verification was available.
