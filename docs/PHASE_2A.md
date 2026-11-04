# Phase 2A product behavior, policy, and QA

## Scope and preservation

Starts at Phase 1 commit `004fa15` on a new `phase-2a-merchant-ux` branch. No production branch, Cloudflare setting, deployment, database, service, or paid dependency is changed. `src/engine.ts`, `src/csv.ts`, and the eight original fixture files remain unchanged. All original financial regression tests remain; the original eight UI tests now explicitly open Advanced Mode and its optimizer before exercising their existing assertions.

## Shared state and defaults

One App owns the product data, custom promotion rules, manual offers, chosen advanced objective/allocation, baseline goal, buffer, stress assumptions, weights, and snapshots. Mode switching only changes the rendered view. Search/filter selection and an open suggestion panel are view-local UI state, not campaign assumptions. An active advanced allocation is visibly labeled in Simple Mode. Editing storewide/category offers explicitly returns to manual planning; using a suggested plan installs its full-precision product overrides. Clear special offers removes category and product overrides.

Successful new product uploads and Load Demo start a fresh campaign: 10% storewide, no overrides or custom rules, goal = max(0, 0.5 × no-discount baseline contribution), buffer = 0, stress = 0. Failed uploads preserve the prior campaign. This goal is a disclosed, editable default, not a “safe” guarantee. Dataset promotional minimums may make even that goal unattainable; the application reports this honestly.

Baseline is no discounts and no extra stress costs. Dataset variable costs still apply. Current and suggested plans share active stress assumptions. The buffer is an additional profit requirement, not a modeled expense or overhead estimate. Simple Mode's visible exclusion text explains that profit after variable costs is not final accounting net profit.

## Status definitions

With tolerance 1e-7 USD:

- Losing Money: contribution < −1e-7.
- Profit Goal at Risk: otherwise, contribution < goal + buffer −1e-7.
- Profitable Plan: otherwise, contribution ≥ goal + buffer −1e-7.

Minimum goal and goal-plus-buffer achievement are shown separately. These are **financial statuses**; independent discount-rule warnings may still require correction. Missing-cost assumptions can invalidate the economic interpretation even when modeled profit is positive. Warnings are counted individually and collapsed by issue type → category → affected product; the count is not a count of distinct products. Types separate upper bounds, minimums, exact offers, file locks, conflicting rules, portfolio goal, individual losses, preferred targets, and missing/default input assumptions.

## Hard and soft rules

For each SKU, effective lower bound is max(file minimum, custom minimum); upper is min(file maximum, custom maximum). Exact discounts intersect both bounds with the exact value. P1 retains the original rule: fixed at the effective required minimum. New custom commitments retain their original P2/P3 class. Minimum > maximum, duplicate rules, unknown IDs, or invalid rates fail validation. No algorithm silently loosens a hard commitment. A preferred discount is a soft lower target: reaching or exceeding it counts as achieved. It may be below a stronger hard minimum without contradiction.

The shared rule editor adds/updates one rule type for the selected products while retaining their other rule types. Each type can be cleared separately. Removing a commitment clears custom rules only; file rules still apply. Marking products from the table creates a minimum equal to each current offer. This can conflict with file caps, which is explicitly diagnosed. Syntactically valid contradictory imported rules remain editable and are never called feasible.

## Improve My Plan — explicit deterministic policy

This policy is isolated in `planner.ts` and reuses unchanged `portfolio` / `line` calculations:

1. Intersect all hard bounds and P1 file locks. Reject contradictions before producing a suggestion.
2. Compute maximum achievable contribution at all required minima using current stress assumptions. Since demand is fixed and incremental discounts cannot increase contribution, a value below goal + buffer proves infeasibility. Return no suggested discounts.
3. Clamp current offers into hard bounds; exact/locked offers become fixed. Some mandatory offers may need to increase from the current preview. This can reduce profit and is required to honor commitments.
4. If additional profit is needed, reduce discretionary discounts. Non-custom products come before custom must-promote products. Within each group, larger contribution recovery per discount fraction comes first; ties use binary SKU ID order.
5. In the first pass do not reduce a preferred offer below its soft target (or the current offer if already below that target). In a second pass, if necessary, relax these preferences down to hard minimums, with explicit warnings. Hard exact/min/max and P1 locks remain intact.
6. Stop as soon as the buffered goal is achieved; no optional discount increases or demand lift are introduced. Recompute and verify final contribution. No feasible result is returned without passing this check. Before/after metrics and changed offers use the original financial engine.

