# Financial formulas and optimization

For each SKU, let q = min(Expected_Units, Inventory_Units). Sales volumes stay fixed under every discount; inventory limits are applied explicitly and warned on import. Quantity is expected units, not an order-demand forecast.

- Revenue R = Regular_Price_USD × (1 − SKU discount) × (1 − extra order discount) × q.
- Gross profit G = R − Unit_COGS_USD × q.
- Gross margin = G / R; undefined at zero revenue.
- Contribution C = G − R × Payment_Fee_Rate − q × [Order_Fixed_Fee_Allocated_USD + Fulfillment_Cost_USD + Merchant_Shipping_USD + extra shipping subsidy + Other_Variable_Cost_USD + (Expected_Return_Rate + return shock) × Return_Cost_Per_Return_USD].
- Contribution margin = C / R; undefined at zero revenue.
- Portfolio metrics sum revenue, gross profit, and contribution separately; portfolio margins divide summed profits by summed revenue, rather than averaging SKU margins.

The allocated fixed payment fee is **per unit**, reflecting one representative single-SKU order per unit. Returns charge incremental expected costs only; no reversal of sales revenue or refund of payment fees is modeled. Combined return probability must not exceed 1. Stacking applies sequentially, not additively. Baseline uses zero discounts and zero stress inputs; scenario includes active stress inputs. Dataset costs remain active in both.

## Exact continuous objective

The primary objective is max Σ Allocation_Weight_i × discount_i, not revenue, demand, or contribution maximization. Bounds are max(dataset minimum, custom priority minimum) ≤ discount ≤ dataset maximum. P1 is additionally fixed at its required minimum. Contribution must remain at or above the user floor. Preferences generate warnings if unmet; they do not alter objective weights or feasibility.

With fixed q and nonnegative fee-adjusted sale proceeds, each additional discount fraction consumes the constant contribution amount:

`loss_i = price_i × q_i × (1 − extra order discount) × (1 − payment fee rate_i)`.

Start with mandatory discounts. If they violate bounds or the floor, no feasible allocation exists because further discounting cannot increase contribution. Otherwise allocate continuous discount fractions by descending `weight_i / loss_i`, breaking ties by SKU ID. Zero-loss, positive-weight items are allocated first at no contribution cost; zero-weight items remain at minimums. P1 is excluded. Consume remaining contribution headroom until the floor or all caps are reached. This is fractional knapsack: if a lower-ratio allocation precedes a higher-ratio one, exchanging equal contribution budget raises the objective, so this ordering is globally optimal for the stated continuous linear model. Full allocation is O(n log n), aside from validation and current priority matching. No guarantee extends to discrete rounding, demand elasticity, or other business objectives.

The alternative objective is max portfolio contribution. Under this same fixed-volume model, the required minimum discounts are an exact optimum. Preferred targets remain soft.

## Cumulative frontier

The chart starts at required discounts and successively increases each adjustable SKU to its maximum in the same ratio ordering, continuing beyond the floor. Each line segment represents continuous allocation of one SKU; full-SKU knots are numbered allocations. Crossing labels interpolate within segments and are allocation positions, **not** calendar times or a uniform discount percentage. The displayed curve is an ordered allocation path, not a set of independent uniform-discount scenarios. It is independent of manual scenario overrides, and is labeled accordingly. Both the first floor crossing and zero-contribution crossing are reported when present; otherwise “none”. An infeasible required allocation has no feasible frontier and shows the reason.

The original cumulative CSV follows a different rule: P2 then P3, category alphabetically then SKU ID, each raised to max, beginning with all minimums. Its first breach is step 8 HOM-005. The original discrete optimizer uses weighted greedy step increments and is a heuristic; tests replay its fixture sequence rather than asserting that it equals the new continuous optimum.

## Numeric and operational limitations

IEEE-754 double precision is retained until display/export. Constraint comparisons tolerate 1e-7 USD internally and scenario warnings 1e-6 USD to avoid floating-point false breaches. Dashboard cards round to whole USD for readability; CSV exports retain precision. No silent demand lift. No browser persistence, server submission, analytics, tracking, or external runtime assets. Optional costs omitted from the CSV default to explicitly warned zeros; the merchant must replace them. Model validity depends on accurate inputs.


## Phase 2C merchant-tier extension

The formulas and original optimizer implementation above are unchanged. Merchant tiers use a separate typed mapping and a rule adapter in `tiers.ts`. Effective tier hard values are inherited/overridden per field and intersect product-file and explicit SKU bounds. Targets remain soft; explicit SKU preferred discounts take precedence for within-tier recovery. With assignments active, the deterministic recovery policy consumes Tier 3 discretionary capacity before Tier 2, then Tier 1, using the same contribution calculations and tolerances. Original P1 hard-lock semantics remain independent of merchant tier. With no assignments the previous policy is used exactly. Every recommendation and advanced allocation is independently recalculated and checked against all hard bounds and goal + buffer before approval. See [complete Phase 2C methodology](PHASE_2C.md) for CSV validation, precedence, preference relaxation, reporting and beta verification limits.
