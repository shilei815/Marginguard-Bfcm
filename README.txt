MarginGuard BFCM — Synthetic QA Fixture v0.1
Generated November 2, 2026

100% fictional synthetic products, prices, COGS, discounts and unit-volume assumptions. NOT merchant data, real-world benchmarks, market evidence or projections.

Files:
MarginGuard_BFCM_Synthetic_QA_Dataset.xlsx — six sheets, formula verification, example input and expected results
sku_master.csv — 30 fictional SKU inputs
optimization_steps.csv — greedy heuristic sequence (not globally optimal)
cumulative_frontier.csv — deterministic cumulative inclusion sequence, including breach
expected_scenarios.csv — scenario oracle for automated regression testing
assumptions_and_test_oracle.json — methodology, output targets, explicit assumptions

Financial formula: profit per unit = net sale proceeds * (1 - payment variable fee)
  - allocated fixed payment fee - COGS - fulfillment - merchant shipping
  - extra shipping subsidy - expected return probability * incremental per-return cost.

Caution: returns are modeled as incremental return costs, NOT full refunded sales cash flows. Expected units are fixed for all scenarios. No demand elasticity estimation. Each SKU represents a representative one-item order; discounts applied sequentially for the stress scenario only, not generalized Shopify checkout logic. User must update cost and discount assumptions for any real-world analysis.

Priority handling: min discount required; P1 cannot be changed in greedy allocation. P2/P3 discounts increase in discrete increments from min discounts within max cap. Heuristic maximizes priority-weighted discount points gained per unit of contribution profit consumed, subject to profit floor. No mathematical guarantee of global optimality.

The expected_scenarios sheet includes intentional edge tests: extra order stacking discount, extra shipping subsidy, expected return costs, and infeasible locked-priority constraints.