This is a transparent recovery policy, not an optimizer for future sales, economic profit, lowest number of edits, or closest Euclidean distance. It may retain individual loss-making products to honor commitments. Preferences are not maximized and are not automatically increased when below target. Typical complexity is O(n log n). Full-precision fractional discounts are retained; rounding can break a hard goal.

## Simple chart semantics

“How Discounts Affect Your Profit” shows one line segment from the **current** plan to the policy's **suggested** plan. At t ∈ [0,1], each product's discount is current + t × (suggested − current), with quantity and extra stress inputs fixed. Both revenue and contribution are affine along this path. It is not an optimal Pareto frontier, nor a uniform-discount sweep. Only the suggested endpoint is verified against all hard rules; an invalid current plan and intermediate values may violate rules.

X = sum(base price × inventory-capped expected units × product discount) / sum(base price × inventory-capped expected units). The same base-sales weights are used at both endpoints. It is visibly labeled as sales-weighted, not uniform or a simple average. Extra order stacking is excluded from X and held constant in the financial calculations. Zero total base sales displays 0% with an explanation. Current/suggested points, minimum goal, goal + buffer, and break-even crossing (only when present on the path) are labeled. A constant-profit path has no isolated break-even crossing. Infeasible recommendations show an explanation instead of a fabricated suggested curve.

Advanced Mode retains the Phase 1 ratio-ordered cumulative path, separate from the simple current-to-suggested trajectory. Its effective floor includes the buffer. The original continuous optimizer itself is unchanged; the adapter supplies the intersected SKU bounds.

## CSV handling and export

Base product CSV validation is unchanged. New must-promote parsing supports exact and maximum alongside legacy min/preferred. Unknown list headers reject rather than silently dropping a misspelled rule. Financial defaults remain visible; Simple Mode translates field names into business descriptions. Field mapping is explicitly deferred; use the exact template headers.

Simple export contains each current/suggested discount, sales and contribution, goal, buffer, verified suggestion feasibility, and a fixed-volume flag. Infeasible suggestions have blank suggested columns and `Suggestion_Feasible=false`. Exports do not approve current rule violations. Formula escaping remains enabled. Downloads and parsing are local; no API submission or storage is introduced.

## QA and review checklist

Automated coverage includes original oracles/immutability, uniform 20%, exact/min/max/preferred rules, P1 preservation, impossible bounds/buffers, no-change recommendations, determinism, before/after and stress calculations, weighted path and zero crossing, zero-volume cases, warning grouping, mode-state preservation, bulk actions, dataset initialization, failed-upload retention, local uploads/downloads, chart labels, and basic narrow-window control presence. jsdom cannot validate CSS layout or screen-reader behavior.

Suggested real-browser review (not performed here because no browser tool was available):

1. Run `npm ci`, `npm run dev`; review at desktop width and 375px / 768px.
2. Enter 20% storewide on demo; confirm ~$253,257 sales, −$14,609 profit, 22 losing products, and collapsed warnings.
3. Set $20,000 goal plus $500 buffer; improve, review changes, apply; confirm goal plus buffer met. Export and compare precise values.
4. Add exact 10% / max 12% to ELE-004; test bulk rules; then make a conflicting exact 20% / max 10% combination and confirm no apply action appears.
5. Change storewide/category/SKU offers, goals, buffer and extra shipping; switch modes repeatedly and confirm no campaign resets. Check weight editing and original frontier in Advanced Mode.
6. Upload the full template and a minimal CSV with missing costs. Confirm fresh-campaign defaults, zero-cost warnings, and local processing. Try malformed CSV, wrong headers, unknown rule IDs, and contradictory hard offers.
7. Check keyboard navigation, focus rings, summary disclosure controls, numeric fields, loss-only search, bulk selection across pages, table scrolling, mobile chart scrolling, and screen-reader descriptions. Inspect the browser network panel during uploads to confirm no merchant data leaves the page.

## Known limits

No live browser/screenshots, real merchant usability study, empirical three-minute completion measurement, or assistive-technology audit. No field mapping, demand response, persistence, discrete rounding-safe checkout discounts, taxes, fixed overhead, currency conversion, complete return-refund accounting, or platform checkout integration. The default goal is a disclosed policy choice, not merchant-specific financial advice. See the original methodology for unchanged formula limits.
