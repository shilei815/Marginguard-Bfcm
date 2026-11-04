# Phase 2D — unified product import and evergreen MarginGuard

## Scope

Starts from `207540a` on `phase-2c-priority-tiers`, developed on `phase-2d-unified-import-branding`. This phase changes onboarding, input-quality disclosure and customer-facing branding, not financial calculations or recommendation policy. `engine.ts`, `planner.ts`, `tiers.ts`, `csv.ts` and the eight original reference files are unchanged. No repository/project/branch/domain rename, redirect, production merge, deployment, Cloudflare setting, backend, account or paid-service change is performed.

The customer-facing name is **MarginGuard**. The interface and browser metadata use “Plan Smarter Discounts. Protect Your Profit.” and “See how your promotions affect profit, protect important products, and find better discount plans.” Seasonal, clearance, launch and everyday promotions are supported without changing the fixed-volume model. Historical BFCM fixture names, documents, repository and technical package identifiers are retained.

## One primary upload

Both views share Step 1's **Upload Products**, **Download Simple Template**, **Download Advanced Template**, import summary and cost-quality controls. Secondary standalone promotion-rule and tier uploads remain under **Advanced Import Tools**. They retain their original formats and update only their own state; they are not needed for primary onboarding.

The primary importer is the pure `importCampaign` function in `unifiedImport.ts`. It prepares one object containing products, explicit rules, separate merchant tiers, imported planned overrides, warnings, cost-presence records and the initial profit goal. It validates every structural component and preflights baseline/current financial totals before the UI receives a result. Existing base CSV validation is reused without changing its contract; no three independent upload handlers or partial product/rule/tier commits are used.

App owns the product/rule/tier/input-quality payload in one campaign state object. Only after preparation succeeds does one campaign replacement occur; React's event batch resets the current-plan controls, goal/buffer, stress assumptions and view selections with it. There is no await or fallible parsing between validated payload and commit. A shared request sequence prevents an older slow upload or pending standalone update from overwriting a newer selection. Load Demo also cancels older pending imports.

A failed structural import preserves products, tiers, rules, planned offers, cost confirmations, goals, buffer and source. A new error message is the only user-visible update. An internally consistent campaign can still be financially infeasible; it is loaded for review with no false feasible recommendation. Current planned offers may violate hard rules and are retained with warnings, rather than silently corrected during import.

## Templates

The Simple template uses exactly these columns, in this order:

```csv
SKU,Product_Name,Category,Regular_Price_USD,Unit_COGS_USD,Inventory_Units,Expected_Units,Priority_Tier,Target_Discount,Min_Discount,Max_Discount
ELE-001,Wireless Earbuds,Electronics,80,45,200,150,1,0.30,0.25,0.35
HOM-001,Kitchen Organizer,Home,40,18,150,100,2,0.20,0.15,0.30
ACC-001,Phone Case,Accessories,20,7,300,180,3,0.10,0.00,0.20
```

Only SKU, Regular_Price_USD, Unit_COGS_USD, Inventory_Units and Expected_Units are required; every required cell must be supplied. A five-column CSV is valid. Template products/prices are fictional examples, not inferred merchant inputs. Decimal fractions such as 0.30 mean 30%; serialization may omit insignificant trailing zeros.

The Advanced template adds all seven modeled variable-cost inputs, Planned_Discount, Exact_Discount, Preferred_Discount and the legacy Locked_Min_Discount, Step_Discount, Allocation_Weight and Priority fields. Max_Discount already appears once in the Simple columns and is not duplicated. All historical financial input columns remain supported. Advanced example cost cells are blank on purpose: merchants must supply real amounts or explicit zeros rather than adopt invented costs.

## Column semantics and precedence

| Column | Mapping and behavior |
| --- | --- |
| SKU / Product_Name / Category | Existing product identification; omitted names use SKU, categories use Uncategorized. |
| Price / COGS / Inventory / Expected_Units | Original engine fields. Expected sales quantity is inventory-capped; demand remains fixed. |
| Legacy financial cost/rate columns | Original parser and units unchanged. Omitted/blank optional costs become unconfirmed zero estimates, not invented values. |
| Priority | Original P1/P2/P3. Omitted/blank uses P3. Never derived from merchant tier. |
| Priority_Tier | Separate assignment map, values 1–3. Does not create a P1 lock. |
| Planned_Discount | Initial actual SKU offer; precedence is explicit product offer → category → storewide. It is never a hard rule by itself. Explicit zero is an offer, not missing. |
| Target_Discount | Soft merchant-tier target, never an automatic offer increase or a guaranteed minimum. |
| Min_Discount | Explicit SKU hard minimum, and the same row's tier-minimum override when assigned. Removing a tier cannot silently remove this explicit SKU commitment. |
| Max_Discount | Original product-file hard cap, and the same row's tier-maximum override when assigned. It occurs once in each schema. Removing a tier cannot weaken the file cap. |
| Exact_Discount | Explicit hard exact offer. Contradictions with any effective minimum/maximum reject the import. |
| Preferred_Discount | Explicit SKU soft preference, retaining Phase 2C precedence over a tier target for recovery ordering. |
| Locked_Min_Discount | Original file hard minimum, independent of merchant tier minimums and planned offers. |
| Step_Discount / Allocation_Weight | Existing reference increment / advanced continuous allocation weight; no new model. |

All hard layers intersect under the unchanged Phase 2C resolver. A row's target must be consistent with its supplied tier minimum/maximum; contradictory tier settings, minimum above cap, or exact outside hard bounds are structural errors. A consistent tier target that cannot be reached because of a stronger legacy P1 lock or exact offer remains a soft warning, never permission to weaken the rule. Preferred offers can be missed without breaking hard constraints.

