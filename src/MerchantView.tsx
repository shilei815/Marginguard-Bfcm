import { useState } from "react";
import {
  portfolio,
  discountFor,
  type SKU,
  type Discounts,
  type Assumptions,
} from "./engine";
import {
  improvePlan,
  profitStatus,
  planWarnings,
  adjustmentPath,
  promotionTemplate,
  type PromotionRule,
} from "./planner";
import { download, exportCSV, template } from "./csv";
import {
  usd as money,
  wholeUSD,
  DisplayNumberInput,
  WarningSummary,
  DiagnosticSummary,
} from "./presentation";
const percent = (n: number) => (n * 100).toFixed(1) + "%";
export function Amount({
  label,
  value,
  onChange,
  max,
  min = 0,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  max?: number;
  min?: number;
}) {
  return (
    <label className="field">
      {label}
      <DisplayNumberInput
        value={value}
        digits={label.includes("USD") ? 2 : 6}
        min={min}
        max={max}
        step="any"
        onValueChange={(n) =>
          onChange(Math.max(min, Math.min(max ?? Number.MAX_VALUE, n)))
        }
      />
    </label>
  );
}
export function RuleEditor({
  skus,
  rules,
  onChange,
  onUpload,
}: {
  skus: SKU[];
  rules: PromotionRule[];
  onChange: (rules: PromotionRule[]) => void;
  onUpload: (f: File | undefined) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]),
    [kind, setKind] = useState<"min" | "max" | "exact" | "preferred">("min"),
    [value, setValue] = useState(20),
    [search, setSearch] = useState("");
  const visible = skus.filter((s) =>
    `${s.id} ${s.name} ${s.category}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  function apply() {
    const next = new Map(rules.map((r) => [r.id, r]));
    for (const id of selected)
      next.set(id, {
        ...(next.get(id) ?? { id, min: 0 }),
        [kind]: value / 100,
      });
    onChange([...next.values()]);
  }
  return (
    <details className="must-promote">
      <summary>
        Must-Promote Products · {rules.length} selected commitments
      </summary>
      <p className="caption">
        Exact = keep this offer. Minimum = at least this offer. Maximum = never
        exceed it. Preferred = a non-guaranteed target. These rules do not
        change a product’s file priority class.
      </p>
      <input
        aria-label="Find must-promote products"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Find products or categories"
      />
      <label className="checkbox">
        <input
          type="checkbox"
          checked={
            visible.length > 0 && visible.every((s) => selected.includes(s.id))
          }
          onChange={(e) =>
            setSelected(
              e.target.checked
                ? [...new Set([...selected, ...visible.map((s) => s.id)])]
                : selected.filter((id) => !visible.some((s) => s.id === id)),
            )
          }
        />{" "}
        Select all matching products
      </label>
      <div className="product-selector">
        {visible.map((s) => (
          <label className="checkbox" key={s.id}>
            <input
              type="checkbox"
              checked={selected.includes(s.id)}
              onChange={(e) =>
                setSelected(
                  e.target.checked
                    ? [...selected, s.id]
                    : selected.filter((id) => id !== s.id),
                )
              }
              aria-label={`Select ${s.id} for promotion`}
            />
            {s.name} · {s.id}
          </label>
        ))}
      </div>
      <div className="two-fields">
        <label className="field">
          Discount rule
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as typeof kind)}
          >
            <option value="min">Minimum Discount</option>
            <option value="exact">Exact Discount</option>
            <option value="max">Maximum Discount</option>
            <option value="preferred">Preferred Discount (soft)</option>
          </select>
        </label>
        <Amount
          label="Rule discount (%)"
          value={value}
          onChange={setValue}
          max={100}
        />
      </div>
      <button
        className="secondary full"
        disabled={!selected.length}
        onClick={apply}
      >
        Apply rule to {selected.length} selected products
      </button>
      <div className="actions priority-actions">
        <label className="button secondary">
          Upload list
          <input
            aria-label="Upload must-promote CSV"
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              onUpload(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        <button
          className="text-button"
          onClick={() =>
            download("must-promote-template.csv", promotionTemplate)
          }
        >
          Download list template
        </button>
      </div>
      <p className="caption">
        Upload replaces custom rules. Product-file rules still apply.
        Percentages in CSV use decimals: 0.2 = 20%.
      </p>
      <div className="commitment-list">
        {rules.map((r) => (
          <div className="priority-row" key={r.id}>
            <span>
              <b>{r.id}</b>
              {(["min", "exact", "max", "preferred"] as const)
                .filter((k) => r[k] !== undefined && (k !== "min" || r.min > 0))
                .map((k) => (
                  <small key={k}>
                    {k === "min"
                      ? "Minimum"
                      : k === "max"
                        ? "Maximum"
                        : k === "exact"
                          ? "Exact"
                          : "Preferred (soft)"}{" "}
                    {percent(r[k]!)}{" "}
                    <button
                      aria-label={`Clear ${k} rule for ${r.id}`}
                      onClick={() =>
                        onChange(
                          rules.map((x) =>
                            x.id !== r.id
                              ? x
                              : { ...x, [k]: k === "min" ? 0 : undefined },
                          ),
                        )
                      }
                    >
                      ×
                    </button>
                  </small>
                ))}
            </span>
            <button
              aria-label={`Remove commitment ${r.id}`}
              onClick={() => onChange(rules.filter((x) => x.id !== r.id))}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </details>
  );
}
export function ProfitChart({
  skus,
  current,
  suggested,
  a,
  goal,
  buffer,
  rules = [],
}: {
  skus: SKU[];
  current: Discounts;
  suggested: Discounts | null;
  a: Assumptions;
  goal: number;
  buffer: number;
  rules?: PromotionRule[];
}) {
  if (!suggested)
    return (
      <section className="panel">
        <h2>How Discounts Affect Your Profit</h2>
        <p>
          No rule-compliant suggestion is available. Resolve the discount rules
          or lower your profit goal to see an adjustment path.
        </p>
      </section>
    );
  const path = adjustmentPath(skus, current, suggested, a, goal, buffer),
    { start, end } = path;
  const currentFinancials = portfolio(skus, current, a),
    suggestedFinancials = portfolio(skus, suggested, a);
  const sameDiscounts = skus.every(
    (s) =>
      Math.abs(
        (discountFor(current, s.id) ?? 0) - (discountFor(suggested, s.id) ?? 0),
      ) <= 1e-9,
  );
  const sameFinancials = (["revenue", "gross", "contribution"] as const).every(
    (k) => Math.abs(currentFinancials[k] - suggestedFinancials[k]) <= 1e-7,
  );
  const hardIssues = planWarnings(skus, current, rules, goal, buffer, a).filter(
    (w) =>
      w.kind !== "Product losing money" &&
      w.kind !== "Preferred target" &&
      w.kind !== "Missing costs or input assumptions",
  );
  if (sameDiscounts && sameFinancials) {
    return (
      <section className="panel unchanged-plan">
        <h2>How Discounts Affect Your Profit</h2>
        {hardIssues.length === 0 ? (
          <>
            <p className="success-message">
              Your current discount plan already meets your profit goal. No
              changes are needed.
            </p>
            <p>
              Current profit after variable costs: <b>{money(start.profit)}</b>{" "}
              · Minimum profit goal: <b>{money(goal)}</b>
              {buffer > 0 && (
                <>
                  {" "}
                  · Additional safety buffer: <b>{money(buffer)}</b> · Goal plus
                  buffer: <b>{money(goal + buffer)}</b>
                </>
              )}
            </p>
          </>
        ) : (
          <>
            <p>
              These plans have the same discounts and financial results, but
              unresolved discount rules or your profit goal still need
              attention.
            </p>
            <p>
              Current profit: {money(start.profit)} · Goal plus buffer:{" "}
              {money(goal + buffer)}
            </p>
            <WarningSummary warnings={hardIssues} skus={skus} />
          </>
        )}
      </section>
    );
  }
  const lo = Math.min(0, start.profit, end.profit, goal),
    hi = Math.max(1, start.profit, end.profit, goal + buffer),
    span = Math.max(1, hi - lo),
    xl = Math.min(start.discount, end.discount) - 0.02,
    xh = Math.max(start.discount, end.discount) + 0.02;
  const x = (d: number) => 75 + ((d - xl) / (xh - xl)) * 650,
    y = (v: number) => 220 - ((v - lo) / span) * 175;
  return (
    <section className="panel simple-chart">
      <h2>How Discounts Affect Your Profit</h2>
      <p className="caption">
        One adjustment path from your current plan to the suggested plan.
        Expected units stay fixed.
      </p>
      <svg
        viewBox="0 0 800 285"
        role="img"
        aria-label="Profit after variable costs from current plan to suggested plan"
      >
        <text x="18" y="17" fontSize="12">
          Profit After Variable Costs (USD)
        </text>
        {[0, goal, ...(buffer ? [goal + buffer] : [])].map((v, i) => (
          <g key={i}>
            <line
              x1="75"
              x2="725"
              y1={y(v)}
              y2={y(v)}
              stroke={i ? "#ad7943" : "#abbfb3"}
              strokeDasharray="5 5"
            />
            <text x="730" y={y(v) + 4} fontSize="10">
              {money(v)}
            </text>
          </g>
        ))}
        <line
          x1={x(start.discount)}
          x2={x(end.discount)}
          y1={y(start.profit)}
          y2={y(end.profit)}
          stroke="#087b66"
          strokeWidth="3"
        />
        {[
          { ...start, label: "Current Plan" },
          { ...end, label: "Suggested Plan" },
        ].map((p, i) => (
          <g key={p.label}>
            <title>
              {p.label}: {percent(p.discount)} overall discount,{" "}
              {money(p.profit)} profit after variable costs
            </title>
            <circle
              cx={x(p.discount)}
              cy={y(p.profit)}
              r="6"
              fill={i ? "#087b66" : "#d08245"}
            />
            <text
              x={x(p.discount)}
              y={y(p.profit) + (i ? -12 : 22)}
              fontSize="12"
              textAnchor="middle"
            >
              {p.label}
            </text>
          </g>
        ))}
        {path.zero && (
          <g>
            <circle cx={x(path.zero.discount)} cy={y(0)} r="5" fill="#a44b32" />
            <text
              x={x(path.zero.discount)}
              y={y(0) - 10}
              fontSize="10"
              textAnchor="middle"
            >
              Break-even
            </text>
          </g>
        )}
        <text x="75" y="249" fontSize="11">
          {percent(Math.min(start.discount, end.discount))}
        </text>
        <text x="725" y="249" fontSize="11" textAnchor="end">
          {percent(Math.max(start.discount, end.discount))}
        </text>
        <text x="400" y="273" textAnchor="middle" fontSize="12">
          Overall Discount · weighted by base-price expected sales
        </text>
      </svg>
      <div className="chart-endpoints">
        <span>
          Current Plan: <b>{money(start.profit)}</b>
        </span>
        <span>
          Suggested Plan: <b>{money(end.profit)}</b>
        </span>
      </div>
      <div className="chart-foot">
        <span>Minimum Profit Goal: {money(goal)}</span>
        {buffer > 0 && (
          <span>Goal + Safety Buffer: {money(goal + buffer)}</span>
        )}
        <span>
          Break-even:{" "}
          {path.zero ? percent(path.zero.discount) : "not crossed on this path"}
        </span>
      </div>
      <p className="caption">
        Overall discount = sum(price × expected units capped at inventory ×
        product discount) ÷ sum(price × capped units). It is not a uniform
        storewide offer or a forecast. Extra order discounts are held fixed and
        excluded from this axis.
        {!path.hasSales
          ? " No base-price sales; overall discount is shown as 0%."
          : ""}{" "}
        Each point between the endpoints changes every product discount
        proportionally; only the suggested endpoint is guaranteed to meet hard
        rules.
      </p>
    </section>
  );
}
export interface MerchantProps {
  skus: SKU[];
  source: string;
  warnings: string[];
  error: string;
  discounts: Discounts;
  uniform: number;
  categories: Discounts;
  rules: PromotionRule[];
  goal: number;
  buffer: number;
  a: Assumptions;
  advanced: boolean;
  allocationActive: boolean;
  onToggle: () => void;
  onUpload: (f: File | undefined, priority?: boolean) => void;
  onDemo: () => void;
  onUniform: (n: number) => void;
  onCategory: (name: string, n: number | undefined) => void;
  onApply: (ds: Discounts) => void;
  onRules: (r: PromotionRule[]) => void;
  onGoal: (n: number) => void;
  onBuffer: (n: number) => void;
  onClear: () => void;
  onOverride: (id: string, n: number) => void;
}
export default function MerchantView(p: MerchantProps) {
  const { skus, discounts, rules, goal, buffer, a } = p,
    current = portfolio(skus, discounts, a),
    baseline = portfolio(skus),
    recommendation = improvePlan(skus, discounts, rules, goal, buffer, a),
    warnings = planWarnings(
      skus,
      discounts,
      rules,
      goal,
      buffer,
      a,
      p.warnings,
    );

  const [show, setShow] = useState(false),
    [query, setQuery] = useState(""),
    [lossOnly, setLossOnly] = useState(false),
    [page, setPage] = useState(0),
    [selected, setSelected] = useState<string[]>([]),
    [bulk, setBulk] = useState(10);
  const suggestion = recommendation.discounts
    ? portfolio(skus, recommendation.discounts, a)
    : null;
  const status = profitStatus(current.contribution, goal, buffer),
    cats = [...new Set(skus.map((s) => s.category))].sort(),
    filtered = current.lines.filter(
      (l) =>
        (!lossOnly || l.contribution < 0) &&
        `${l.sku.id} ${l.sku.name}`.toLowerCase().includes(query.toLowerCase()),
    ),
    pages = Math.max(1, Math.ceil(filtered.length / 15)),
    at = Math.min(page, pages - 1);
  const suggestedById = new Map(suggestion?.lines.map((l) => [l.sku.id, l]));
  const out = () =>
    download(
      "marginguard-plan.csv",
      exportCSV(
        current.lines.map((l) => ({
          SKU: l.sku.id,
          Current_Discount: l.discount,
          Suggested_Discount: recommendation.discounts?.[l.sku.id] ?? "",
          Current_Expected_Sales: l.revenue,
          Current_Profit_After_Variable_Costs: l.contribution,
          Suggested_Expected_Sales: suggestedById.get(l.sku.id)?.revenue ?? "",
          Suggested_Profit_After_Variable_Costs:
            suggestedById.get(l.sku.id)?.contribution ?? "",
          Minimum_Profit_Goal: goal,
          Safety_Buffer: buffer,
          Suggestion_Feasible: recommendation.feasible,
          Fixed_Volume: true,
        })),
      ),
    );
  return (
    <div className="merchant-shell">
      <header className="topbar">
        <a className="merchant-brand" href="#">
          ◈ MarginGuard <small>BFCM</small>
        </a>
        <div className="actions">
          <span className="badge">BROWSER ONLY</span>
          <button onClick={p.onToggle}>Advanced Mode</button>
        </div>
      </header>
      <main className="merchant-main">
        <div className="heading">
          <div>
            <div className="eyebrow">YOUR BFCM DISCOUNT PLAN</div>
            <h1>Make every discount count.</h1>
            <p>
              Check your offers, protect must-promote products, and keep more
              profit.
            </p>
          </div>
        </div>
        <nav className="step-nav">
          {[
            "Upload Products",
            "Set Discounts",
            "Check Profit",
            "Improve My Plan",
          ].map((label, i) => (
            <a key={label} href={`#step-${i + 1}`}>
              {i + 1}. {label}
            </a>
          ))}
        </nav>
        <section id="step-1" className="data-strip">
          <div>
            <span className="data-icon">1</span>
            <div>
              <h2>Upload Products</h2>
              <small>
                {p.source} · {skus.length} products loaded
              </small>
            </div>
          </div>
          <div className="actions">
            <button className="text-button" onClick={p.onDemo}>
              Load demo
            </button>
            <button
              className="secondary"
              onClick={() => download("product-template.csv", template)}
            >
              Download CSV template
            </button>
            <label className="button primary">
              Upload products
              <input
                aria-label="Upload products CSV"
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => {
                  p.onUpload(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </section>
        <details className="csv-help">
          <summary>What product data do I need?</summary>
          <p>
            Use our template with a product code (SKU), selling price, cost per
            unit, inventory, and expected units sold during the campaign. Add
            payment, shipping, fulfillment, and return costs to get a more
            complete profit estimate. Use decimal percentages in CSV files: 0.2
            means 20%. Maximum 5 MB and 10,000 products. Uploading products
            starts a fresh campaign: offers reset to 10%, custom commitments and
            extra stress costs clear, and your goal is recalculated with a $0
            buffer. Missing optional costs are counted as zero and flagged for
            review; they are never estimated for you. Field mapping is not
            available yet: rename columns to match the template.
          </p>
        </details>
        {p.error && (
          <div role="alert" className="notice danger">
            Could not load or update your plan: {p.error}
          </div>
        )}
        <section className="panel" id="step-2">
          <h2>2. Set Discounts</h2>
          <>
            {p.allocationActive && (
              <div className="notice">
                An Advanced Mode allocation is active. Product discounts below
                show the current offers; changing the storewide discount starts
                a manual plan.
              </div>
            )}
          </>
          <Amount
            label="Storewide discount (%)"
            value={p.uniform * 100}
            max={100}
            onChange={(n) => p.onUniform(n / 100)}
          />
          <p className="caption">
            Special product offers override category offers, which override
            storewide discounts.{" "}
            <button className="text-button" onClick={p.onClear}>
              Clear special offers
            </button>
          </p>
          <details>
            <summary>Different discounts by category</summary>
            {cats.map((cat) => (
              <label className="field" key={cat}>
                {cat} discount (%)
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="any"
                  placeholder="Use storewide"
                  value={
                    discountFor(p.categories, cat) === undefined
                      ? ""
                      : discountFor(p.categories, cat)! * 100
                  }
                  onChange={(e) => {
                    if (e.target.value === "") p.onCategory(cat, undefined);
                    else if (Number.isFinite(e.target.valueAsNumber))
                      p.onCategory(
                        cat,
                        Math.max(0, Math.min(1, e.target.valueAsNumber / 100)),
                      );
                  }}
                />
              </label>
            ))}
          </details>
          <RuleEditor
            skus={skus}
            rules={rules}
            onChange={p.onRules}
            onUpload={(f) => p.onUpload(f, true)}
          />
          <details>
            <summary>Rules already in your product file</summary>
            <p className="caption">
              File minimum and maximum discounts always apply to
              recommendations. P1 is a file rule locking the offer at the
              required minimum; marking another product must-promote does not
              make it P1.
            </p>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Minimum</th>
                    <th>Maximum</th>
                    <th>File rule</th>
                  </tr>
                </thead>
                <tbody>
                  {skus
                    .filter(
                      (s) => s.min > 0 || s.max < 1 || s.priority === "P1",
                    )
                    .map((s) => (
                      <tr key={s.id}>
                        <td>{s.id}</td>
                        <td>{percent(s.min)}</td>
                        <td>{percent(s.max)}</td>
                        <td>
                          {s.priority === "P1"
                            ? "Locked required offer"
                            : "Adjustable"}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </details>
        </section>
        <section id="step-3" aria-label="Check Profit">
          <div className="section-title">
            <h2>3. Check Profit</h2>
            <span
              className={`plan-status ${status === "Losing Money" ? "bad" : status === "Profit Goal at Risk" ? "risk" : "good"}`}
            >
              {status}
            </span>
          </div>
          <div className="cards merchant-cards">
            {[
              ["Expected Sales", wholeUSD(current.revenue)],
              ["Profit After Variable Costs", wholeUSD(current.contribution)],
              [
                "Change in Profit",
                wholeUSD(current.contribution - baseline.contribution),
              ],
              ["Products Losing Money", String(current.negative)],
            ].map(([label, value]) => (
              <article
                className={`card ${label === "Profit After Variable Costs" ? "featured" : ""}`}
                key={label}
              >
                <span>{label}</span>
                <strong
                  className={
                    label === "Profit After Variable Costs" &&
                    current.contribution < 0
                      ? "loss"
                      : ""
                  }
                >
                  {value}
                </strong>
              </article>
            ))}
          </div>
          <p className="profit-explainer">
            Profit after variable costs is not final net profit: fixed overhead,
            taxes, and other excluded costs are not deducted. Change in Profit
            compares with no discounts and no extra stress costs.
          </p>
          <div
            className={`notice ${status === "Losing Money" ? "danger" : status === "Profitable Plan" ? "success" : ""}`}
          >
            <b>
              {status === "Losing Money"
                ? "This discount plan would lose money under your current sales assumptions."
                : status === "Profit Goal at Risk"
                  ? "Your plan is positive or break-even, but does not keep your profit goal plus buffer."
                  : "Your plan keeps your minimum profit goal and safety buffer."}
            </b>
            <span>
              Minimum profit goal {money(goal)} · Additional buffer{" "}
              {money(buffer)} · Goal met:{" "}
              {current.contribution >= goal - 1e-7 ? "Yes" : "No"} · Goal +
              buffer met:{" "}
              {current.contribution >= goal + buffer - 1e-7 ? "Yes" : "No"}
            </span>
          </div>
          <WarningSummary warnings={warnings} skus={skus} />
        </section>
        <section className="panel" id="step-4">
          <h2>4. Improve My Plan</h2>
          <Amount
            label="Minimum Profit to Keep (USD)"
            value={goal}
            onChange={p.onGoal}
          />
          <p className="caption">
            New product uploads start at 50% of positive no-discount profit, or
            $0 if that profit is negative. This is an editable planning starting
            point, not a guarantee. Baseline profit:{" "}
            {money(baseline.contribution)}.
          </p>
          <Amount
            label="Additional Safety Buffer (USD)"
            value={buffer}
            onChange={p.onBuffer}
          />
          <p className="caption">
            Recommendations must keep at least {money(goal + buffer)}: your
            minimum goal plus this extra cushion. The buffer is not a modeled
            cost.
          </p>
          {(a.stack !== 0 || a.shipping !== 0 || a.returns !== 0) && (
            <div className="notice">
              Extra costs or discounts from Advanced Mode are active: order
              discount {percent(a.stack)}, shipping {money(a.shipping)} per
              unit, return increase {percent(a.returns)}. Switch modes to edit
              them.
            </div>
          )}
          <button
            className="primary full improve"
            onClick={() => setShow(true)}
          >
            Improve My Plan
          </button>
          <p className="caption">
            We keep required offers, correct offers outside your rules, then
            reduce discretionary discounts only as much as needed. Ordinary
            products change first; must-promote products and preferred offers
            are protected longer. Required offers may lower profit if your
            current plan does not honor them. No extra sales are assumed.
          </p>
          {show && (
            <div className="suggestion" aria-live="polite">
              {!recommendation.feasible ? (
                <DiagnosticSummary
                  title="Your Discount Goals Can't All Be Met"
                  errors={recommendation.errors}
                  skus={skus}
                />
              ) : (
                <>
                  <h3>Current Plan → Suggested Plan</h3>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Measure</th>
                          <th>Current Plan</th>
                          <th>Suggested Plan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          [
                            "Expected Sales",
                            current.revenue,
                            suggestion!.revenue,
                          ],
                          [
                            "Profit After Variable Costs",
                            current.contribution,
                            suggestion!.contribution,
                          ],
                          [
                            "Change in Profit",
                            current.contribution - baseline.contribution,
                            suggestion!.contribution - baseline.contribution,
                          ],
                          [
                            "Products Losing Money",
                            current.negative,
                            suggestion!.negative,
                          ],
                        ].map(([label, before, after]) => (
                          <tr key={label}>
                            <td>{label}</td>
                            <td>
                              {label === "Products Losing Money"
                                ? before
                                : money(before as number)}
                            </td>
                            <td>
                              {label === "Products Losing Money"
                                ? after
                                : money(after as number)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="caption">
                    Suggested profit changes by{" "}
                    {money(suggestion!.contribution - current.contribution)}{" "}
                    versus the current plan. {recommendation.changes.length}{" "}
                    product discount changes required. Goal plus buffer: met.
                  </p>
                  <details>
                    <summary>Review discount changes</summary>
                    {recommendation.changes.map((c) => (
                      <p key={c.id}>
                        {c.id}: {percent(c.before)} → {percent(c.after)}
                      </p>
                    ))}
                    {!recommendation.changes.length && (
                      <p>
                        Your current plan already meets all hard rules and the
                        goal.
                      </p>
                    )}
                  </details>
                  {recommendation.preferredWarnings.map((w) => (
                    <p className="caption" key={w}>
                      {w}
                    </p>
                  ))}
                  <button
                    className="secondary full"
                    onClick={() => {
                      p.onApply(recommendation.discounts!);
                      setShow(false);
                    }}
                  >
                    Use Suggested Plan
                  </button>
                </>
              )}
            </div>
          )}
        </section>
        <ProfitChart
          skus={skus}
          current={discounts}
          suggested={recommendation.discounts}
          a={a}
          goal={goal}
          buffer={buffer}
          rules={rules}
        />
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Which products need attention?</h2>
              <p>
                Adjust offers individually or in bulk. Marking a product
                Must-Promote keeps at least its current discount; edit that
                commitment under Set Discounts.
              </p>
            </div>
            <button className="secondary" onClick={out}>
              Export plan & recommendations
            </button>
          </div>
          <div className="table-filters">
            <input
              aria-label="Search products"
              placeholder="Search product or SKU"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
            />
            <label className="checkbox">
              <input
                type="checkbox"
                checked={lossOnly}
                onChange={(e) => {
                  setLossOnly(e.target.checked);
                  setPage(0);
                }}
              />{" "}
              Losing money only
            </label>
          </div>
          <div className="bulk-controls">
            <Amount
              label="Bulk special discount (%)"
              value={bulk}
              max={100}
              onChange={setBulk}
            />
            <button
              className="secondary"
              disabled={!selected.length}
              onClick={() =>
                p.onApply({
                  ...discounts,
                  ...Object.fromEntries(selected.map((id) => [id, bulk / 100])),
                })
              }
            >
              Apply discount to {selected.length} products
            </button>
            <button
              className="text-button"
              disabled={!selected.length}
              onClick={() =>
                p.onRules([
                  ...rules,
                  ...selected
                    .filter((id) => !rules.some((r) => r.id === id))
                    .map((id) => ({
                      id,
                      min: discountFor(discounts, id) ?? 0,
                    })),
                ])
              }
            >
              Mark selected Must-Promote
            </button>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>
                    <input
                      aria-label="Select all matching products for discounts"
                      type="checkbox"
                      checked={
                        filtered.length > 0 &&
                        filtered.every((l) => selected.includes(l.sku.id))
                      }
                      onChange={(e) =>
                        setSelected(
                          e.target.checked
                            ? [
                                ...new Set([
                                  ...selected,
                                  ...filtered.map((l) => l.sku.id),
                                ]),
                              ]
                            : selected.filter(
                                (id) => !filtered.some((l) => l.sku.id === id),
                              ),
                        )
                      }
                    />
                  </th>
                  <th>Product</th>
                  <th>Discount (%)</th>
                  <th>Expected Sales</th>
                  <th>Profit After Variable Costs</th>
                  <th>Must-Promote</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(at * 15, at * 15 + 15).map((l) => (
                  <tr key={l.sku.id}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Select ${l.sku.id} for discount`}
                        checked={selected.includes(l.sku.id)}
                        onChange={(e) =>
                          setSelected(
                            e.target.checked
                              ? [...selected, l.sku.id]
                              : selected.filter((id) => id !== l.sku.id),
                          )
                        }
                      />
                    </td>
                    <td>
                      <b>{l.sku.name}</b>
                      <small>
                        {l.sku.id} · {l.sku.category}
                      </small>
                    </td>
                    <td>
                      <input
                        className="discount-input"
                        aria-label={`${l.sku.id} special discount percent`}
                        type="number"
                        min="0"
                        max="100"
                        step="any"
                        value={+(l.discount * 100).toFixed(6)}
                        onChange={(e) => {
                          if (Number.isFinite(e.target.valueAsNumber))
                            p.onOverride(
                              l.sku.id,
                              Math.min(
                                1,
                                Math.max(0, e.target.valueAsNumber / 100),
                              ),
                            );
                        }}
                      />
                    </td>
                    <td>{money(l.revenue)}</td>
                    <td className={l.contribution < 0 ? "loss" : "profit"}>
                      {money(l.contribution)}{" "}
                      {l.contribution < 0 ? "· Losing money" : ""}
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Must-promote ${l.sku.id}`}
                        checked={rules.some((r) => r.id === l.sku.id)}
                        onChange={(e) =>
                          p.onRules(
                            e.target.checked
                              ? [...rules, { id: l.sku.id, min: l.discount }]
                              : rules.filter((r) => r.id !== l.sku.id),
                          )
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pagination">
            <span>
              {filtered.length} products · Page {at + 1} / {pages}
            </span>
            <button disabled={!at} onClick={() => setPage(at - 1)}>
              Previous
            </button>
            <button disabled={at + 1 >= pages} onClick={() => setPage(at + 1)}>
              Next
            </button>
          </div>
        </section>
        <footer>
          MarginGuard BFCM{" "}
          <span>
            Your data stays in this browser. No financial data is sent to a
            server.
          </span>
        </footer>
      </main>
    </div>
  );
}
