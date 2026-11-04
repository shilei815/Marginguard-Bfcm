# MarginGuard beta-1 known limitations

November 3, 2026. This beta uses fixed expected sales and supplied financial
inputs. Passing a modeled goal is not final accounting profit or a guarantee.
See the [audit](BETA_RELEASE_AUDIT.md) for executed tests and evidence.

## Release findings

P0 = must close before public beta. P1 = should fix before or during beta.
P2 = can defer. Stage 3A fixed only the reproduced P0 disclosure defect. Stage 3A.1 additionally
prepares the explicitly authorized P1-02 contrast remediation on
`fix/beta-accessibility-contrast`; it does not merge or deploy the RC.

| ID | Priority | Status | Finding / recommended action |
| --- | --- | --- | --- |
| P0-01 | P0 | RESOLVED | Rounded displayed offers could be mistaken for verified full-precision rates. Added checkout-rounding warning in both recommendation workflows; arithmetic/export unchanged. Revalidate actual checkout rates. |
| P0-02 | P0 | NOT VERIFIED — release hold | Cloudflare's current Production branch, automatic deployment triggers and preview isolation are unknown. Record read-only owner/dashboard evidence and review preview before authorizing public release. GitHub default `main` does not establish hosting settings. |
| P1-01 | P1 | OPEN | npm reports development-only Vitest/mocker/tinypool advisories, including critical severities. Review compatible upgrades separately; isolate build/test environments and do not expose development servers. Production-only audit reports zero known vulnerabilities at audit time. |
| P1-02 | P1 | REMEDIATED ON FIX BRANCH — pending merge | Stage 3A.1 darkens shared secondary text, chart paint, control/focus boundaries and disabled labels. Caption contrast improves from 3.09:1 to 6.21:1 on white; helper copy reaches 5.63:1 on pale green. 33 new contrast regression tests and 101 Chromium layout/state checks pass. Evidence in the audit; no full WCAG conformance claim. |
| P1-03 | P1 | NOT VERIFIED | Physical Safari/iOS/Android, Firefox, screen readers, full keyboard coverage, touch/virtual keyboard and zoom/OS scaling. Perform representative manual checks; Chromium emulation is not a substitute. |
| P1-04 | P1 | NOT VERIFIED | Real-merchant input reconciliation and usability acceptance. Review representative data privately with its owner, including returns, fees, per-unit allocations and cost completeness. Do not treat synthetic fixture success as commercial validation. |
| P2-01 | P2 | OPEN | Bulk tier assignment of a previously unassigned literal `__proto__` SKU does not retain an own assignment. No global prototype change was observed; unified tier CSV mapping works. Avoid that literal ID for bulk assignment; add a dictionary regression fix in later maintenance. |
| P2-02 | P2 | NOT VERIFIED | Parser/preflight accepts 10,000 rows and >4 MB, but full interactive performance on low-memory/mobile devices at that limit is not certified. Start beta with smaller files and measure responsiveness. |

The remaining P0 is an operational verification gate, not permission to alter
hosting or deploy. The release owner must explicitly disposition P1 findings and
unverified coverage. No open P0 financial arithmetic or recommendation hard-rule
violation was found in the reviewed/tested scope.

## Financial and planning limits

- Expected sales units do not respond to discounts. There is no elasticity, demand lift, sales forecasting or market evidence in the demo.
- USD only. No sales tax/VAT, multi-currency conversion, fixed overhead, capital costs or final accounting net-profit calculation. Missing optional variable costs count as zero until supplied; reported profit may be overstated.
- Returns model incremental expected costs only, not refunded sale revenue, lost inventory value, fee refunds or complete return cash flows.
- Fixed payment fees and shipping/fulfillment inputs are per unit under a representative one-item-order model. Multi-item order fees, shipping thresholds and platform-specific stacking must be checked outside the app.
- Recommendations use continuous rates. Whole, 0.5pp and 0.1pp rounding can all violate minimum/maximum/exact offers or goal plus buffer. No rounding-safe discrete optimizer or checkout integration exists. Re-enter actual rates and review every hard warning before launch.
- Financial arithmetic uses JavaScript floating point without platform-specific cent rounding per transaction. Internal hard-rate comparisons tolerate 1e-9 and profit verification 1e-7 USD; display formatting does not rewrite stored rates. Export precision does not certify checkout feasibility.
- Portfolio goal compliance can coexist with individual loss-making products. Soft targets can be missed; Tier 1 alone is not an exact lock. Targets do not automatically increase offers.
- The Advanced weighted-discount objective maximizes the stated weighted continuous discounts; it does not maximize future sales. The Simple recovery policy is deterministic protection/recovery, not a global demand or discrete optimization claim.
- The full Advanced discount path can extend past the profit goal. Fractional crossing steps are interpolated boundaries, not time or a uniform storewide percentage. Merely touching the threshold at the last point is not a crossing below it.

## Data and operational limits

- The Simple template includes optional columns in addition to its five required fields. The Advanced template's blank cost examples must be filled or deliberately confirmed zero.
- “Cost Data Complete” verifies input presence/confirmation only, not accuracy or full business-cost coverage. Confirmation changes metadata, not calculations.
- CSV columns must use the supplied names; no automatic mapping. Unknown product columns are warned and excluded. Structural errors reject the whole import. Valid but financially infeasible campaigns and valid-rate planned offers outside hard bounds load for review with warnings.
- A new product upload resets campaign controls, tiers/rules, snapshots, stress assumptions and buffer; imported values take effect. Mode changes preserve state. Refresh closes the in-memory campaign. There is no database, account, autosave or browser persistence.
- Exports are local review artifacts, including manual plans with warnings. Not all report formats are product-import formats. Formula escaping may prefix dangerous identifiers with an apostrophe; do not assume arbitrary report round trips preserve identifiers.
- Data is local to the running browser, but downloads, shared screenshots, extensions, device access and hosting access logs need separate care. There is no security/legal certification or guarantee.
- No deployment, hosting-header inspection, production smoke test or rollback exercise has occurred in this audit. No paid services or new infrastructure are required by this candidate.


## Contrast remediation coverage and remaining limits

Stage 3A.1 verifies normal text at 4.5:1, large text at 3:1 and relevant control,
chart and focus marks at 3:1 in the measured Simple/Advanced states. This includes
white, pale green, warning and inactive-control surfaces. Color-only presentation
changes preserve financial behavior, hierarchy, responsive layouts and native
disabled/range semantics. See the audit's before/after table and reproducible
checks. Remaining P1-03 checks are still required: these contrast results do not
certify screen-reader usability, all keyboard interactions, browser/OS native
control paints, forced colors, zoom behavior or full WCAG compliance. The fix
branch must be reviewed and merged separately before it changes `release/beta-1`.