When Priority_Tier is present but Target_Discount is blank, the neutral inherited tier target is 0%. If that row supplies Min_Discount without a target, the soft target instead defaults to the supplied minimum, with an explicit warning; the hard minimum is not inferred from a soft target. Target_Discount supplied without a tier gets Flexible Tier 3, with an explicit warning. Min/Max alone do not invent a merchant tier. A blank Planned_Discount uses the editable existing 10% storewide starting offer; targets do not replace it. These are disclosed promotional defaults, not fabricated financial costs.

Imported offers remain editable product overrides until explicitly changed, cleared, replaced by a new import, or changed through an explicit Optimize/Use Suggested Plan action. Changing storewide/category discounts alone does not silently erase imported SKU offers in manual mode. Tier edits continue to preserve current offers, including freezing an active allocation into a manual preview, as documented in Phase 2C.

## Cost completeness

For every SKU and each of the seven modeled optional variable-cost inputs, the importer records one source state:

- **missing:** field absent or blank; calculation uses the original zero default, not confirmed.
- **zero:** explicitly supplied numeric zero, including zero-valued rate fractions.
- **provided:** a valid positive amount or rate.

The required COGS field must always be provided and is already validated by the required schema. Quality status conservatively covers fulfillment, merchant shipping, percentage payment fee, allocated fixed payment fee, expected return rate, cost per return and other variable cost for every product. Even if a field is not applicable, its zero value must be supplied or explicitly confirmed; categories never determine costs.

**Some Costs Missing** remains visible when any of those fields are omitted and not confirmed. The UI states: “Your estimated profit may be overstated because some operating costs were not provided.” Missing costs are zero in the estimate. Step 3 repeats the caution; modeled goal success, identical-plan messages and tier summaries avoid definitive financial safety wording. Numerical feasibility still means the stated model's hard rules and contribution floor pass; it does not certify missing costs or future economic profit.

**Cost Data Complete** means every modeled optional cost was supplied (including zeros) or the merchant explicitly affirmed all omitted inputs are zero/not applicable after reviewing the counts. This affirmative checkbox changes only the quality metadata, never SKU costs, arithmetic, goals, rule bounds or source-presence records. It can be revoked. Explicit zeros and confirmed omissions remain distinguishable in the local cost-input CSV report. Completeness does not imply truthful estimates, final accounting net profit, deducted overhead/taxes, or predicted demand lift.

The fixture demo explicitly confirms only its omitted Other_Variable_Cost_USD as zero, matching the synthetic reference formula. Its UI identifies this as a demo assumption. Uploading the same CSV as merchant data does not inherit that confirmation. New product uploads reset confirmation; view switching and standalone tier/rule updates preserve it.

## Import/export compatibility and limits

BOM, CRLF, quoted fields, duplicate normalized headers, malformed records, duplicate SKUs, finite nonnegative costs, rate bounds and existing 5 MB / 10,000-row limits remain enforced. Recognized unified columns are processed, not flagged as ignored. Truly unknown columns retain the existing parser's explicit excluded-column warning; field mapping remains deferred. Prototype-like SKU IDs are supported without losing tiers or planned offers. CSV exports retain formula escaping.

Source financial objects and rules retain full numeric precision. All downloadable file names use `marginguard-`. General plan exports now append Costs_Complete and Cost_Assumptions; tier recommendation exports append Costs_Complete. Assignment, product and standalone promotion-rule import formats remain compatible. The new local cost report contains source states and confirmation metadata. No financial data is posted to a server or API; reports use browser Blob downloads.

## Verification

- **188 tests pass:** all 143 previous regressions retained plus 32 unified importer/quality tests and 13 UI tests. One old headline expectation is updated for the requested rebrand; its behavior assertions are retained.
- `npm run build` passes TypeScript and Vite static production compilation.
- **98 real Chromium layout/state checks** pass at 320, 375, 390, 430, 768 and 1440px. They include native unified and five-column uploads, full-state invalid-import rollback, explicit zero confirmation without metric changes, shared mode state, metadata/branding, both template downloads and all prior tier/financial/layout checks.
- No document/body horizontal overflow, runtime exceptions or external page requests occurred in tested states. Sample mobile/desktop screenshots were inspected. Reports remain under ignored `work/browser-qa/`.
- The original uniform 20% synthetic regression remains $253,256.80 revenue, approximately −$14,608.76 contribution and 22 losing products. The eight original files remain SHA-256 checked and unchanged.

Run `npm test`, `npm run build`, then `npm run test:browser`. In the disposable managed container, `CHROMIUM_NO_SANDBOX=1` is required; keep Chromium's sandbox enabled on ordinary machines. See PHASE_2B.md for runner requirements. No dependency download or new hosting infrastructure is needed by the harness.

## Remaining beta gates and deliberate limits

1. Merchant acceptance review of the Simple/Advanced templates, planned-versus-target language, structural-versus-financial warnings and the explicit zero-cost confirmation. Representative real cost completeness must be reviewed; synthetic arithmetic tests do not validate merchant assumptions.
2. Physical iOS/Android, Safari/Firefox, assistive technology, zoom and virtual-keyboard verification. Headless Chromium emulation and native file automation are not physical-device or screen-reader validation.
3. Review actual rounded checkout offers in the manual planner before live campaign use. Continuous full-precision suggestions do not guarantee feasibility after rounding. No discrete optimization is added.
4. A timed onboarding/usability study remains unperformed; no measured three-minute completion claim is made.

No persistence, account system, field mapping, platform API, demand elasticity, forecasts, multi-currency, fixed-overhead/tax model, full return/refund cash flows or new services are introduced. Refresh loses the local campaign and confirmations. Historical documentation is retained for previous phases; these limits are release review items, not an instruction to add infrastructure or deploy.
