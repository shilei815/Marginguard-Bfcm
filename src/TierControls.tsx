import { useState } from "react";
import {
  portfolio,
  type SKU,
  type Discounts,
  type Assumptions,
} from "./engine";
import { type PromotionRule } from "./planner";
import {
  assignmentFor,
  assignTier,
  effectiveTier,
  resolveTiers,
  tierReport,
  tierLabels,
  tierNumbers,
  tierOfferErrors,
  verifyTierPlan,
  parseTierCSV,
  exportTierCSV,
  tierTemplate,
  type TierState,
  type MerchantTier,
  type TierOffer,
} from "./tiers";
import {
  DisplayNumberInput,
  displayNumber,
  DiagnosticSummary,
} from "./presentation";
import { download, exportCSV } from "./csv";
const pct = (n: number | null) =>
  n === null ? "Not set" : `${(n * 100).toFixed(1)}%`;
export interface TierControlsProps {
  skus: SKU[];
  rules: PromotionRule[];
  state: TierState;
  onChange: (state: TierState) => void;
  advanced?: boolean;
  showImportTools?: boolean;
}
export default function TierControls({
  skus,
  rules,
  state,
  onChange,
  advanced = false,
  showImportTools = true,
}: TierControlsProps) {
  const [selected, setSelected] = useState<string[]>([]),
    [search, setSearch] = useState(""),
    [bulk, setBulk] = useState<MerchantTier | null>(1),
    [editId, setEditId] = useState(skus[0]?.id ?? ""),
    [error, setError] = useState<string[]>([]),
    [message, setMessage] = useState("");
  const visible = skus.filter((s) =>
      `${s.id} ${s.name} ${s.category}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    ),
    assigned = Object.keys(state.assignments).length,
    resolved = resolveTiers(skus, rules, state),
    bounds = new Map(resolved.skus.map((s) => [s.id, s]));
  async function upload(file: File | undefined) {
    if (!file) return;
    setError([]);
    setMessage("");
    try {
      if (file.size > 5_000_000)
        throw Error("Tier CSV exceeds the 5 MB limit.");
      const next = parseTierCSV(await file.text(), skus, rules, state);
      onChange(next);
      setMessage(
        `Loaded ${Object.keys(next.assignments).length} tier assignments. Product-file and explicit hard rules are unchanged.`,
      );
    } catch (e) {
      setError((e as Error).message.split("\n"));
    }
  }
  const editing = assignmentFor(state, editId);
  function override(field: keyof TierOffer, value: number | undefined) {
    if (!editing) return;
    const next = { ...editing };
    if (value === undefined) delete next[field];
    else next[field] = value;
    onChange({
      ...state,
      assignments: { ...state.assignments, [editId]: next },
    });
  }
  return (
    <section
      className="tier-section"
      aria-label="Protect Your Important Products"
    >
      <h3>Protect Your Important Products</h3>
      <p className="caption">
        Must Promote — Tier 1 gets the strongest preference protection.
        Important — Tier 2 comes next. Flexible — Tier 3 changes first. A tier
        is not an exact lock.
      </p>
      <details className="tier-editor">
        <summary>
          Assign products and set tier offers · {assigned} assigned
        </summary>
        <p className="caption">
          Targets are soft, non-guaranteed preferences. Minimum and maximum
          discounts are hard rules. Product-file bounds and explicit
          exact/minimum/maximum rules always remain in force. Assigning a tier
          does not change current offers or automatically apply a target.
        </p>
        <details>
          <summary>Edit tier defaults</summary>
          <p className="caption">
            All tiers start neutral: 0% target, 0% minimum, 100% maximum. Only
            assigned products inherit these settings; edit them to reflect your
            actual promotion plans.
          </p>
          <div className="tier-defaults">
            {tierNumbers.map((tier) => (
              <fieldset key={tier}>
                <legend>{tierLabels[tier]}</legend>
                {(["target", "min", "max"] as const).map((field) => (
                  <label className="field" key={field}>
                    Tier {tier}{" "}
                    {field === "target"
                      ? "target"
                      : field === "min"
                        ? "hard minimum"
                        : "hard maximum"}{" "}
                    (%)
                    <DisplayNumberInput
                      min="0"
                      max="100"
                      step="any"
                      digits={6}
                      value={state.defaults[tier][field] * 100}
                      onValueChange={(n) =>
                        onChange({
                          ...state,
                          defaults: {
                            ...state.defaults,
                            [tier]: {
                              ...state.defaults[tier],
                              [field]: Math.min(1, Math.max(0, n / 100)),
                            },
                          },
                        })
                      }
                    />
                  </label>
                ))}
                {tierOfferErrors(state.defaults[tier], `Tier ${tier}`).map(
                  (e) => (
                    <p key={e} className="caption loss">
                      {e} Unused defaults do not affect the current campaign.
                    </p>
                  ),
                )}
              </fieldset>
            ))}
          </div>
        </details>
        <label className="field">
          Find products for tiers
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Product, SKU, or category"
          />
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            aria-label="Select all matching tier products"
            checked={
              visible.length > 0 &&
              visible.every((s) => selected.includes(s.id))
            }
            onChange={(e) =>
              setSelected(
                e.target.checked
                  ? [...new Set([...selected, ...visible.map((s) => s.id)])]
                  : selected.filter((id) => !visible.some((s) => s.id === id)),
              )
            }
          />
          Select all matching products
        </label>
        <div className="product-selector">
          {visible.map((s) => (
            <label className="checkbox" key={s.id}>
              <input
                type="checkbox"
                aria-label={`Select ${s.id} for tier`}
                checked={selected.includes(s.id)}
                onChange={(e) =>
                  setSelected(
                    e.target.checked
                      ? [...selected, s.id]
                      : selected.filter((id) => id !== s.id),
                  )
                }
              />
              {s.name} · {s.id}
            </label>
          ))}
        </div>
        <div className="tier-bulk">
          <label className="field">
            Assign selected products to tier
            <select
              value={bulk ?? ""}
              onChange={(e) =>
                setBulk(
                  e.target.value === ""
                    ? null
                    : (Number(e.target.value) as MerchantTier),
                )
              }
            >
              <option value="">Remove tier (Flexible / unassigned)</option>
              {tierNumbers.map((t) => (
                <option key={t} value={t}>
                  {tierLabels[t]}
                </option>
              ))}
            </select>
          </label>
          <button
            className="secondary"
            disabled={!selected.length}
            onClick={() => onChange(assignTier(state, selected, bulk))}
          >
            Apply tier to {selected.length} selected products
          </button>
        </div>
        <p className="caption">
          Unassigned products are treated as Flexible when tiers are in use.
          Changing a tier keeps its individual overrides. Removing a tier clears
          that assignment and its tier overrides; product-file and explicit
          rules remain.
        </p>
        <details>
          <summary>Individual product tier overrides</summary>
          <label className="field">
            Product for tier overrides
            <select value={editId} onChange={(e) => setEditId(e.target.value)}>
              {skus.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id} · {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Individual product tier
            <select
              value={editing?.tier ?? ""}
              onChange={(e) =>
                onChange(
                  assignTier(
                    state,
                    [editId],
                    e.target.value === ""
                      ? null
                      : (Number(e.target.value) as MerchantTier),
                  ),
                )
              }
            >
              <option value="">Unassigned (Flexible)</option>
              {tierNumbers.map((t) => (
                <option key={t} value={t}>
                  {tierLabels[t]}
                </option>
              ))}
            </select>
          </label>
          {editing && (
            <>
              <div className="tier-override-fields">
                {(["target", "min", "max"] as const).map((field) => (
                  <label className="field" key={field}>
                    Product tier{" "}
                    {field === "target"
                      ? "target"
                      : field === "min"
                        ? "minimum"
                        : "maximum"}{" "}
                    override (%)
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="any"
                      placeholder={`Inherit ${pct(state.defaults[editing.tier][field])}`}
                      value={
                        editing[field] === undefined
                          ? ""
                          : displayNumber(editing[field]! * 100, 6)
                      }
                      onChange={(e) => {
                        if (e.target.value === "") override(field, undefined);
                        else if (Number.isFinite(e.target.valueAsNumber))
                          override(
                            field,
                            Math.min(
                              1,
                              Math.max(0, e.target.valueAsNumber / 100),
                            ),
                          );
                      }}
                    />
                  </label>
                ))}
              </div>
              <p className="caption">
                Blank fields inherit their tier default. An override replaces
                only that tier field; it cannot override product-file or
                explicit hard rules.
              </p>
            </>
          )}
        </details>
        <div className="actions tier-file-actions">
          {showImportTools && (
            <>
              <label className="button secondary">
                Upload tier CSV
                <input
                  aria-label="Upload tier CSV"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => {
                    void upload(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
              <button
                className="text-button"
                onClick={() =>
                  download("marginguard-tier-template.csv", tierTemplate)
                }
              >
                Download tier CSV template
              </button>
            </>
          )}
          <button
            className="secondary"
            disabled={!assigned}
            onClick={() =>
              download("marginguard-tier-assignments.csv", exportTierCSV(state))
            }
          >
            Export tier assignments
          </button>
        </div>
        <p className="caption">
          CSV: SKU,Priority_Tier,Target_Discount,Min_Discount,Max_Discount. Use
          decimal percentages (0.2 = 20%). Blank offer cells inherit defaults.
          Upload replaces tier assignments only. Use your loaded product codes;
          sample EXAMPLE-001 matches the product template. Assignment export
          captures resolved values for portable restoration; imported snapshot
          values become explicit overrides. Clear a product override field to
          inherit again.
        </p>
        {message && (
          <p role="status" className="caption">
            {message}
          </p>
        )}
        {error.length > 0 && (
          <DiagnosticSummary
            title="Tier list could not be loaded"
            errors={error}
            skus={skus}
          />
        )}
        <details>
          <summary>Review assigned products and effective rules</summary>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Merchant tier</th>
                  <th>Soft target</th>
                  <th>Hard minimum</th>
                  <th>Hard maximum</th>
                  {advanced && (
                    <>
                      <th>File priority (legacy)</th>
                      <th>Explicit exact</th>
                      <th>Preferred offer used</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {skus
                  .filter((s) => assignmentFor(state, s.id))
                  .map((s) => {
                    const t = effectiveTier(state, s.id)!,
                      b = bounds.get(s.id)!,
                      r = rules.find((r) => r.id === s.id);
                    return (
                      <tr key={s.id}>
                        <td>{s.id}</td>
                        <td>
                          <select
                            aria-label={`Promotion tier for ${s.id}`}
                            value={t.tier}
                            onChange={(e) =>
                              onChange(
                                assignTier(
                                  state,
                                  [s.id],
                                  e.target.value === ""
                                    ? null
                                    : (Number(e.target.value) as MerchantTier),
                                ),
                              )
                            }
                          >
                            <option value="">Remove tier</option>
                            {tierNumbers.map((t) => (
                              <option key={t} value={t}>
                                {tierLabels[t]}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>{pct(t.target)}</td>
                        <td>{pct(b.min)}</td>
                        <td>{pct(b.max)}</td>
                        {advanced && (
                          <>
                            <td>
                              {s.priority}
                              {s.priority === "P1"
                                ? " · locked required offer"
                                : ""}
                            </td>
                            <td>
                              {r?.exact === undefined ? "None" : pct(r.exact)}
                            </td>
                            <td>
                              {pct(r?.preferred ?? t.target)}
                              {r?.preferred !== undefined
                                ? " · explicit SKU preference"
                                : " · tier target"}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </details>
        {assigned > 0 && resolved.errors.length > 0 && (
          <DiagnosticSummary
            title="Some tier rules need attention"
            errors={resolved.errors}
            skus={skus}
          />
        )}
        {advanced && (
          <p className="caption">
            Merchant tiers are separate from P1/P2/P3 file classes and
            allocation weights. The continuous optimizer still uses its chosen
            mathematical objective with all effective hard bounds. Use Simple
            Mode’s Improve My Plan for Tier 3 → 2 → 1 recovery ordering.
          </p>
        )}
      </details>
    </section>
  );
}
export function TierSummary({
  skus,
  current,
  suggested,
  rules,
  state,
  goal,
  buffer,
  a,
  costsComplete = true,
}: {
  skus: SKU[];
  current: Discounts;
  suggested: Discounts | null;
  rules: PromotionRule[];
  state: TierState;
  goal: number;
  buffer: number;
  a: Assumptions;
  costsComplete?: boolean;
}) {
  if (!Object.keys(state.assignments).length) return null;
  if (
    suggested &&
    !verifyTierPlan(skus, suggested, rules, state, goal, buffer, a).feasible
  )
    suggested = null;
  const report = tierReport(
      skus,
      current,
      suggested,
      rules,
      state,
      goal,
      buffer,
      a,
    ),
    allMet =
      suggested &&
      report.products
        .filter((p) => p.tier !== null)
        .every(
          (p) =>
            p.targetAchieved &&
            p.suggested !== null &&
            p.suggested >= (p.effectivePreferred ?? 0) - 1e-9,
        );
  const exportRecommendations = () => {
    const fileClasses = new Map(skus.map((s) => [s.id, s.priority]));
    const currentLines = new Map(portfolioFor(skus, current, a)),
      nextLines = suggested ? new Map(portfolioFor(skus, suggested, a)) : null;
    download(
      "marginguard-tier-recommendations.csv",
      exportCSV(
        report.products.map((p) => ({
          SKU: p.id,
          Priority_Tier: p.tier ?? "",
          Data_File_Priority: fileClasses.get(p.id),
          Target_Discount: p.target ?? "",
          Effective_Preferred_Discount: p.effectivePreferred ?? "",
          Effective_Hard_Min: p.min,
          Effective_Hard_Max: p.max,
          Current_Discount: p.current,
          Suggested_Discount: p.suggested ?? "",
          Target_Achieved: p.targetAchieved ?? "",
          Hard_Rules_Satisfied: p.hardRulesMet ?? "",
          Current_Revenue: currentLines.get(p.id)!.revenue,
          Current_Contribution: currentLines.get(p.id)!.contribution,
          Suggested_Revenue: nextLines?.get(p.id)?.revenue ?? "",
          Suggested_Contribution: nextLines?.get(p.id)?.contribution ?? "",
          Minimum_Profit_Goal: goal,
          Safety_Buffer: buffer,
          Suggestion_Feasible: !!suggested && report.goalMet,
          Costs_Complete: costsComplete,
          Reason: p.reason,
        })),
      ),
    );
  };
  return (
    <section className="tier-report" aria-label="Product protection summary">
      <p className="eyebrow">
        {suggested
          ? costsComplete
            ? "SUGGESTED PLAN · VERIFIED RECOMMENDATION"
            : "MODELED SUGGESTION · SOME COSTS MISSING"
          : "NO VERIFIED SUGGESTION"}
      </p>
      <h3>
        {allMet
          ? costsComplete
            ? "Your Important Products Are Protected"
            : "Estimated Product Protection — Confirm Missing Costs"
          : suggested
            ? "Some Promotional Targets Need to Change"
            : "Product Protection Needs Review"}
      </h3>
      {!costsComplete && (
        <p className="caption loss">
          Estimated profit may be overstated: omitted variable costs are zero in
          this calculation. Numerical rule checks do not confirm missing
          operating costs.
        </p>
      )}
      <p className="caption">
        These are proposed outcomes, not the current plan. Use Improve My Plan
        in Simple Mode to review and apply a suggestion.
      </p>
      <div className="tier-report-cards">
        {report.tiers.map((t) => (
          <article key={t.tier}>
            <b>{tierLabels[t.tier]}</b>
            <p>
              {suggested
                ? `${t.achieved} of ${t.count} target discounts met`
                : `${t.count} assigned · no feasible suggestion`}
            </p>
            <small>{t.currentAchieved} targets met in the current plan</small>
          </article>
        ))}
      </div>
      <p className="caption">
        Minimum profit goal + safety buffer:{" "}
        {report.goalMet === null
          ? "Not met / no verified suggestion"
          : report.goalMet
            ? "Met"
            : "Not met"}
        . Products with adjusted discounts: {report.adjustedCount}. Soft targets
        are not hard commitments. Target met means the suggested discount
        reaches or exceeds it.
      </p>
      {report.tiers
        .filter((t) => t.tier < 3 && t.achieved < t.count)
        .map((t) => (
          <p className="caption" key={t.tier}>
            Tier {t.tier}: some targets cannot be kept under the current offers,
            hard rules, and profit goal. Review the product explanations below.
          </p>
        ))}
      <details>
        <summary>Review tier target outcomes and reasons</summary>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Merchant tier</th>
                <th>Current</th>
                <th>Suggested</th>
                <th>Soft target</th>
                <th>Target met?</th>
                <th>Hard rules met?</th>
                <th>Reason for change or missed target</th>
              </tr>
            </thead>
            <tbody>
              {report.products
                .filter(
                  (p) =>
                    p.tier !== null ||
                    (p.suggested !== null &&
                      Math.abs(p.suggested - p.current) > 1e-9),
                )
                .map((p) => (
                  <tr key={p.id}>
                    <td>{p.id}</td>
                    <td>{p.tier ?? "Unassigned / Flexible"}</td>
                    <td>{pct(p.current)}</td>
                    <td>
                      {p.suggested === null
                        ? "No suggestion"
                        : pct(p.suggested)}
                    </td>
                    <td>{pct(p.target)}</td>
                    <td>
                      {p.targetAchieved === null
                        ? "Not applicable"
                        : p.targetAchieved
                          ? "Yes"
                          : "No — soft target not met"}
                    </td>
                    <td>
                      {p.hardRulesMet === null
                        ? "Not verified"
                        : p.hardRulesMet
                          ? "Yes"
                          : "No"}
                    </td>
                    <td className="tier-reason">{p.reason}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </details>
      <button className="secondary" onClick={exportRecommendations}>
        Export tier recommendations
      </button>
    </section>
  );
}
function portfolioFor(skus: SKU[], ds: Discounts, a: Assumptions) {
  return portfolio(skus, ds, a).lines.map((l) => [l.sku.id, l] as const);
}
