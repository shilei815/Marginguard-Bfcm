# MarginGuard merchant beta guide

MarginGuard helps small e-commerce merchants compare promotions and protect a
minimum modeled profit goal. Use it for seasonal, clearance or everyday offers.
It works with the sales quantities and costs you supply. **It does not forecast
extra demand from discounts, set your store's offers, or guarantee profit.**
This is beta planning software; verify the final campaign in your own checkout.

## Prepare your products

Download **Simple Template**, replace the fictional examples, and save as CSV.
Only these five columns are required; every required cell needs a value:

```csv
SKU,Regular_Price_USD,Unit_COGS_USD,Inventory_Units,Expected_Units
MUG-001,25,8,150,100
TEE-001,40,15,80,60
```

Use unique SKUs, USD prices/costs, and expected units for one consistent campaign
period. Expected units are capped at inventory. Optional `Product_Name` and
`Category` make the dashboard easier to read. The downloadable Simple template
also includes optional tier, target and discount-bound columns. They are not
extra mandatory fields.

The **Advanced Template** includes payment, shipping, fulfillment, return and
other variable costs. Its example cost cells are deliberately blank: enter your
actual values or an explicit `0` where appropriate. Cost amounts are per unit;
percentage rates in CSV are decimals (`0.30` means 30%, not `30`). The fixed
payment fee is allocated per unit, assuming one representative one-item order.
Do not put currency symbols or thousands separators in numeric cells.

Uploads allow at most 5,000,000 bytes and 10,000 data rows. Headers must match the
template; there is no field mapping. Unknown product columns are warned and left
out of calculations. Invalid required fields, malformed CSV, duplicates, invalid
rates or contradictory hard rules reject the file and leave the current campaign
intact. Correct those errors in your CSV and upload again.

A successful new upload replaces the campaign: old offers, tier settings, rules,
comparisons and extra stress inputs reset. The starting storewide offer is 10%;
the editable profit goal starts at half of positive no-discount profit, otherwise
$0; the safety buffer starts at $0. `Planned_Discount`, when supplied, sets an
actual product offer instead of the starting storewide offer. Switching Simple
and Advanced Mode preserves the same campaign. Refreshing loses the in-memory
campaign, so keep source files and download reports you need.

## Review costs before trusting the estimate

**Some Costs Missing** means omitted costs currently count as zero. Profit may be
overstated. Use the cost input report to review missing fields. Explicit zeros
are different from blank cells. Confirm missing inputs as zero/not applicable
only after checking every affected product.

**Cost Data Complete** means modeled fields were supplied or explicitly confirmed
zero. It does not verify their accuracy, cover every business expense, or certify
profitability. Confirming costs changes the completeness label, not the numbers.
No costs are guessed from your product category.

## Set offers and protect important products

Enter a storewide discount, category offers, or special product offers. Special
product offers override category offers, which override the storewide discount.
Imported planned offers remain product overrides until edited or cleared.

Under **Protect Your Important Products**, choose products and assign tiers:

- **Must Promote — Tier 1:** discretionary offers change last during profit recovery.
- **Important — Tier 2:** changes after Flexible products.
- **Flexible — Tier 3:** changes first; unassigned products join this recovery group when tiers are used.

Set soft targets and, if needed, hard minimum/maximum offers. Tier defaults begin
at 0% target, 0% minimum and 100% maximum; assigning a tier alone does not apply a
discount. Blank per-product tier overrides inherit defaults. A target is a
preference, not a promised discount or an instruction to increase a current offer.

Use an **exact** rule to keep a fixed offer, a **minimum** to require an offer at
least that large, and a **maximum** to cap it. Preferred offers and tier targets
are soft. File rules, explicit product rules and tier hard bounds all stay in
force; conflicts produce diagnostics, not a suggestion that ignores commitments.
Legacy file `Priority=P1` is a separate lock at its required offer; merchant Tier
1 does not create that lock. Avoid the literal SKU `__proto__` with bulk tier
assignment in this beta; see known limitations.

One product CSV can include tiers/rules/planned offers. Separate tier and
promotion-list updates remain available under **Advanced Import Tools** for
existing campaigns.

## Check profit and run Improve My Plan

Review Step 3's profit cards and expand warnings. Set **Minimum Profit to Keep**
and an optional **Additional Safety Buffer** in Step 4. The buffer is an extra
amount of profit to retain, not an additional operating expense.

