import { useMemo, useState } from "react";
import demo from "../sku_master.csv?raw";
import {
  portfolio,
  scenario,
  optimize,
  defaults,
  minimums,
  discountFor,
  constraintErrors,
  crossing,
  type SKU,
  type Priority,
  type Discounts,
  type Assumptions,
  type Point,
} from "./engine";
import {
  parseSKUs,
  parsePriorities,
  template,
  priorityTemplate,
  download,
  exportCSV,
} from "./csv";
const initial = parseSKUs(demo);
const money = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
const pct = (n: number | null) =>
  n === null ? "—" : `${(n * 100).toFixed(1)}%`;
function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <label className="field">
      {label}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const n = e.target.valueAsNumber;
          if (Number.isFinite(n))
            onChange(Math.max(min, Math.min(max ?? Infinity, n)));
        }}
      />
    </label>
  );
}
function Frontier({ points, floor }: { points: Point[]; floor: number }) {
  const [selected, setSelected] = useState(0);
  if (!points.length)
    return (
      <p className="empty">
        Resolve required discount constraints to generate a feasible frontier.
      </p>
    );
  const width = 900,
    height = 245,
    pad = 44,
    lo = Math.min(0, floor, ...points.map((p) => p.contribution)),
    hi = Math.max(1, floor, ...points.map((p) => p.contribution)),
    y = (v: number) =>
      height - pad - ((v - lo) / (hi - lo)) * (height - 2 * pad),
    x = (i: number) =>
      pad + (i / Math.max(1, points.length - 1)) * (width - 2 * pad);
  const at = Math.min(selected, points.length - 1),
    p = points[at],
    floorCross = crossing(points, floor),
    zeroCross = crossing(points, 0);
  return (
    <>
      <svg
        className="frontier"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Contribution profit across cumulative discount allocations"
      >
        {[lo, (hi + lo) / 2, hi].map((v, i) => (
          <g key={i}>
            <line
              x1={pad}
              x2={width - pad}
              y1={y(v)}
              y2={y(v)}
              stroke="#e3e9e7"
            />
            <text x={pad} y={y(v) - 7} fontSize="11" fill="#6a7a78">
              {money(v)}
            </text>
          </g>
        ))}
        <line
          x1={pad}
          x2={width - pad}
          y1={y(floor)}
          y2={y(floor)}
          stroke="#bd6e36"
          strokeDasharray="5 5"
        />
        <text
          x={width - pad}
          y={y(floor) - 7}
          textAnchor="end"
          fill="#945424"
          fontSize="11"
        >
          Profit floor · {money(floor)}
        </text>
        <line x1={pad} x2={width - pad} y1={y(0)} y2={y(0)} stroke="#b2bebb" />
        <path
          d={points
            .map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.contribution)}`)
            .join(" ")}
          fill="none"
          stroke="#087b66"
          strokeWidth="3"
        />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={x(i)}
            cy={y(p.contribution)}
            r={i === at ? 6 : 3}
            fill={p.belowFloor ? "#c56c3d" : "#087b66"}
          >
            <title>
              {i}: {p.id} — {money(p.contribution)}
            </title>
          </circle>
        ))}
        <text x={pad} y={height - 9} fontSize="11" fill="#6a7a78">
          Required discounts
        </text>
        <text
          x={width - pad}
          y={height - 9}
          textAnchor="end"
          fontSize="11"
          fill="#6a7a78"
        >
          Cumulative SKU allocations →
        </text>
      </svg>
      <label className="scrubber">
        Explore allocation {at} of {points.length - 1}
        <input
          aria-label="Explore frontier allocation"
          type="range"
          min="0"
          max={points.length - 1}
          value={at}
          onChange={(e) => setSelected(+e.target.value)}
        />
      </label>
      <div className="chart-foot">
        <span>
          <b>{p.id}</b> · {money(p.contribution)} contribution{" "}
          {p.belowFloor ? "· Below floor" : ""}
        </span>
        <span>
          Floor crossing:{" "}
          {floorCross === null ? "none" : `allocation ${floorCross.toFixed(2)}`}{" "}
          · Zero crossing:{" "}
          {zeroCross === null ? "none" : `allocation ${zeroCross.toFixed(2)}`}
        </span>
      </div>
    </>
  );
}
export default function App() {
  const [skus, setSkus] = useState<SKU[]>(initial.skus),
    [source, setSource] = useState("Synthetic demo · 30 fictional SKUs"),
    [warnings, setWarnings] = useState(initial.warnings),
    [error, setError] = useState("");
  const [mode, setMode] = useState<"manual" | "optimized">("optimized"),
    [uniform, setUniform] = useState(0.1),
    [categories, setCategories] = useState<Discounts>({}),
    [overrides, setOverrides] = useState<Discounts>({}),
    [floor, setFloor] = useState(27590.74),
    [a, setA] = useState<Assumptions>(defaults),
    [priorities, setPriorities] = useState<Priority[]>([]),
    [objective, setObjective] = useState<"discount" | "profit">("discount");
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("All categories"),
    [onlyLoss, setOnlyLoss] = useState(false),
    [page, setPage] = useState(0),
    [priorityId, setPriorityId] = useState("ELE-001"),
    [priorityMin, setPriorityMin] = useState(0.2),
    [priorityPreferred, setPriorityPreferred] = useState(0.2),
    [saved, setSaved] = useState<
      {
        name: string;
        revenue: number;
        gross: number;
        contribution: number;
        negative: number;
      }[]
    >([]),
    [scenarioName, setScenarioName] = useState("BFCM plan");
  const calculated = useMemo(() => {
    try {
      const baseline = portfolio(skus),
        opt = optimize(skus, floor, priorities, a, objective),
        ds =
          mode === "optimized"
            ? opt.discounts
            : scenario(skus, uniform, categories, overrides),
        current = portfolio(skus, ds, a),
        issues = constraintErrors(skus, ds, priorities);
      if (current.contribution < floor - 1e-6)
        issues.push(
          `Portfolio contribution is ${money(floor - current.contribution)} below your floor.`,
        );
      return { baseline, opt, ds, current, issues, error: "" };
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [
    skus,
    floor,
    priorities,
    a,
    objective,
    mode,
    uniform,
    categories,
    overrides,
  ]);
  const cats = [...new Set(skus.map((s) => s.category))].sort();
  const baseById = new Map(
    calculated.baseline?.lines.map((l) => [l.sku.id, l]),
  );
  async function upload(file: File | undefined, priority = false) {
    if (!file) return;
    setError("");
    try {
      if (file.size > 5_000_000) throw Error("File exceeds 5 MB limit");
      const text = await file.text();
      if (priority) {
        setPriorities(parsePriorities(text, skus));
      } else {
        const data = parseSKUs(text);
        setSkus(data.skus);
        setSource(file.name);
        setWarnings(data.warnings);
        setCategories({});
        setOverrides({});
        setPriorities([]);
        setSaved([]);
        setCategory("All categories");
        setPage(0);
        setPriorityId(data.skus[0].id);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function demoReset() {
    setSkus(initial.skus);
    setWarnings(initial.warnings);
    setSource("Synthetic demo · 30 fictional SKUs");
    setCategories({});
    setOverrides({});
    setPriorities([]);
    setSaved([]);
    setCategory("All categories");
    setPage(0);
    setA(defaults);
    setFloor(27590.74);
    setPriorityId("ELE-001");
  }
  const c = calculated.current,
    b = calculated.baseline,
    opt = calculated.opt;
  const categoryMetrics = new Map<string, { base: number; total: number }>();
  for (const l of b?.lines ?? [])
    categoryMetrics.set(l.sku.category, {
      base: (categoryMetrics.get(l.sku.category)?.base ?? 0) + l.contribution,
      total: 0,
    });
  for (const l of c?.lines ?? []) {
    const entry = categoryMetrics.get(l.sku.category)!;
    entry.total += l.contribution;
  }
  const categoryScale = Math.max(
    1,
    ...[...categoryMetrics.values()].flatMap((v) => [
      Math.abs(v.base),
      Math.abs(v.total),
    ]),
  );
  const filtered = (c?.lines ?? []).filter(
    (l) =>
      (category === "All categories" || l.sku.category === category) &&
      (!onlyLoss || l.contribution < 0) &&
      `${l.sku.id} ${l.sku.name}`.toLowerCase().includes(query.toLowerCase()),
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / 20)),
    visiblePage = Math.min(page, totalPages - 1);
  return (
    <div className="app">
      <aside className="sidebar">
        <a href="#" className="brand">
          <span className="brand-icon">M</span> MarginGuard
          <span className="brand-sub">BFCM EDITION</span>
        </a>
        <div className="workspace-label">YOUR WORKSPACE</div>
        <nav>
          <a className="active" href="#overview">
            ▦ &nbsp; Campaign planner
          </a>
          <a href="#sku-table">☷ &nbsp; SKU profitability</a>
          <a href="#comparison">⇄ &nbsp; Scenario comparison</a>
          <a href="#method">ⓘ &nbsp; Model & assumptions</a>
        </nav>
        <div className="sidebar-bottom">
          <span className="lock">◈</span>
          <b>Your numbers stay yours.</b>
          <p>
            Calculations run in this browser. No financial data is sent to a
            server.
          </p>
          <span className="local-dot">●</span> Local computation only
        </div>
      </aside>
      <main>
        <header className="topbar">
          <span>
            Workspace <span className="slash">/</span> BFCM planning
          </span>
          <span className="badge">
            PHASE 1 <span>·</span> BROWSER ONLY
          </span>
        </header>
        <div className="content">
          <section className="heading" id="overview">
            <div>
              <div className="eyebrow">PLAN WITH CONFIDENCE</div>
              <h1>Make every discount count.</h1>
              <p>
                Build a compelling BFCM offer. Keep your contribution profit in
                sight.
              </p>
            </div>
            <button
              className="secondary"
              onClick={() => download("marginguard-sku-template.csv", template)}
            >
              ↓ CSV template
            </button>
          </section>
          <section className="data-strip">
            <div>
              <span className="data-icon">▤</span>
              <div>
                <b>{source}</b>
                <small>{skus.length} SKUs · USD · fixed expected sales</small>
              </div>
            </div>
            <div className="actions">
              <button className="text-button" onClick={demoReset}>
                Load demo
              </button>
              <label className="button primary">
                ↑ Upload SKU CSV
                <input
                  aria-label="Upload SKU CSV"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => {
                    void upload(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          </section>
          {(error || calculated.error) && (
            <div role="alert" className="notice danger">
              {error || calculated.error}
            </div>
          )}
          {warnings.length > 0 && (
            <details className="notice">
              <summary>{warnings.length} input assumptions to review</summary>
              <ul>
                {warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
              <p>Upload the complete template to replace these defaults.</p>
            </details>
          )}
          <div className="workspace-grid">
            <div className="results">
              <div className="section-title">
                <h2>Campaign overview</h2>
                <span className="badge subtle">
                  {mode === "optimized"
                    ? "OPTIMIZED ALLOCATION"
                    : "SCENARIO PREVIEW"}
                </span>
              </div>
              {c && b && (
                <>
                  <section className="cards">
                    {[
                      [
                        "Net revenue",
                        c.revenue,
                        b.revenue,
                        "After promotional discounts",
                      ],
                      [
                        "Gross profit",
                        c.gross,
                        b.gross,
                        `${pct(c.grossMargin)} gross margin`,
                      ],
                      [
                        "Contribution profit",
                        c.contribution,
                        b.contribution,
                        `${pct(c.contributionMargin)} contribution margin`,
                      ],
                    ].map(([label, value, base, detail]) => (
                      <article
                        className={`card ${label === "Contribution profit" ? "featured" : ""}`}
                        key={label}
                      >
                        <span>{label}</span>
                        <strong>{money(value as number)}</strong>
                        <small>{detail}</small>
                        <div className="card-delta">
                          {money((value as number) - (base as number))}{" "}
                          <span>vs. no discounts</span>
                        </div>
                      </article>
                    ))}
                  </section>
                  <div
                    className={`notice ${c.contribution < floor - 1e-6 ? "danger" : "success"}`}
                  >
                    <b>
                      {c.contribution < floor - 1e-6
                        ? "Profit floor breached"
                        : "Portfolio floor protected"}
                    </b>
                    <span>
                      {money(c.contribution - floor)} headroom · {c.negative}{" "}
                      SKUs have negative contribution profit.
                    </span>
                  </div>
                  {calculated.issues!.length > 0 && (
                    <details className="notice danger" open>
                      <summary>
                        {calculated.issues!.length} scenario constraint
                        warning(s)
                      </summary>
                      <ul>
                        {calculated.issues!.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                  {mode === "optimized" && opt && !opt.feasible && (
                    <div role="alert" className="notice danger">
                      <b>
                        Optimization infeasible — required-discount diagnostic
                        shown
                      </b>
                      {opt.errors.map((s) => (
                        <p key={s}>{s}</p>
                      ))}
                    </div>
                  )}
                  {mode === "optimized" &&
                    opt?.preferredWarnings.map((s) => (
                      <div className="notice" key={s}>
                        {s}
                      </div>
                    ))}
                  <section className="panel chart-panel">
                    <div className="panel-heading">
                      <div>
                        <h2>Cumulative profitability frontier</h2>
                        <p>See how much room your campaign has to give.</p>
                      </div>
                      <span className="legend">
                        <i />
                        Contribution profit
                      </span>
                    </div>
                    <Frontier points={opt?.points ?? []} floor={floor} />
                    <p className="caption">
                      Continuous weighted allocation: required minimums first,
                      then descending allocation weight per dollar of
                      contribution consumed; ties use SKU ID. P1 discounts are
                      fixed at required minimums. The curve continues to maximum
                      bounds to reveal breaches, independent of the scenario
                      preview.
                    </p>
                  </section>
                  <section className="panel">
                    <div className="panel-heading">
                      <div>
                        <h2>Contribution by category</h2>
                        <p>
                          Compare baseline and promotional profit, including
                          variable costs.
                        </p>
                      </div>
                    </div>
                    <div className="category-legend">
                      <span>● No discounts</span>
                      <span>● Current scenario</span>
                    </div>
                    {cats.map((cat) => {
                      const { total, base } = categoryMetrics.get(cat)!,
                        scale = categoryScale;
                      return (
                        <div className="category-chart" key={cat}>
                          <b>{cat}</b>
                          <div>
                            <div
                              className="bar baseline"
                              style={{
                                width: `${(Math.abs(base) / scale) * 100}%`,
                              }}
                            />
                            <div
                              className={`bar ${total < 0 ? "negative" : ""}`}
                              style={{
                                width: `${(Math.abs(total) / scale) * 100}%`,
                              }}
                            />
                          </div>
                          <span>
                            {money(base)} →{" "}
                            <strong className={total < 0 ? "loss" : ""}>
                              {money(total)}
                            </strong>
                          </span>
                        </div>
                      );
                    })}
                    <p className="caption">
                      Bar lengths show absolute contribution. Negative
                      promotional values are orange and labeled with a minus
                      sign.
                    </p>
                  </section>
                  <section className="panel" id="sku-table">
                    <div className="panel-heading">
                      <div>
                        <h2>SKU profitability</h2>
                        <p>Spot the products that need a closer look.</p>
                      </div>
                      <button
                        className="secondary"
                        onClick={() =>
                          download(
                            "marginguard-results.csv",
                            exportCSV(
                              c.lines.map((l) => ({
                                SKU: l.sku.id,
                                Discount: l.discount,
                                Units: l.units,
                                Baseline_Revenue: baseById.get(l.sku.id)!
                                  .revenue,
                                Baseline_Gross_Profit: baseById.get(l.sku.id)!
                                  .gross,
                                Baseline_Contribution: baseById.get(l.sku.id)!
                                  .contribution,
                                Revenue: l.revenue,
                                Gross_Profit: l.gross,
                                Gross_Margin: l.margin,
                                Contribution_Profit: l.contribution,
                                Contribution_Margin: l.revenue
                                  ? l.contribution / l.revenue
                                  : null,
                              })),
                            ),
                          )
                        }
                      >
                        ↓ Export
                      </button>
                    </div>
                    <div className="table-filters">
                      <input
                        aria-label="Search SKUs"
                        placeholder="Search SKU or product…"
                        value={query}
                        onChange={(e) => {
                          setQuery(e.target.value);
                          setPage(0);
                        }}
                      />
                      <select
                        aria-label="Filter category"
                        value={category}
                        onChange={(e) => {
                          setCategory(e.target.value);
                          setPage(0);
                        }}
                      >
                        <option>All categories</option>
                        {cats.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                      <label className="checkbox">
                        <input
                          type="checkbox"
                          checked={onlyLoss}
                          onChange={(e) => {
                            setOnlyLoss(e.target.checked);
                            setPage(0);
                          }}
                        />{" "}
                        Loss only
                      </label>
                    </div>
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Product / SKU</th>
                            <th>Priority</th>
                            <th>Units</th>
                            <th>Discount</th>
                            <th>
                              Revenue
                              <br />
                              <small>Base → promo</small>
                            </th>
                            <th>
                              Gross profit
                              <br />
                              <small>Base → promo</small>
                            </th>
                            <th>Gross margin</th>
                            <th>
                              Contribution
                              <br />
                              <small>Base → promo</small>
                            </th>
                            <th>Contribution margin</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered
                            .slice(visiblePage * 20, visiblePage * 20 + 20)
                            .map((l) => {
                              const base = baseById.get(l.sku.id)!;
                              return (
                                <tr key={l.sku.id}>
                                  <td>
                                    <b>{l.sku.name}</b>
                                    <small>
                                      {l.sku.id} · {l.sku.category}
                                    </small>
                                  </td>
                                  <td>
                                    <span
                                      className={`priority ${l.sku.priority}`}
                                    >
                                      {l.sku.priority}
                                    </span>
                                  </td>
                                  <td>{l.units}</td>
                                  <td>
                                    {mode === "manual" ? (
                                      <input
                                        className="discount-input"
                                        type="number"
                                        aria-label={`${l.sku.id} discount percent`}
                                        min="0"
                                        max="100"
                                        step="0.1"
                                        value={+(l.discount * 100).toFixed(3)}
                                        onChange={(e) => {
                                          const n = e.target.valueAsNumber;
                                          if (Number.isFinite(n))
                                            setOverrides({
                                              ...overrides,
                                              [l.sku.id]: Math.min(
                                                1,
                                                Math.max(0, n / 100),
                                              ),
                                            });
                                        }}
                                      />
                                    ) : (
                                      pct(l.discount)
                                    )}
                                    {mode === "manual" ? "%" : ""}
                                  </td>
                                  <td>
                                    <small>{money(base.revenue)} →</small>
                                    {money(l.revenue)}
                                  </td>
                                  <td>
                                    <small>{money(base.gross)} →</small>
                                    {money(l.gross)}
                                  </td>
                                  <td>{pct(l.margin)}</td>
                                  <td
                                    className={
                                      l.contribution < 0 ? "loss" : "profit"
                                    }
                                  >
                                    <small>{money(base.contribution)} →</small>
                                    {money(l.contribution)}
                                    {l.contribution < 0 && (
                                      <small className="loss">LOSS</small>
                                    )}
                                  </td>
                                  <td>
                                    {pct(
                                      l.revenue
                                        ? l.contribution / l.revenue
                                        : null,
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                    {!filtered.length && (
                      <p className="empty">No SKUs match your filters.</p>
                    )}
                    <div className="pagination">
                      <span>
                        {filtered.length} SKUs · Page {visiblePage + 1} /{" "}
                        {totalPages}
                      </span>
                      <button
                        disabled={!visiblePage}
                        onClick={() => setPage(visiblePage - 1)}
                      >
                        Previous
                      </button>
                      <button
                        disabled={visiblePage + 1 >= totalPages}
                        onClick={() => setPage(visiblePage + 1)}
                      >
                        Next
                      </button>
                    </div>
                  </section>
                  <section className="panel" id="comparison">
                    <div className="panel-heading">
                      <div>
                        <h2>Scenario comparison</h2>
                        <p>
                          Snapshots stay in memory until you reload or replace
                          data.
                        </p>
                      </div>
                    </div>
                    <div className="snapshot">
                      <input
                        aria-label="Scenario name"
                        value={scenarioName}
                        onChange={(e) => setScenarioName(e.target.value)}
                        maxLength={80}
                      />
                      <button
                        className="secondary"
                        disabled={!opt?.feasible && mode === "optimized"}
                        onClick={() =>
                          setSaved([
                            ...saved,
                            {
                              name: scenarioName || "Untitled",
                              revenue: c.revenue,
                              gross: c.gross,
                              contribution: c.contribution,
                              negative: c.negative,
                            },
                          ])
                        }
                      >
                        Save snapshot
                      </button>
                    </div>
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Scenario</th>
                            <th>Revenue</th>
                            <th>Gross profit</th>
                            <th>Contribution</th>
                            <th>Loss SKUs</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { name: "No discounts", ...b },
                            { name: "Current preview", ...c },
                            ...saved,
                          ].map((s, i) => (
                            <tr key={i}>
                              <td>{s.name}</td>
                              <td>{money(s.revenue)}</td>
                              <td>{money(s.gross)}</td>
                              <td className={s.contribution < 0 ? "loss" : ""}>
                                {money(s.contribution)}
                              </td>
                              <td>{s.negative}</td>
                              <td>
                                {i > 1 && (
                                  <button
                                    aria-label={`Remove ${s.name}`}
                                    onClick={() =>
                                      setSaved(
                                        saved.filter((_, j) => j !== i - 2),
                                      )
                                    }
                                  >
                                    ×
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </>
              )}
            </div>
            <aside className="controls">
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <div className="eyebrow">YOUR OFFER</div>
                    <h2>Scenario builder</h2>
                  </div>
                  <span>⚙</span>
                </div>
                <div className="tabs">
                  <button
                    className={mode === "manual" ? "selected" : ""}
                    onClick={() => setMode("manual")}
                  >
                    Manual scenario
                  </button>
                  <button
                    className={mode === "optimized" ? "selected" : ""}
                    onClick={() => setMode("optimized")}
                  >
                    Optimize
                  </button>
                </div>
                <NumberField
                  label="Contribution profit floor (USD)"
                  value={floor}
                  onChange={setFloor}
                  min={-1e12}
                  step={100}
                />
                {mode === "manual" ? (
                  <>
                    <div className="range-heading">
                      <b>Uniform discount</b>
                      <strong>{pct(uniform)}</strong>
                    </div>
                    <input
                      aria-label="Uniform discount"
                      type="range"
                      min="0"
                      max="100"
                      value={uniform * 100}
                      onChange={(e) => setUniform(+e.target.value / 100)}
                    />
                    <div className="range-labels">
                      <span>0%</span>
                      <span>100%</span>
                    </div>
                    <details>
                      <summary>Category overrides</summary>
                      {cats.map((cat) => (
                        <label className="field" key={cat}>
                          {cat} (%)
                          <input
                            type="number"
                            placeholder="Use uniform"
                            min="0"
                            max="100"
                            value={
                              discountFor(categories, cat) === undefined
                                ? ""
                                : discountFor(categories, cat)! * 100
                            }
                            onChange={(e) => {
                              const next = { ...categories };
                              if (e.target.value === "") delete next[cat];
                              else if (Number.isFinite(e.target.valueAsNumber))
                                next[cat] = Math.max(
                                  0,
                                  Math.min(1, e.target.valueAsNumber / 100),
                                );
                              setCategories(next);
                            }}
                          />
                        </label>
                      ))}
                    </details>
                    <p className="caption">
                      SKU overrides in the table take precedence over category
                      and uniform discounts. Manual scenarios may violate
                      constraints; warnings show every conflict.
                    </p>
                    <button
                      className="text-button"
                      onClick={() => {
                        setCategories({});
                        setOverrides({});
                      }}
                    >
                      Clear category & SKU overrides
                    </button>
                    <button
                      className="secondary full"
                      onClick={() => {
                        setOverrides(minimums(skus));
                        setCategories({});
                        setUniform(0);
                      }}
                    >
                      Preview required discounts only
                    </button>
                  </>
                ) : (
                  <>
                    <label className="field">
                      Optimization objective
                      <select
                        value={objective}
                        onChange={(e) =>
                          setObjective(e.target.value as typeof objective)
                        }
                      >
                        <option value="discount">
                          Maximize weighted discounts
                        </option>
                        <option value="profit">
                          Maximize contribution profit
                        </option>
                      </select>
                    </label>
                    <p className="caption">
                      {objective === "discount"
                        ? "Exact continuous allocation of Σ(weight × discount). Fractional discounts may be required to meet the floor."
                        : "Fixed sales mean discounts reduce contribution. The optimal allocation uses required minimums."}{" "}
                      Discrete Step_Discount is reference data; this optimizer
                      uses continuous bounds.
                    </p>
                    <button
                      className="secondary full"
                      onClick={() => {
                        if (opt?.feasible) {
                          setOverrides(opt.discounts);
                          setUniform(0);
                          setCategories({});
                          setMode("manual");
                        }
                      }}
                      disabled={!opt?.feasible}
                    >
                      Use allocation in manual scenario
                    </button>
                  </>
                )}
                <div className="divider" />
                <h3>Priority SKUs</h3>
                <p className="caption">
                  Dataset minimums always apply. Add stricter minimums or soft
                  preferences here. P1 stays locked during optimization.
                </p>
                <label className="field">
                  Select SKU
                  <select
                    value={priorityId}
                    onChange={(e) => setPriorityId(e.target.value)}
                  >
                    {skus.map((s) => (
                      <option key={s.id}>{s.id}</option>
                    ))}
                  </select>
                </label>
                <div className="two-fields">
                  <NumberField
                    label="Minimum (%)"
                    value={priorityMin * 100}
                    max={100}
                    onChange={(n) => setPriorityMin(n / 100)}
                  />
                  <NumberField
                    label="Preferred (%)"
                    value={priorityPreferred * 100}
                    max={100}
                    onChange={(n) => setPriorityPreferred(n / 100)}
                  />
                </div>
                <button
                  className="secondary full"
                  onClick={() => {
                    if (priorityPreferred < priorityMin) {
                      setError(
                        "Preferred discount must be at least the minimum.",
                      );
                      return;
                    }
                    setError("");
                    setPriorities([
                      ...priorities.filter((p) => p.id !== priorityId),
                      {
                        id: priorityId,
                        min: priorityMin,
                        preferred: priorityPreferred,
                      },
                    ]);
                  }}
                >
                  Add / update priority
                </button>
                {priorities.map((p) => (
                  <div className="priority-row" key={p.id}>
                    <span>
                      <b>{p.id}</b>
                      <small>
                        Min {pct(p.min)} · Prefer {pct(p.preferred ?? p.min)}
                      </small>
                    </span>
                    <button
                      aria-label={`Remove priority ${p.id}`}
                      onClick={() =>
                        setPriorities(priorities.filter((x) => x.id !== p.id))
                      }
                    >
                      ×
                    </button>
                  </div>
                ))}
                <div className="actions priority-actions">
                  <label className="button secondary">
                    Upload list
                    <input
                      aria-label="Upload priority CSV"
                      type="file"
                      accept=".csv,text/csv"
                      onChange={(e) => {
                        void upload(e.target.files?.[0], true);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <button
                    className="text-button"
                    onClick={() =>
                      download("priority-template.csv", priorityTemplate)
                    }
                  >
                    ↓ Template
                  </button>
                </div>
                <div className="divider" />
                <details>
                  <summary>Stress assumptions</summary>
                  <NumberField
                    label="Extra order discount (%)"
                    value={a.stack * 100}
                    max={100}
                    onChange={(n) => setA({ ...a, stack: n / 100 })}
                  />
                  <NumberField
                    label="Extra shipping / unit (USD)"
                    value={a.shipping}
                    onChange={(n) => setA({ ...a, shipping: n })}
                    step={0.5}
                  />
                  <NumberField
                    label="Return rate shock (percentage points)"
                    value={a.returns * 100}
                    max={Math.max(
                      0,
                      Math.min(...skus.map((s) => (1 - s.returnRate) * 100)),
                    )}
                    onChange={(n) => setA({ ...a, returns: n / 100 })}
                  />
                </details>
              </section>
              <div className="model-note">
                <span>ⓘ</span>
                <div>
                  <b>A plan, not a demand forecast.</b>
                  <p>
                    Expected sales stay fixed. No elasticity or demand lift is
                    inferred from discounts.
                  </p>
                </div>
              </div>
            </aside>
          </div>
          <section className="panel methodology" id="method">
            <h2>Know what’s behind the numbers.</h2>
            <div className="method-grid">
              <div>
                <h3>Revenue & gross profit</h3>
                <p>
                  Units = min(expected sales, inventory). Revenue = price × (1 −
                  SKU discount) × (1 − extra order discount) × units. Gross
                  profit = revenue − COGS × units. Gross margin = gross profit /
                  revenue.
                </p>
              </div>
              <div>
                <h3>Contribution profit</h3>
                <p>
                  Gross profit less percentage payment fees and per-unit
                  allocated payment fees, fulfillment, merchant shipping, extra
                  shipping, other variable costs, and (return rate + shock) ×
                  return cost. Zero revenue margins display “—”.
                </p>
              </div>
              <div>
                <h3>Model boundaries</h3>
                <p>
                  USD only. One representative single-SKU order per unit.
                  Returns are incremental costs, not refunded revenue. Taxes,
                  fixed overhead, demand response, and real checkout stacking
                  rules are excluded. Baseline excludes stress assumptions;
                  preview includes them.
                </p>
              </div>
            </div>
          </section>
          <footer>
            MarginGuard BFCM{" "}
            <span>Built for better discount decisions. · Phase 1</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
