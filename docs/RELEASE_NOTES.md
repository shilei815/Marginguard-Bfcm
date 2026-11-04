# Phase 2D release notes — MarginGuard

- Rebranded the main interface, headline, browser metadata and download names for year-round promotion planning. Historical fixtures, phase documentation, repository and deployment identities are unchanged.
- One primary Upload Products workflow now prepares products, merchant tiers, hard/soft SKU rules, planned offers, cost-presence metadata and initial goal before committing a new campaign.
- Added the exact Simple product schema and a full Advanced template retaining legacy financial fields. Five-column uploads work; invalid required fields, rates, tier/rule conflicts, malformed files and stale uploads cannot partially replace campaign data.
- Added Cost Data Complete / Some Costs Missing, explicit zero-versus-omitted tracking, reversible zero-cost confirmation and local quality reports. Missing-cost plans remain clearly labeled estimates rather than definitive safety guarantees.
- Moved standalone tier/rule CSV uploads into Advanced Import Tools. Planned offers stay distinct from soft targets; merchant Tier 1 never maps to legacy P1.
- Validation: 188 tests, production build, and 98 Chromium layout/state checks. Financial engine, recommendation methodology, base CSV contract and eight reference fixture files are unchanged.
- See PHASE_2D.md for precise mappings, defaults, transaction behavior and remaining beta gates. No merge, deployment, production-setting change, backend or paid service was introduced.

# Phase 2C release notes

- Added Protect Your Important Products with Must Promote (Tier 1), Important (Tier 2), and Flexible (Tier 3), kept separate from legacy P1/P2/P3 file rules.
- Added bulk assignment, editable tier defaults, independent product overrides, tier changes/removal, and a separate validated tier CSV import/template/export workflow.
- Improve My Plan now recovers profit from Tier 3 → 2 → 1 when tiers are used. Hard rules and profit goals dominate soft targets. Below-target current offers are not automatically raised.
- Added target-preservation counts, explicit target/hard-rule outcomes, reasons for changes, and detailed recommendation exports. Advanced Mode exposes effective bounds and separate file/tier semantics.
- Original financial engine, previous policy and CSV modules, all 88 previous tests and eight fixture files remain unchanged. Every new suggested plan receives independent full financial and per-SKU hard-bound validation.
- Validation: 143 tests, production build, and 68 real Chromium layout/state checks. No merge, deployment, paid service or production-setting change.
- See PHASE_2C.md for precedence, policy limitations, browser QA scope and remaining beta release gates.

# Phase 2B release notes

- Corrected the actual four-step workflow order on desktop and mobile.
- Fixed Advanced page overflow with shrinking grids, wrapping controls, internal table scrolling and a usable mobile navigation menu. Charts scale to their containers.
- Replaced the empty chart for unchanged safe plans with a clear profit/goal message; hard-rule violations never receive an all-clear.
- Added consistent USD cents and display-only input rounding without changing saved precision or CSV values.
- Added unique affected-product counts, grouped expandable diagnostics, and a primary explanation for infeasible goals.
- Moved the repeated campaign safety-buffer control from SKU rows to one place in Scenario Builder.
- Preserved all financial calculations, recommendation/optimization policies, CSV contracts, original fixtures and production settings.
- Verified 88 unit/UI tests, production build, and 55 headless Chromium layout/state checks across six widths. Physical-device and assistive-technology QA remain outside this verification.

# Phase 2A release notes

- Simple Mode now opens by default with Upload Products → Set Discounts → Check Profit → Improve My Plan.
- Clear profit-after-variable-costs cards and plain-English risk statuses explain whether your goal and optional safety buffer are met. Fixed overhead and taxes are visibly excluded.
- Large warning lists are replaced by a compact, expandable summary grouped by issue, category, and product.
- Must-Promote products support independent exact, minimum, maximum, and non-guaranteed preferred discounts. Select multiple products for bulk rules or special offers, or upload a list.
- Improve My Plan offers deterministic, verified recommendations and a before/after comparison without assuming extra demand. Conflicting goals never produce an apply action.
- The simple chart shows the current-to-suggested adjustment path with explicit sales weighting and profit/break-even markers.
- Advanced Mode retains financial details, continuous objectives, editable allocation weights, stress assumptions, scenario snapshots, and the original cumulative chart. View switching preserves campaign inputs.
- New product uploads initialize an explained, editable goal from their own baseline; synthetic demo dollar floors no longer carry into merchant data.
- Financial engine, original CSV implementation, and all eight reference fixtures are unchanged. No Cloudflare setting, production branch, deployment, backend, or paid service is changed.

Limitations: browser visual/accessibility QA was unavailable; CSV field mapping, demand response, saved campaigns, and discrete checkout rounding remain outside this phase. See PHASE_2A.md for policy details and browser QA steps.
