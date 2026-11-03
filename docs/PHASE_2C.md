# Phase 2C — merchant promotion tiers

## Scope and preservation

Starts from Phase 2B commit `caf9a01` on `phase-2c-priority-tiers`. No production deployment, Cloudflare setting, source-branch merge, account system, payment service, database, forecasting, or hosting infrastructure is introduced. The eight original fixture files, `engine.ts`, `planner.ts`, `csv.ts`, and all 88 previous tests are unchanged. The new feature is isolated in `tiers.ts` and `TierControls.tsx` and uses the original financial calculations.

## Merchant workflow

In Step 2, expand **Protect Your Important Products → Assign products and set tier offers**. Choose products, select a tier, and apply it in bulk. Search includes SKU, product name and category; “select all matching” includes matching products beyond the visible scroll area.

- **Must Promote — Tier 1:** strongest soft promotion protection; changes last.
- **Important — Tier 2:** medium protection; changes after Tier 3.
- **Flexible — Tier 3:** discretionary discounts change first.

Unassigned products are treated as Flexible during tier-aware recovery, but are not counted as assigned Tier 3 products in target reports. New tiers start neutral: 0% target, 0% minimum, 100% maximum. These are disclosed configuration defaults, not invented financial inputs or recommended campaign offers. Only assigned products inherit them. Assigning a tier never changes current discounts or legacy file priority. Editing tier configuration while an Advanced allocation preview is active freezes its current discount vector into a manual plan before applying configuration changes; the merchant must explicitly run Optimize or apply a new suggestion to change offers. Mode switching alone never changes this state. Set actual planned offers through the existing storewide/category/product controls; targets are preservation preferences, not an automatic “apply offer” action.

Tier defaults update all assigned products that have not overridden that field. Individual target/minimum/maximum overrides are independent; a blank field inherits the relevant default. Changing a tier keeps explicit tier overrides. Removing a tier clears that assignment and its tier overrides, while product-file and explicit promotion rules remain. Invalid defaults that are not used by any assigned product show a form explanation but do not affect campaign feasibility. Used invalid settings produce an infeasible recommendation until corrected.

The existing Must-Promote checkbox/button remains a legacy explicit-minimum action, now explained as distinct from merchant tiers. Exact/minimum/maximum/preferred SKU rules remain under **Exact offers and additional hard rules**. Tier 1 itself never means an exact lock.

## Deterministic precedence

| Layer | Behavior |
| --- | --- |
| Product-file hard bounds | Always honored; never overwritten by merchant tiers. |
| Explicit SKU hard rules | Minimum, maximum and exact offers remain in force. |
| Tier hard values | Each field uses its SKU tier override when supplied; otherwise the assigned tier default. |
| Effective hard bounds | Intersect all three layers. A contradictory intersection is infeasible; no rule is silently rewritten. |
| Soft preference for recovery | An explicit SKU `Preferred_Discount`, when present, replaces the tier target for within-tier soft protection. Otherwise use the tier target. |
| Tier target reporting | Always report the configured tier target independently, including when an explicit preferred offer takes precedence. Both unmet preferences are explained. |

The tier target must lie between its own resolved tier minimum and maximum. It can be outside a stronger file or explicit-rule cap: this is an unreachable **soft** target, reported with a warning rather than permission to weaken the cap. A tier hard minimum above the effective cap is a hard conflict and yields no suggestion. A tier minimum below a stronger file minimum cannot weaken the file rule.

Original P1/P2/P3 is stored on `SKU.priority`; merchant tiers use a separate typed assignment map. Legacy P1 remains fixed at its effective required minimum. As with an explicit SKU minimum in Phase 2A, a new hard tier minimum can strengthen that requirement within the file cap. A tier **target alone** cannot raise it, and a conflicting hard minimum is rejected. For example, a P1 product with a 20% required offer and 25% file cap stays at 20% when assigned a 30% soft target; a 30% hard minimum is impossible. The original weights/P2/P3 classes are not rewritten.

