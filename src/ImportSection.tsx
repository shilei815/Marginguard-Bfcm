import {
  type ImportedCampaign,
  costColumns,
  costLabels,
  costQuality,
  costReport,
  simpleProductTemplate,
  advancedProductTemplate,
} from "./unifiedImport";
import { download, template, priorityTemplate } from "./csv";
import { promotionTemplate, friendlyAssumption } from "./planner";
import { tierTemplate } from "./tiers";
export interface ImportSectionProps {
  campaign: ImportedCampaign;
  source: string;
  advanced?: boolean;
  error?: string;
  notice?: string;
  onUpload: (f: File | undefined, priority?: boolean) => void;
  onTierUpload: (f: File | undefined) => void;
  onDemo: () => void;
  onConfirmCosts: (confirmed: boolean) => void;
}
export function CostDisclosure({
  campaign,
  onConfirmCosts,
}: {
  campaign: ImportedCampaign;
  onConfirmCosts: (confirmed: boolean) => void;
}) {
  const quality = costQuality(campaign.costs, campaign.costsConfirmed);
  return (
    <section
      className={`cost-quality ${quality.complete ? "complete" : "incomplete"}`}
      aria-label="Cost data completeness"
    >
      <div className="section-title">
        <h3>{quality.status}</h3>
        <span>
          {quality.zeros} explicit zero inputs · {quality.provided} positive
          inputs
        </span>
      </div>
      {!quality.complete ? (
        <p>
          <b>
            Your estimated profit may be overstated because some operating costs
            were not provided.
          </b>{" "}
          Missing variable costs are currently treated as zero; modeled goal
          achievement is not a definitive financial safety guarantee.
        </p>
      ) : (
        <p>
          All modeled variable-cost inputs were provided or explicitly confirmed
          zero. This confirms input completeness, not accounting net profit or
          future sales. Fixed overhead, taxes and excluded costs are still not
          deducted.
        </p>
      )}
      {campaign.demo && (
        <p className="caption">
          Synthetic demo assumption: the fixture explicitly models other
          variable costs as zero. Merchant uploads require their own provided
          costs or confirmation.
        </p>
      )}
      <details>
        <summary>
          Review {quality.missing} omitted cost inputs
          {campaign.costsConfirmed ? " · explicitly confirmed zero" : ""}
        </summary>
        <p>
          Zero values supplied in the CSV are confirmed zeros. Blank or absent
          values remain missing until you explicitly confirm them. No shipping,
          payment, fulfillment or return costs are inferred from product
          category.
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Input</th>
                <th>Missing</th>
                <th>Explicit zero</th>
                <th>Positive provided</th>
              </tr>
            </thead>
            <tbody>
              {costColumns.map((field) => (
                <tr key={field}>
                  <td>
                    {costLabels[field]}
                    <small>{field}</small>
                  </td>
                  <td>
                    {
                      campaign.costs.filter(
                        (c) => c.field === field && c.state === "missing",
                      ).length
                    }
                  </td>
                  <td>
                    {
                      campaign.costs.filter(
                        (c) => c.field === field && c.state === "zero",
                      ).length
                    }
                  </td>
                  <td>
                    {
                      campaign.costs.filter(
                        (c) => c.field === field && c.state === "provided",
                      ).length
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {quality.missing > 0 && (
          <label className="checkbox">
            <input
              aria-label="Confirm all omitted cost inputs are zero or not applicable"
              type="checkbox"
              checked={campaign.costsConfirmed}
              onChange={(e) => onConfirmCosts(e.target.checked)}
            />
            I confirm all {quality.missing} omitted cost inputs are zero or not
            applicable for these products. Confirm only after reviewing the
            missing fields; this does not edit provided costs.
          </label>
        )}
        <button
          className="text-button"
          onClick={() =>
            download(
              "marginguard-cost-input-report.csv",
              costReport(campaign.costs, campaign.costsConfirmed),
            )
          }
        >
          Export cost input report
        </button>
      </details>
    </section>
  );
}
export default function ImportSection(p: ImportSectionProps) {
  const { campaign } = p;
  const fileWarnings = campaign.costsConfirmed
    ? campaign.warnings.filter(
        (w) => !costColumns.some((field) => w.startsWith(field + " missing:")),
      )
    : campaign.warnings;
  return (
    <section
      id={p.advanced ? "import-products" : "step-1"}
      className="unified-import"
      aria-label="Upload Products"
    >
      <div className="data-strip">
        <div>
          <span className="data-icon">1</span>
          <div>
            <h2>Upload Products</h2>
            <b>{p.source}</b>
          </div>
        </div>
        <div className="actions">
          <button className="text-button" onClick={p.onDemo}>
            Load demo
          </button>
          <button
            className="secondary"
            onClick={() =>
              download(
                "marginguard-simple-product-template.csv",
                simpleProductTemplate,
              )
            }
          >
            Download Simple Template
          </button>
          <button
            className="secondary"
            onClick={() =>
              download(
                "marginguard-advanced-product-template.csv",
                advancedProductTemplate,
              )
            }
          >
            Download Advanced Template
          </button>
          <label className="button primary">
            Upload Products
            <input
              aria-label={p.advanced ? "Upload SKU CSV" : "Upload products CSV"}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                p.onUpload(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </div>
      <p className="caption">
        Start with SKU, selling price, unit cost, inventory, and expected
        campaign units. One file can also load tiers, targets, hard rules and
        planned offers. Percentages use decimals: 0.30 = 30%.
      </p>
      <div className="import-counts" aria-label="Import summary">
        <span>
          <b>{campaign.skus.length}</b> products loaded
        </span>
        <span>
          <b>{Object.keys(campaign.tiers.assignments).length}</b> tier
          assignments
        </span>
        <span>
          <b>{campaign.rules.length}</b> custom discount rule sets
        </span>
        <span>
          <b>{Object.keys(campaign.planned).length}</b> imported planned offers
        </span>
      </div>
      <p className="caption">
        Imported planned offers are retained exactly. Review Step 3 for current
        discount-rule and profit warnings; an imported plan is not a certified
        safe recommendation.
      </p>
      {fileWarnings.length > 0 && (
        <details>
          <summary>
            File assumptions and defaults · {fileWarnings.length}
          </summary>
          <ul>
            {fileWarnings.map((w, i) => (
              <li key={i}>{friendlyAssumption(w)}</li>
            ))}
          </ul>
        </details>
      )}
      <CostDisclosure campaign={campaign} onConfirmCosts={p.onConfirmCosts} />
      <details className="csv-help">
        <summary>What product data do I need?</summary>
        <p>
          The five required columns are SKU, Regular_Price_USD, Unit_COGS_USD,
          Inventory_Units and Expected_Units; no required cell may be blank.
          Other financial costs default to zero and remain unconfirmed when
          omitted. Optional legacy Priority defaults to P3, never P1 for
          merchant Tier 1. The Simple template has example products for an
          everyday promotion; replace them with your own data. The Advanced
          template includes every legacy financial field; blank cost cells must
          be filled or explicitly confirmed zero. Templates are examples, not
          financial projections.
        </p>
        <p>
          Planned_Discount sets an actual product offer, overriding category and
          storewide discounts until cleared. Target_Discount is a soft tier
          preference and never changes that offer automatically. Min_Discount is
          a hard SKU minimum; Max_Discount remains the original hard file cap.
          Assigned tiers also receive these supplied bounds. Exact_Discount and
          Preferred_Discount remain separate hard/soft SKU rules. Blank planned
          cells use the editable 10% storewide starting offer. When a target is
          supplied without a tier, Flexible Tier 3 is used; a tier minimum
          without a target uses that minimum as its default soft target, with a
          warning.
        </p>
        <p>
          Uploads validate all products, tiers and rules before replacing the
          campaign. Invalid files leave the existing campaign untouched. Valid
          planned offers can violate hard rules and will be flagged for review.
          Successful product uploads start a fresh campaign, resetting old
          tiers/rules, overrides, stress assumptions and buffer; the new goal is
          50% of positive no-discount baseline profit, otherwise $0. Maximum 5
          MB / 10,000 rows. Field mapping is not available yet: rename columns
          to match the template.
        </p>
      </details>
      <details className="advanced-import-tools">
        <summary>Advanced Import Tools</summary>
        <p className="caption">
          Optional standalone updates for existing campaigns. These preserve
          product data, costs and planned offers. They are not needed for the
          unified upload.
        </p>
        <div className="actions">
          <label className="button secondary">
            Upload discount-rule list
            <input
              aria-label={
                p.advanced ? "Upload priority CSV" : "Upload must-promote CSV"
              }
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                p.onUpload(e.target.files?.[0], true);
                e.target.value = "";
              }}
            />
          </label>
          <label className="button secondary">
            Upload tier CSV
            <input
              aria-label="Upload tier CSV"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                p.onTierUpload(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          <button
            className="text-button"
            onClick={() =>
              download("marginguard-rule-template.csv", promotionTemplate)
            }
          >
            Download list template
          </button>
          <button
            className="text-button"
            onClick={() =>
              download("marginguard-tier-template.csv", tierTemplate)
            }
          >
            Download tier CSV template
          </button>
          <button
            className="text-button"
            onClick={() =>
              download("marginguard-legacy-product-template.csv", template)
            }
          >
            Legacy product template
          </button>
          {p.advanced && (
            <button
              className="text-button"
              onClick={() =>
                download(
                  "marginguard-legacy-priority-template.csv",
                  priorityTemplate,
                )
              }
            >
              Legacy priority template
            </button>
          )}
        </div>
      </details>
      {p.notice && (
        <p role="status" className="notice success">
          {p.notice}
        </p>
      )}
      {p.error && (
        <div role="alert" className="notice danger">
          {p.error.split("\n")[0].startsWith("Tier list") ? (
            <b>Tier list could not be loaded</b>
          ) : (
            <b>Could not load or update your plan</b>
          )}
          <p>{p.error}</p>
        </div>
      )}
    </section>
  );
}