Select **Improve My Plan**, review Current Plan versus Suggested Plan, then use
**Use Suggested Plan** only after reviewing the changes. The suggestion corrects
hard-rule violations and recovers profit from discretionary offers. With tiers,
it reduces Tier 3 before Tier 2 before Tier 1, protecting soft preferences where
possible within each tier. Required offers may need to increase, which can lower
profit. A target is never permission to break a hard rule or profit goal.

If required offers cannot meet the goal plus buffer, the app explains why and
does not offer a suggested plan to apply. Review costs, offers, constraints or
the goal deliberately. A manual current plan can still have warnings, and a
portfolio that meets its goal can still contain individual loss-making products.
Exports are review reports, not approvals.

## What the profit numbers mean

Expected sales revenue is price after modeled discounts times inventory-capped
expected units. Gross profit subtracts product cost. **Profit After Variable
Costs**, also called contribution profit, additionally subtracts supplied payment
fees, fulfillment, merchant shipping, incremental expected return costs and other
variable costs. Advanced stress assumptions can add order discounts, shipping
subsidies or return costs.

This is **not final accounting net profit**. Fixed overhead, taxes and any
unprovided/excluded costs are not deducted. Returns charge incremental costs;
the model does not reverse returned-sale revenue or model full refund cash flows.
The number of expected units stays fixed at every discount. MarginGuard does not
predict whether a promotion will sell more products.

Advanced **How Much More Can You Discount?** starts from required offers and
adds product discounts in a stated model order. Its steps are not time or a
uniform storewide discount. The minimum profit line includes an active safety
buffer. The displayed full path can continue below the goal even though an
approved allocation stops at that constraint. Expand **How this calculation
works** for ordering and crossing assumptions.

## Validate final checkout discounts

The engine uses continuous discount rates. Displayed percentages are rounded;
CSV reports keep calculation precision. **Rounding to 1%, 0.5% or even 0.1%
increments can break hard offers or the profit goal plus buffer.** Neither
always rounding up nor always rounding down is universally safe.

1. Check what percentage increments, currency rounding and stacking rules your commerce platform actually supports. MarginGuard has no checkout integration.
2. Enter each actual checkout offer in the existing manual product controls, or put it in `Planned_Discount` in your original product CSV. A plan report is not a replacement product-import template.
3. If re-uploading, restore the same goal, buffer and Advanced stress assumptions: a successful upload starts a fresh campaign. Retain the same costs, tiers and hard rules.
4. Recheck total profit against goal **plus** buffer and expand every hard-rule warning. Confirm exact/minimum/maximum offers independently. Do not treat the old unrounded suggestion as verification of new rates.
5. Test the actual checkout totals, order composition, fees, shipping and refunds in your commerce platform. This model uses per-unit USD calculations and cannot certify platform currency rounding or order behavior.

Do not launch a rounded plan with unresolved hard-rule or goal warnings. A soft
target warning is different from a hard requirement, but still deserves review.

## Data handling and beta disclaimer draft

Product data is read and calculated locally in your browser; this version has no
merchant-data upload API, account, database or analytics. Campaign state stays in
memory and is lost on reload. Reports you download remain on your device. Static
hosting may process normal access information such as IP address, URL and request
time; the hosting configuration must be reviewed before public launch. Browser
extensions, device access and files you share are outside this local-processing
claim. Do not place sensitive business data in URLs or public issue reports.

MarginGuard provides modeled planning estimates from user inputs, not accounting,
tax or financial advice. Beta results may contain errors. Verify assumptions,
costs, constraints and checkout behavior independently before making commercial
decisions. No guarantee of future sales, profit, security or legal compliance is
made. This draft describes implemented behavior; the release owner should review
final privacy/disclaimer wording and hosting practices before publishing.

## Report a problem

Contact the repository owner through your existing beta/review channel, or use
[GitHub Issues](https://github.com/shilei815/Marginguard-Bfcm/issues) if enabled.
Include the beta commit, browser/version, device or viewport, steps, expected and
actual behavior, and a small **fictional or redacted** CSV example. Check exports
and screenshots for confidential data before sharing; public repository issues
are public. Do not send private merchant files or credentials. See
[known limitations](BETA_KNOWN_LIMITATIONS.md) for current coverage and gaps.