## Tier-aware Improve My Plan

With no merchant assignments, the Phase 2A recommendation policy is retained exactly. When merchant tiers are in use:

1. Resolve all hard bounds, exact offers and legacy locks. Reject contradictions before generating discounts.
2. Calculate portfolio contribution at all effective minimums using the original engine and active stress costs. If it cannot reach minimum profit goal + safety buffer, return infeasible with no suggestion.
3. Correct the current plan into those hard bounds. Mandatory offers can require increases and therefore lower profit; these are explained.
4. Recover any remaining profit shortfall from Tier 3 / unassigned products, then Tier 2, then Tier 1. Exhaust a lower tier's discretionary capacity before changing a higher tier.
5. Within each tier, first reduce offers above their effective soft preferences; if needed, relax those preferences down to hard minimums **before moving to the next tier**. Explicit SKU promotional commitments receive secondary preference within the same tier. Within that grouping, higher contribution recovery per discount fraction comes first, with binary SKU ID ties.
6. Stop once the hard goal + buffer is met. Offers below a soft target are never increased solely to reach it, even if spare profit exists. No demand lift is assumed.
7. Independently recalculate the full campaign contribution and validate every proposed SKU against all resolved hard bounds. Required rates must be valid and every SKU present. Only a verified result is marked feasible. Financial computation errors become infeasible diagnostics rather than approvals.

The incremental contribution recovery coefficient remains `price × min(expected units, inventory) × (1 − extra order discount) × (1 − payment fee rate)`. Costs, fees, shipping and returns are evaluated in full by the original financial engine when verifying the final campaign. Bounds use the existing 1e-9 discount tolerance; portfolio feasibility uses 1e-7 USD. No repeated rounding is added.

This is an explicit deterministic business-priority policy, not an optimizer for future demand, actual sales, economic profit, number of edits, or target attainment in isolation. A feasible campaign may retain individual loss-making products. Targets and preferences are allowed to fail; exact and effective hard bounds are not.

## Advanced Mode

Tier state, rules, current offers, goal and buffer are shared across modes. Advanced tier controls show merchant tier, soft target, effective hard minimum/maximum, legacy data-file priority, explicit exact offer and the preferred offer used by the recovery policy.

The existing advanced continuous optimizer and ratio-ordered cumulative chart remain available with the same objectives. The adapter encodes all effective tier hard bounds into SKU constraints, then calls the unchanged engine. Advanced weighted-discount allocation does **not** use Tier 3 → 2 → 1 recovery ordering; its UI states that distinction. The tier protection summary proposes the tier-aware recovery from the current plan. Use Improve My Plan for tier-aware recommendations. Hard bounds and contribution are independently validated for advanced allocations too.

## Tier CSV contract

Standalone assignment format:

```csv
SKU,Priority_Tier,Target_Discount,Min_Discount,Max_Discount
ELE-004,1,0.10,0.05,0.15
HOM-004,2,0.10,0.00,0.10
ACC-004,3,0.10,0.00,0.10
```

Required headers: `SKU`, `Priority_Tier`. Tier must be exactly 1, 2 or 3. Optional discount cells/columns may be blank to inherit defaults. Percentages are decimals, never whole percent numbers. Required IDs must match loaded products; duplicate/unknown IDs, headers, invalid/nonfinite rates, malformed rows and used target/min/max inconsistencies reject the whole upload. Imported hard rules are checked against product-file bounds and explicit SKU rules before state changes. Existing assignments remain on failure.

The request's illustrative ELE-001 minimum of 25% conflicts with that synthetic product's 20% cap and is correctly rejected against this fixture. Use real loaded bounds, not a sample schema's illustrative numbers, when planning.

A successful tier import replaces tier assignments only; it retains tier defaults, current offers, explicit promotion rules, stress assumptions and goals. It does not upload merchant data to any service. The original 5 MB / 10,000-row limits and spreadsheet-safe export behavior remain. Existing product and promotion-rule CSV formats are unchanged.

