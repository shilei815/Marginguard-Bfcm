# MarginGuard beta-1 release audit

Audit date: November 3, 2026 (America/Los_Angeles). Feature freeze enforced.
Release branch: `release/beta-1`, created from verified development commit
`ec278cc46f04fcf244c7438f4c3b0fd1562d9cc5`. The audit commit is the commit adding
this report; obtain its exact SHA with `git rev-parse release/beta-1`.

**Recommendation: CONDITIONAL GO for a clearly labeled, limited merchant beta.**
The automated behavioral checks pass after one disclosure fix. This is **not approval
to deploy**: the current Cloudflare Production branch, preview/production mapping,
and owner release acceptance remain unverified. Keep the release candidate frozen
until those operational gates are closed. Accessibility and development-tool
findings require owner triage; do not advertise WCAG conformance or cross-browser
certification. No merge, production deployment, settings/default-branch change,
domain registration, paid service, or new product feature was performed.

## Release gates

PASS means the stated scope was actually checked; FAIL means a confirmed gap;
NOT VERIFIED means no supporting test/access was available. P0 must be resolved
before public beta, P1 should be addressed before or during beta, P2 can defer.

| Gate | Result | Priority / evidence |
| --- | --- | --- |
| All six development phases retained | PASS | Complete, non-shallow nine-commit history reviewed; every phase tip is an ancestor of RC base. |
| Feature freeze / original data / model preservation | PASS | Only disclosure source changes; eight original SHA-256 checks pass; engines and CSV algorithms unchanged. |
| Financial definitions and independent reference cases | PASS | Literal hand-worked expectations in `src/beta-audit.test.ts`; formulas below. |
| Hard-rule and goal-plus-buffer recommendation validation | PASS | Feasible/infeasible cases, legacy P1 locks, tiers, exact/min/max, independent final verification. |
| Rounding never changes feasibility | FAIL | Deliberate continuous-model limitation; every tested increment can invalidate constraints. Not a discrete optimizer. |
| Checkout-rounding disclosure at recommendation actions | PASS | P0-01 fixed; regression failed before wording fix and passes in both modes afterward. |
| CSV contracts, cost quality and structural rollback | PASS | Original suites plus boundary, 10-case rollback and security audit tests. |
| Runtime data locality / static operation | PASS | Source inspection and Chromium: no unexpected external page requests or runtime errors in tested states. |
| Secret and private-data review | PASS | No credential-pattern matches in 262 historical file versions and production artifact; tracked SKU fixtures are explicitly synthetic. Limited pattern scan, not an absolute guarantee. |
| Production dependency advisory scan | PASS | `npm audit --omit=dev --json`: 0 known vulnerabilities at audit time. |
| Development dependency advisory scan | FAIL | P1-01: 3 affected dev dependency nodes, including critical advisories; see scope below. |
| Chromium responsive workflows / sampled keyboard / named controls | PASS | 100 layout/state checks at six widths; sampled native keyboard events; 45 inspected Advanced AX controls named. |
| Caption text contrast | PASS on fix branch | P1-02 remediated in `fix/beta-accessibility-contrast`, pending review/merge into RC. Evidence and limits below; not full WCAG conformance. |
| Physical Safari/iOS/Android, Firefox, screen readers | NOT VERIFIED | P1-03: no physical devices, Firefox or assistive-technology testing performed. |
| Real merchant financial input / usability acceptance | NOT VERIFIED | P1-04: synthetic data and worked cases are not merchant acceptance or a sales forecast. |
| Cloudflare current Production branch / preview isolation / hosting headers | NOT VERIFIED | P0-02 operational hold: no Cloudflare read connector/configuration available; requested owner confirmation. GitHub default `main` is verified and is not evidence of Cloudflare's branch. |
| Production rollout and rollback execution | NOT VERIFIED | Intentionally not executed; follow deployment runbook only after separate approval. |

The rounding-invariance FAIL is an exposed limitation, not a failed arithmetic
implementation. The P0 fix prevents full-precision feasibility from being presented
without a checkout-rounding warning. Users must revalidate actual checkout offers.

## History and integration review

GitHub branch fetch and ancestry review confirmed this uninterrupted chain:

