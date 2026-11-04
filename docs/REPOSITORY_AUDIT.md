# Initial repository audit

Audited before application implementation. Base commit: `99b12e9cb1a509c391076c30b585607c295c03e2`. The checkout had no application files and no AGENTS.md. All eight original files were read, including all six workbook worksheets and their verification formulas. Existing files remain unchanged.

| File | Contents and interpretation |
| --- | --- |
| `README` | Initial product vision and MVP checklist; no code or runnable project. |
| `README.txt` | Synthetic fixture guide, fixed volume, single-item orders, incremental return costs, greedy heuristic caveat. |
| `sku_master.csv` | 30 fictional SKUs, 18 fields; 10 each Electronics/Home/Accessories. P1 first three of each category, P2 next three, P3 remaining four. UTF-8 BOM and CRLF. |
| `expected_scenarios.csv` | Seven rounded portfolio oracles: baseline, minimums, greedy, order stacking, shipping shock, return shock, infeasible priorities. |
| `optimization_steps.csv` | 16 accepted greedy 5 percentage point adjustments from minimums; final contribution $27,851.66. A sequence fixture, not a global optimum. |
| `cumulative_frontier.csv` | 21 P2/P3 inclusions, each raised to max, starting from minimums. Floor first breached at inclusion 8 (HOM-005), contribution $27,153.71. |
| `assumptions_and_test_oracle.json` | USD, percentage decimals, formulas, floor $27,590.74, scenario targets and first frontier breach. |
| `MarginGuard_BFCM_Synthetic_QA_Dataset.xlsx` | READ_ME (14 rows), SKU_INPUTS (31), EXPECTED_RESULTS (8), OPT_STEPS (17), CUMULATIVE_FRONTIER (22), CALC_VERIFY (35). CALC_VERIFY references SKU_INPUTS to compute baseline/locked contribution and totals; confirms the CSV formula. Other sheets duplicate the data/oracles. |

## SKU schema

Identifiers: SKU, Product_Name, Category, Priority. Financials: Regular_Price_USD, Unit_COGS_USD, Fulfillment_Cost_USD, Merchant_Shipping_USD, Payment_Fee_Rate, Order_Fixed_Fee_Allocated_USD, Expected_Return_Rate, Return_Cost_Per_Return_USD. Quantity: Expected_Units, Inventory_Units. Constraints/heuristic: Locked_Min_Discount, Max_Discount, Step_Discount, Allocation_Weight.

Revenue has no demand lift. “Profit” in fixtures means contribution, not gross profit. Gross profit and gross margin were added as separate application outputs. All reference expected units are below inventory. The fixed-volume inventory cap therefore changes no reference values.

## Ambiguities explicitly retained

The infeasible-priority scenario supplies outputs but omits the changed SKU constraints. Increasing ELE-001 discount from 20% to 60% on top of all other minimums reproduces its revenue and contribution, but exceeds the original ELE-001 20% cap. This is a reconstruction used only to verify its financial target, not a claim about how the original author generated it. Actual constraint infeasibility is independently tested with an excessive floor and with minimum above maximum.

The JSON describes a greedy objective; it does not define a discrete globally optimal target. Phase 1 implements an explicitly different, exact **continuous** weighted objective and regression-tests the original greedy sequence as reference calculations. The app does not silently claim its allocation must equal the discrete fixture. The fixture's “priority constraint pass” checks minimums; baseline intentionally fails those minimums.