**Export tier assignments** uses the same five-column schema and captures every assigned product’s resolved target/minimum/maximum at full precision. This is a portable snapshot: re-importing it restores those effective tier settings even under different defaults, without mutating the original live campaign’s inheritance. Supplied snapshot values become explicit SKU tier overrides on import; clear an override field to resume inheritance. Hand-authored CSV blanks still inherit current defaults. Product-file and explicit promotion-rule context must be loaded separately and is always validated.

**Export tier recommendations** is a separate detailed report, not an assignment-import format. It includes merchant tier, original file priority, target/effective preference, verified hard bounds, current/suggested discounts, current/suggested revenue and contribution, goal/buffer, target/hard-rule outcomes, feasibility and reasons. Failed suggestions leave suggested values blank and export `Suggestion_Feasible=false`. The original general plan export is unchanged. Outputs escape spreadsheet formulas and retain calculation precision.

## Reporting

Assigned-tier counts use actual configured target comparisons, never fixed demonstration numbers. A target is met when the suggested discount reaches or exceeds it within 1e-9. Current-plan target counts are shown separately. Target success is not hard-rule success or accounting net profit. Missing suggestions display unavailable outcomes, not a false target pass.

The summary shows goal-plus-buffer verification, adjusted-product count, and per-product current/suggested offers, tier, target, target outcome, hard-rule outcome, and explanations. Hard-cap corrections, hard-minimum increases, profit-recovery reductions, targets already missed by the current offer, soft-target relaxation and explicit-preference precedence have distinct text. Higher-tier missed targets receive a short explanation above expandable product details. All-clear protection wording requires a verified recommendation and all assigned target/effective-preference successes.

## Verification and beta readiness

Current automated verification: **143 tests** (all 88 previous tests unchanged, 40 tier policy/CSV/report tests and 15 UI tests), strict TypeScript/Vite build, and **68 headless Chromium layout/state checks** across 320, 375, 390, 430, 768 and 1440px. Browser checks include bulk tiers, native tier CSV uploads at each width, state preservation in Advanced Mode, native long-identifier tier uploads with conflicting hard rules, internal table scrolling, and all earlier layout/financial/export checks. No document/body horizontal overflow, runtime exceptions or external page requests were recorded in tested states. The unchanged synthetic 20% scenario still produces $253,256.80 sales, approximately −$14,608.76 contribution, and 22 losing products.

The optional `npm run test:browser` harness requires installed Chromium, with `CHROMIUM_NO_SANDBOX=1` only for a disposable container where the browser sandbox cannot start. It builds no backend into the product. Reports/screenshots are written to ignored `work/browser-qa/`. See PHASE_2B.md for the runner requirements.

### Remaining beta release gates

- Product/merchant acceptance review of representative real campaign inputs and cost completeness. Synthetic regressions validate arithmetic, not the accuracy of a merchant's assumptions.
- Merchant usability review of tier defaults/overrides, target-versus-hard-rule language, legacy P1 behavior, and fractional discount exports. A timed three-minute workflow has not been measured.
- Physical iOS/Android, Safari/Firefox, screen-reader, keyboard/zoom and virtual-keyboard checks. Automated Chromium viewport emulation is not a substitute for these.
- Confirm the live-campaign workflow for rounded checkout discounts: full-precision suggestions do not guarantee feasibility after rounding. Rounded actual offers must be rechecked in the existing manual planner before use.

### Known limits / deliberate deferrals

No persistence, account system, field mapping, checkout/platform integration, demand elasticity, AI forecasting, multi-currency, fixed-overhead/tax accounting, full return/refund cash flows, or discrete rounding-safe optimization. These are not introduced as beta infrastructure requirements. Tier targets are preservation preferences, not automatic offer increases. Tier defaults/assignments reset on product-data replacement or refresh, with all other fresh-campaign resets documented in README. No production changes are merged or deployed by this phase.