| Phase / draft PR | Head branch | Reviewed tip | PR base |
| --- | --- | --- | --- |
| Phase 1 / [#1](https://github.com/shilei815/Marginguard-Bfcm/pull/1) | `phase-1-browser-planner` | `004fa15` (includes implementation `1a40f7d`) | `main` |
| Phase 2A / [#2](https://github.com/shilei815/Marginguard-Bfcm/pull/2) | `phase-2a-merchant-ux` | `445d78d` | `phase-1-browser-planner` |
| Phase 2B / [#3](https://github.com/shilei815/Marginguard-Bfcm/pull/3) | `phase-2b-ux-polish` | `caf9a01` | `phase-2a-merchant-ux` |
| Phase 2C / [#4](https://github.com/shilei815/Marginguard-Bfcm/pull/4) | `phase-2c-priority-tiers` | `207540a` | `phase-2b-ux-polish` |
| Phase 2D / [#5](https://github.com/shilei815/Marginguard-Bfcm/pull/5) | `phase-2d-unified-import-branding` | `ce823e2` | `phase-2c-priority-tiers` |
| Chart polish / [#6](https://github.com/shilei815/Marginguard-Bfcm/pull/6) | `polish-advanced-chart-language` | `ec278cc` | `phase-2d-unified-import-branding` |

Connected GitHub metadata confirmed all six PRs **open, draft, unmerged** on the
audit date. CLI GraphQL PR listing was forbidden; the connected read-only GitHub
tools provided PR refs/status and repository metadata instead. `main` remains
`99b12e9` and contains the original fixtures, not the application. All six phase
tips are ancestors of `ec278cc`; the original financial/base CSV modules have not
changed since Phase 1 and the rule engine has not changed since Phase 2A. Retained
UI behavior is exercised by all 188 original tests and the full browser suite.
This is evidence against regression, not proof that every possible interaction
has been tested.

Do not merge the chained drafts into each other: an intermediate branch might be
connected to Production. Recommended future strategy is to review the incremental
PRs in place, then use one cumulative `release/beta-1` → `main` integration PR
with a merge commit preserving ancestry, once the owner has verified hosting
triggers and approved integration/deployment. The old drafts can then be closed
as superseded with release references, without duplicating their commits. None of
those PR changes or merges is part of this audit. See [runbook](DEPLOYMENT_RUNBOOK.md).

## Independent financial validation

For quantity `q = min(expected units, inventory)`, the original model computes:

- Discounted sales revenue `R = price × (1 − product discount) × (1 − order discount) × q`.
- Gross profit `G = R − unit COGS × q`.
- Profit after variable costs / contribution `C = G − R × payment fee rate − q × (fixed payment fee + fulfillment + shipping + extra shipping + other variable cost + (return rate + return shock) × cost per return)`.
- Portfolio profits are summed; portfolio margins divide summed profit by summed revenue. Zero revenue has undefined margins.

“Net revenue” here means sales after modeled discounts. It is **not** accounting
net revenue after returned-sale refunds, tax or all allowances. Returns add only
incremental expected return cost; they do not reverse sales revenue or refund
payment fees. The fixed fee is allocated **per unit**, using the original
representative one-item-order assumption. A safety buffer increases the required
profit threshold; it is not deducted as an operating cost. Baseline uses no
promotional or stress discounts but retains the SKU's supplied operating costs.
No quantity changes with discount. Combined return probability above 100% is
rejected. Gross profit and contribution are not final accounting net profit.

Independent SKU A: $100 price, $40 COGS, expected 10 / inventory 8; 3% fee,
$0.30 fixed payment fee, $2 fulfillment, $4 shipping, $1 other variable cost,
10% returns at $10 incremental cost. The non-percentage variable bill is
`8 × (0.30 + 2 + 4 + 1 + 1) = $66.40`.

| Case | Units | Revenue | Gross profit | Payment percentage fee | Contribution |
| --- | ---: | ---: | ---: | ---: | ---: |
| No discount | 8 | $800.00 | $480.00 | $24.00 | $389.60 |
| 20% product offer | 8 | $640.00 | $320.00 | $19.20 | $234.40 |
| 20% product + 10% order; $2 extra shipping; +5pp returns | 8 | $576.00 | $256.00 | $17.28 | $152.32 |
| 100% product offer | 8 | $0.00 | −$320.00 | $0.00 | −$386.40 |

For the stress row, the non-percentage bill becomes $86.40. Stacking is sequential:
20% plus 10% gives 28% combined, not 30%. SKU B independently has $50 price,
$20 COGS, four units, no variable costs, 10% discount: $180 sales / $100 profit.
A at 20% plus B gives $820 revenue, $420 gross and $334.40 contribution; margins
are `420/820` and `334.40/820`, not mean SKU margins. Zero inventory produces
zero totals. These literal expected values are asserted without calling engine
helpers to generate expected amounts.

Three separate $100-price / $20-cost / one-unit SKUs each at 40% offer yield
$120 contribution. With Tier 1 A, Tier 2 B, Tier 3 C, 30% soft targets and a
$170 goal plus $10 buffer, the verified suggestion is A 40%, B 20%, C 0%:
$180 contribution. Tier 3 is exhausted before Tier 2; Tier 1 stays protected.
A $240 goal plus $1 buffer is impossible even with no offers and returns no
suggestion. Separate checks reject exact/min/max conflicts and financially
adequate plans that violate hard rules. Legacy P1 remains locked at its effective
required offer; P2/P3 stay adjustable under the original advanced ratio ordering.
Merchant tiers never silently become legacy P1. Valid explicit exact rules can
raise the P1 effective requirement within file caps.

Existing fixture replay reconfirms all six fully specified scenarios, all 16
legacy optimization adjustments, and all 21 cumulative inclusions. The seventh
infeasible-priority fixture lacks its modified constraints: the documented
ELE-001 +40pp reconstruction reproduces its totals but exceeds the original cap;
it is not evidence that those were the author's missing inputs. Independent
impossible-goal/bounds tests establish actual infeasibility. The original frontier
first breaches at step 8, HOM-005, $27,153.71 versus $27,590.74. This legacy
sequence differs intentionally from the current exact continuous optimizer.
Crossing tests preserve strict-below semantics: touching the goal at the final
point does not imply a later crossing; starting below returns step zero. No
frontier ordering, interpolation, coordinates or chart data was redesigned.

## Rounded checkout findings

Nearest-increment rounding was tested separately for 1, 0.5 and 0.1 percentage
points. A one-unit $100-price / $20-cost SKU has `C = $80 − $100d`.
Each reference below has a $5 safety buffer and a continuous optimum exactly at
the displayed goal-plus-buffer threshold:

| Increment | Continuous offer | Rounded offer | Goal + buffer | Rounded contribution | Shortfall |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1pp | 20.8% | 21% | $59.20 | $59.00 | $0.20 |
| 0.5pp | 20.4% | 20.5% | $59.60 | $59.50 | $0.10 |
| 0.1pp | 20.08% | 20.1% | $59.92 | $59.90 | $0.02 |

The same continuous rates as hard maxima are violated by those rounded rates.
Separate minimum examples 20.2%, 20.1%, 20.02% round down to 20% at their
respective increments, breaking minima. Exact requirements at those rates also
break. Tests check all four failure types for all three increments. Always
rounding down protects contribution but can break minima/exact locks; always
rounding up can break maxima/profit. Neither is a general safe rule.

**P0-01, resolved:** prior UI displayed one-decimal percentages and “goal met”
results without an adjacent rounding caveat. Two disclosure regression tests
failed before the fix. Added only a shared paragraph in Simple Step 4 and the
Advanced Scenario Builder: displayed rates are rounded, recommendations/CSV keep
precision, and actual checkout rates must be re-entered and all warnings checked.
No offer, export, tolerance or optimizer changed; no discrete engine added.

## CSV and cost-quality audit

| Input case | Result / behavior |
| --- | --- |
| Five required fields / downloadable Simple template | Accepted; optional template columns are not mandatory. |
| Advanced template with supplied variable costs | Accepted; all 21 cost cells across three rows marked supplied. Blank example costs are intentionally incomplete. |
| Unified products + tiers + rules + planned offers | Accepted atomically; planned offers override category/storewide, targets remain soft. |
| Legacy product and promotion/tier files | Original tests pass; legacy P1/P2/P3 meanings preserved. |
| Missing costs / blank versus explicit zero | Missing costs count as unconfirmed zero; explicit zeros are supplied. Positive inputs and confirmations recorded separately. |
| Invalid rates, duplicate products/headers, missing fields, malformed rows, conflicting bounds/exact, invalid planned rates | Rejected; old campaign preserved. |
| Unknown product columns | Accepted with exclusion warning; not silently included in profit. Unknown standalone tier/rule headers reject. |
| Valid planned rate that violates a hard rule | Retained for review, warned; not silently certified or corrected on upload. |
| Valid but financially infeasible data | Accepted for repair; no apply action for an unavailable recommendation. |
| Large supported file | 10,000 unique SKUs, >4 MB and <5,000,000 bytes, parsed/preflighted successfully. 10,001 rows rejected. Full 10,000-row interactive UI responsiveness is not certified. |
| Failed-import rollback | New UI matrix covers eight structural failures plus oversized and unreadable file; exported campaign stays identical, tiers/source/cost confirmation retained. Earlier tests cover shared-mode state and import races. |
| Formula-looking export values / HTML-looking import text | Six spreadsheet prefixes escaped; HTML-looking names rendered as text without executable elements. |

UI file-size guard uses bytes (`File.size > 5,000,000`); pure parser also limits
string length. All parse/resolve/financial preflight operations finish before the
campaign setter; structural throws cannot partially commit any campaign layer.
Unknown optional inputs, default maxima/reference steps/weights and missing costs
remain explicit assumptions. “Cost Data Complete” means modeled inputs were
supplied or confirmed zero, not verified cost accuracy or a profitability promise.
Confirmation never changes the numerical result. Exports retain completeness
metadata; manual exports are review artifacts even if hard warnings remain.

## Security, privacy and dependencies

Source review of application imports, event handlers, CSV output paths and static
entrypoint found no financial-data HTTP client, runtime external asset, analytics,
backend, database, account, persistence or secrets configuration. File reads and
calculations stay in browser memory; downloads use local Blob URLs. React escapes
imported strings; no application `dangerouslySetInnerHTML`, HTML injection or
merchant-supplied code execution path was found. CSV exports use Papa Parse's
`escapeFormulae: true`, covering `=`, `+`, `-`, `@`, tab and carriage-return prefixes.
This is spreadsheet hardening, not a guarantee for every spreadsheet/import setting.

Tracked history comprises synthetic reference data, application code and docs, not
known private merchant inputs. A high-confidence private-key/AWS-key/GitHub-token
pattern scan of 262 historical file versions and built artifacts returned no
matches. No `.env`/credential file is tracked; Vite needs no service secret. This
was source and pattern review, not penetration testing or proof no secret format
could ever be present. Hosting access logs, browser extensions, compromised
clients, downloaded reports and any future analytics are outside local-memory
privacy guarantees. Host configuration/headers and public network behavior remain
unverified because no deployment was performed.

Audit-time lockfile tooling: Node 24.19.0, npm 11.9.0, React/React DOM 19.3.1,
Papa Parse 5.7.0, Vite 7.3.7, TypeScript 5.9.3, Vitest 3.2.7. Lockfile not changed.
`npm audit --json` reports **0 low, 1 moderate, 0 high, 2 critical dependency
nodes** (not three unique flaws):

| Affected development node | Reported severity / advisories | Release assessment |
| --- | --- | --- |
| `@vitest/mocker` | Moderate: [GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9), [GHSA-qxg6-89mg-rqv8](https://github.com/advisories/GHSA-qxg6-89mg-rqv8) | Test server/mock registration attack surface; never serve this tooling publicly. |
| `tinypool` | Critical: [GHSA-5gmw-xhrv-c9v3](https://github.com/advisories/GHSA-5gmw-xhrv-c9v3), [GHSA-85c8-ppgw-ccpr](https://github.com/advisories/GHSA-85c8-ppgw-ccpr) | Prototype-pollution gadgets in worker/run options; untrusted build/test code remains a risk. |
| `vitest` | Critical via affected dependencies; mocker advisory also direct | Development-only aggregate severity, not evidence of shipped browser RCE. |

**P1-01:** schedule a separately reviewed compatible test-tool upgrade, rerun
all tests and re-audit; never use `npm audit fix --force` blindly during freeze.
Keep CI/build environments isolated, avoid production credentials, run trusted
commits, and expose neither Vite dev nor Vitest services to the public. These
packages are not runtime application imports. `npm audit --omit=dev --json`
reports **zero** production vulnerabilities, which is only an advisory-database
snapshot, not a security certification. No dependency upgrade was made here.

## Browser, accessibility and exact validation results

Executed for this release candidate:

- `npm ci --cache /tmp/marginguard-beta-npm-cache`: clean lockfile installation succeeded; dependency manifests unchanged. Plain `npm ci` first failed because this workspace could not create the default home cache; the writable temporary cache resolved that environment issue.
- `npm test`: **214 tests in 11 files passed** (21.01s final clean-install run), including all 188 earlier regressions and 26 new audit/disclosure checks.
- `npm run build`: strict TypeScript and Vite build passed, 42 modules (1.23s final Vite build); static `dist/` only.
- `CHROMIUM_NO_SANDBOX=1 npm run test:browser`: **100 layout/state checks passed**, Chrome/154.0.8037.57, widths 320, 375, 390, 430, 768, 1440. No runtime errors or external page requests observed. The no-sandbox flag was confined to the disposable test container, not a hosting instruction.
- Original eight SHA-256 fixtures unchanged. Public demo records match original SKU records; BOM/line endings differ, so the demo is not byte-identical.

The existing browser suite covers both modes, native product/tier uploads,
suggestion application, infeasible rules, cost confirmation, snapshot/export
precision, long labels and responsive overflow. Added browser checks exercise
Tab/Shift+Tab workflow links, Space warning disclosure, Enter Improve/Use Suggested
Plan and methodology disclosure, and ArrowRight frontier scrubber. The sampled
Advanced accessibility tree had **45 named controls, zero unnamed** among inspected
buttons/links/inputs. The existing warnings use native expandable details/status
and alert semantics, not a custom modal dialog. Screenshots of Simple desktop and
Advanced mobile/chart were visually inspected. This is sampled browser QA, not a
complete keyboard or assistive-technology audit.

**Historical Stage 3A P1-02 finding (remediated on the Stage 3A.1 fix branch):** the inspected chart caption was 12px, rgb(137,150,140) on white;
calculated contrast ≈3.09:1 falls below WCAG normal-text 4.5:1. Improve shared
secondary-text colors in a separate accessibility fix with visual regression
review. Do not claim accessibility compliance now. Physical Safari/Firefox,
screen readers, touch keyboards, zoom/full OS scaling, real merchant acceptance,
and production smoke/rollback were not performed.

**P2-01:** a separate local probe reproduced a narrow reserved-ID edge case:
`assignTier(emptyTiers(), ['__proto__'], 1)` does not retain an own assignment.
The global Object prototype remains unchanged; the product remains visibly
unassigned, and unified tier import uses its null-prototype map correctly. Defer
a regression-backed dictionary fix; for beta, avoid the literal SKU `__proto__`
when using bulk assignment. No change to the tier engine was made under freeze.

## Candidate changes and release hold

Only production-code change: static checkout-rounding disclosure in
`presentation.tsx`, used in `MerchantView.tsx` and `App.tsx`. Added two audit test
files, extended existing Chromium QA with sampled keyboard/AX checks, and added
these four beta documents. Original model, optimizer, CSV exports, original
fixtures, charts/data and Simple Current/Suggested chart are preserved.

Remaining P0: record Cloudflare's actual Production branch and deployment trigger
mapping, validate isolated preview against the pinned RC, and obtain the owner's
public-beta release decision. P1 findings and unverified browser/accessibility
coverage require explicit owner disposition; representative merchant acceptance
is still recommended before inviting merchants. No unresolved P0 arithmetic,
hard-rule recommendation, export-injection or import-transaction defect was found
in the reviewed/tested scope. See [known limits](BETA_KNOWN_LIMITATIONS.md),
[user guide](BETA_USER_GUIDE.md) and [deployment runbook](DEPLOYMENT_RUNBOOK.md).


## Stage 3A.1 — P1-02 contrast remediation

Prepared on `fix/beta-accessibility-contrast` from RC `3387e7f`. This evidence
applies to the fix branch; `release/beta-1` is not changed until a separately
reviewed merge. No production deployment or Cloudflare changes were performed.
The original Stage 3A test/security results above remain historical evidence.

The rendered audit covered secondary copy, captions, helper/placeholder text,
form descriptions, warnings, pale green cost/tier cards, table headers, priority
badges, SVG labels, meaningful chart marks and input/button boundaries in both
modes. It also checked disabled controls, selected mode/navigation indicators,
hover and visible keyboard focus. Pale surfaces were preserved. Shared muted text
is now `#4f665b`; control boundaries `#62796b`; the focus ring uses the existing
amber family at `#945424`. Profit accents remain MarginGuard green `#087b66`.
Warnings/loss text retain darker brown/red emphasis. Disabled controls keep native
`disabled` semantics and their not-allowed cursor, using readable opaque text on
an inactive gray-green fill instead of 40% opacity. Range tracks/thumb boundaries
are styled for visibility without changing native range input semantics.

WCAG sRGB relative-luminance ratios (unrounded values determine pass/fail):

| Representative component / actual background | Before | After | AA target |
| --- | ---: | ---: | ---: |
| Caption / white | 3.09:1 | 6.21:1 | 4.5:1 |
| Helper paragraph / complete cost card `#eef6ef` | 3.71:1 | 5.63:1 | 4.5:1 |
| Caption / warning panel `#fcfaf4` | 2.96:1 | 5.95:1 | 4.5:1 |
| Table header / `#f6f8f5` | 3.14:1 | 5.81:1 | 4.5:1 |
| P1 badge / `#f8efe5` | 3.37:1 | 5.38:1 | 4.5:1 |
| P2 badge / `#eaf2ec` | 2.98:1 | 5.44:1 | 4.5:1 |
| Form boundary / white | 1.35:1 | 4.70:1 | 3:1 |
| Baseline category bar / white | 1.45:1 | 4.70:1 | 3:1 |
| Focus outline / white | 2.10:1 | 5.91:1 | 3:1 |

`src/contrast.test.ts` adds 33 automated regression cases using actual stylesheet
values for representative text, badges, status/disabled fills, all eight tested
surfaces, range tracks and control/focus boundaries. Normal text requires 4.5:1;
the browser audit permits 3:1 only for large text (24px, or 18.67px bold) and
relevant non-text marks. Inactive controls are contrast-exempt under WCAG, but
this fix deliberately improves and checks their text too.

`scripts/contrast-audit.mjs`, called from every existing browser layout/state
check, examines rendered HTML/SVG colors, inherited/translucent backgrounds,
placeholder text, chart marks, selected indicators and focus outlines. It asserts
thresholds by default. `CONTRAST_ALLOW_FAILURES=1` is for diagnostic before/after
auditing only, never an acceptance run. Decorative panel/table separators and SVG
grid lines are not treated as meaningful UI boundaries. Native OS dropdown,
checkbox rendering, forced-colors themes and all possible paint/compositing cases
are not certified by this scanner.

Verification: `npm test` → `npm run build` → `npm test` passed, **247 tests in
12 files on both runs**, including all 214 release-candidate tests. Production
build passed strict TypeScript/Vite checks. Chromium browser QA additionally
passed **101 layout/state checks** at 320, 375, 390, 430, 768 and 1440px, with
no recorded contrast failures across **48,485 sampled checks** (including 645
inactive-control samples), runtime exceptions or external page requests. The
lowest sampled text ratio was 4.62:1; control boundaries 4.24:1, meaningful chart
marks 3.75:1 and focus outlines 5.91:1.
Keyboard chart, disclosure and suggestion checks continue to pass. Desktop and
mobile screenshots were inspected. Financial engines, rules, CSV contracts,
exports, fixture datasets and dependency manifests are unchanged; TSX changes
only adjust SVG paint colors, never geometry, data or calculations.

P1-02 is remediated on this branch, pending review/merge. This is **contrast
remediation, not a full WCAG AA compliance claim**. Physical Safari/Firefox,
screen readers, comprehensive keyboard/zoom/touch testing and the other Stage 3A
release gates remain unverified or open as previously documented.
