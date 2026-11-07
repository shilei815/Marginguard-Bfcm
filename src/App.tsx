import LaunchHelp from "./LaunchHelp";
import { useMemo, useState, useRef } from "react";
import MerchantView, { RuleEditor } from "./MerchantView";
import { initialGoal, parsePromotionCSV, type PromotionRule } from "./planner";
import {
  usd as money,
  wholeUSD,
  DisplayNumberInput,
  WarningSummary,
  DiagnosticSummary,
  CheckoutDiscountNotice,
} from "./presentation";
import TierControls, { TierSummary } from "./TierControls";
import {
  emptyTiers,
  optimizeTierCampaign,
  tierPlanWarnings,
  improveTierPlan,
  type TierState,
} from "./tiers";
import ImportSection from "./ImportSection";
import {
  importCampaign,
  costQuality,
  costColumns,
  type ImportedCampaign,
} from "./unifiedImport";
import { parseTierCSV } from "./tiers";
import demo from "../sku_master.csv?raw";
import {
  portfolio,
  scenario,
  defaults,
  minimums,
  discountFor,
  crossing,
  type SKU,
  type Discounts,
  type Assumptions,
  type Point,
} from "./engine";
import { download, exportCSV } from "./csv";
const synthetic = importCampaign(demo);
const initial: ImportedCampaign = {
  ...synthetic,
  demo: true,
  costsConfirmed: synthetic.costs.every(
    (c) => c.state !== "missing" || c.field === "Other_Variable_Cost_USD",
  ),
};
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
      <DisplayNumberInput
        value={value}
        digits={label.includes("USD") ? 2 : 6}
        min={min}
        max={max}
        step={step}
        onValueChange={(n) =>
          onChange(Math.max(min, Math.min(max ?? Infinity, n)))
        }
      />
    </label>
  );
}
function Frontier({
  points,
  floor,
  currentProfit,
  buffer,
}: {
  points: Point[];
  floor: number;
  currentProfit: number;
  buffer: number;
}) {
  const [selected, setSelected] = useState(0);
  if (!points.length)
    return (
      <p className="empty">
        Review the required offers and profit goal to generate this chart.
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
        aria-label="Profit after variable costs across product discount steps"
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
            <text x={pad} y={y(v) - 7} fontSize="11" fill="#4f665b">
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
          Minimum Profit Goal{buffer > 0 ? " + safety buffer" : ""} · {money(floor)}
        </text>
        <line x1={pad} x2={width - pad} y1={y(0)} y2={y(0)} stroke="#62796b" />
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
            fill={p.belowFloor ? "#a45336" : "#087b66"}
          >
            <title>
              {i}: {p.id === "Required discounts" ? "Minimum Required Offers" : p.id}
              {" — "}{money(p.contribution)}
            </title>
          </circle>
        ))}
        <text x={pad} y={height - 9} fontSize="11" fill="#4f665b">
          Minimum Required Offers
        </text>
        <text
          x={width - pad}
          y={height - 9}
          textAnchor="end"
          fontSize="11"
          fill="#4f665b"
        >
          Product Discount Steps →
        </text>
      </svg>
      <label className="scrubber">
        Product Discount Step {at} of {points.length - 1}
        <input
          aria-label="Explore product discount steps"
          type="range"
          min="0"
          max={points.length - 1}
          value={at}
          onChange={(e) => setSelected(+e.target.value)}
        />
      </label>
      <div className="chart-foot">
        <span>
          <b>{p.id === "Required discounts" ? "Minimum Required Offers" : p.id}</b>
          {" · "}{money(p.contribution)} Profit After Variable Costs{" "}
          {p.belowFloor ? "· Below minimum profit goal" : ""}
        </span>
        <span>
          Profit Goal Reached:{" "}
          {floorCross === null
            ? "no crossing below goal"
            : points[0].contribution < floor
              ? "starts below goal"
              : `product discount step ${floorCross.toFixed(2)}`}{" "}
          · Break-Even Point:{" "}
          {zeroCross === null
            ? "no crossing below break-even"
            : points[0].contribution < 0
              ? "starts below break-even"
              : `product discount step ${zeroCross.toFixed(2)}`}
        </span>
      </div>
      <p className="caption">
        Current plan:{" "}
        {currentProfit >= floor
          ? `${money(currentProfit - floor)} of modeled profit headroom remains above the minimum profit goal${buffer > 0 ? " plus safety buffer" : ""}.`
          : `${money(floor - currentProfit)} below the minimum profit goal${buffer > 0 ? " plus safety buffer" : ""}.`}
        {" "}The goal and break-even results above describe the full discount path,
        using the supplied costs and assumptions.
      </p>
    </>
  );
}
export default function App() {
  const [campaign, setCampaign] = useState<ImportedCampaign>(initial);
  const { skus, tiers, rules: priorities } = campaign;
  const warnings = campaign.costsConfirmed
    ? campaign.warnings.filter(
        (w) => !costColumns.some((f) => w.startsWith(f + " missing:")),
      )
    : campaign.warnings;
  const quality = costQuality(campaign.costs, campaign.costsConfirmed);
  const setSkus = (skus: SKU[]) => setCampaign((c) => ({ ...c, skus }));
  const setTiers = (tiers: TierState) => setCampaign((c) => ({ ...c, tiers }));
  const setPriorities = (rules: PromotionRule[]) =>
    setCampaign((c) => ({ ...c, rules }));
  const confirmCosts = (costsConfirmed: boolean) =>
    setCampaign((c) => ({ ...c, costsConfirmed }));
  const [source, setSource] = useState("Synthetic demo · 30 fictional SKUs"),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const importToken = useRef(0);
  const [advanced, setAdvanced] = useState(false),
    [mobileNavOpen, setMobileNavOpen] = useState(false),
    [buffer, setBuffer] = useState(0),
    [dataVersion, setDataVersion] = useState(0);
  const [mode, setMode] = useState<"manual" | "optimized">("manual"),
    [uniform, setUniform] = useState(0.1),
    [categories, setCategories] = useState<Discounts>({}),
    [overrides, setOverrides] = useState<Discounts>({}),
    [floor, setFloor] = useState(initialGoal(initial.skus)),
    [a, setA] = useState<Assumptions>(defaults),
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
    [scenarioName, setScenarioName] = useState("Promotion plan");
  const calculated = useMemo(() => {
    try {
      const baseline = portfolio(skus),
        opt = optimizeTierCampaign(
          skus,
          floor + buffer,
          priorities,
          a,
          objective,
          tiers,
        ),
        ds =
          mode === "optimized"
            ? opt.discounts
            : scenario(skus, uniform, categories, overrides),
        current = portfolio(skus, ds, a),
        issues = tierPlanWarnings(
          skus,
          ds,
          priorities,
          tiers,
          floor,
          buffer,
          a,
        ),
        tierRecommendation = improveTierPlan(
          skus,
          ds,
          priorities,
          floor,
          buffer,
          a,
          tiers,
        );
      return {
        baseline,
        opt,
        ds,
        current,
        issues,
        tierRecommendation,
        error: "",
      };
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [
    tiers,
    skus,
    floor,
    buffer,
    priorities,
    a,
    objective,
    mode,
    uniform,
    categories,
    overrides,
  ]);
  function updateTiers(next: TierState) {
    // Tier editing is configuration, not an implicit Apply/Optimize action.
    if (mode === "optimized" && calculated.ds) {
      setOverrides(calculated.ds);
      setMode("manual");
    }
    setTiers(next);
  }
  const cats = [...new Set(skus.map((s) => s.category))].sort();
  const baseById = new Map(
    calculated.baseline?.lines.map((l) => [l.sku.id, l]),
  );
  async function upload(file: File | undefined, priority = false) {
    if (!file) return;
    const token = ++importToken.current;
    setError("");
    setNotice("");
    try {
      if (file.size > 5_000_000) throw Error("File exceeds 5 MB limit");
      const text = await file.text();
      if (token !== importToken.current) return;
      if (priority) {
        const rules = parsePromotionCSV(text, skus);
        setPriorities(rules);
        setNotice(
          `Loaded ${rules.length} custom discount rule sets. Products, tiers, costs and current planned offers are unchanged.`,
        );
      } else {
        const next = importCampaign(text);
        setCampaign(next);
        setDataVersion((v) => v + 1);
        setFloor(next.goal);
        setBuffer(0);
        setA(defaults);
        setMode("manual");
        setUniform(0.1);
        setSource(file.name);
        setCategories({});
        setOverrides(next.planned);
        setSaved([]);
        setCategory("All categories");
        setPage(0);
        setPriorityId(next.skus[0].id);
      }
    } catch (e) {
      if (token === importToken.current) setError((e as Error).message);
    }
  }
  async function uploadTier(file: File | undefined) {
    if (!file) return;
    const token = ++importToken.current;
    setError("");
    setNotice("");
    try {
      if (file.size > 5_000_000)
        throw Error("Tier CSV exceeds the 5 MB limit.");
      const text = await file.text();
      if (token !== importToken.current) return;
      const next = parseTierCSV(text, skus, priorities, tiers);
      updateTiers(next);
      setNotice(
        `Loaded ${Object.keys(next.assignments).length} tier assignments. Products, explicit rules and current offers are unchanged.`,
      );
    } catch (e) {
      if (token === importToken.current)
        setError("Tier list could not be loaded\n" + (e as Error).message);
    }
  }
  function demoReset() {
    importToken.current++;
    setCampaign(initial);
    setDataVersion((v) => v + 1);
    setSource("Synthetic demo · 30 fictional SKUs");
    setError("");
    setNotice("");
    setCategories({});
    setOverrides(initial.planned);
    setSaved([]);
    setCategory("All categories");
    setPage(0);
    setA(defaults);
    setFloor(initial.goal);
    setBuffer(0);
    setMode("manual");
    setUniform(0.1);
    setPriorityId(initial.skus[0].id);
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
  if (!advanced && !c)
    return (
      <div className="merchant-shell">
        <header className="topbar">
          <b>MarginGuard</b>
          <button onClick={() => setAdvanced(true)}>Advanced Mode</button>
        </header>
        <main className="merchant-main">
          <h1>Let's check your settings.</h1>
          <div role="alert" className="notice danger">
            We could not calculate this plan: {calculated.error}. Your campaign
            inputs are still here.
          </div>
          <NumberField
            label="Minimum Profit to Keep (USD)"
            value={floor}
            onChange={setFloor}
          />
          <NumberField
            label="Additional Safety Buffer (USD)"
            value={buffer}
            onChange={setBuffer}
          />
          <button onClick={() => setA(defaults)}>
            Clear extra cost and discount assumptions
          </button>
        </main>
      </div>
    );
  if (!advanced && c && calculated.ds)
    return (
      <MerchantView
        key={dataVersion}
        skus={skus}
        source={source}
        warnings={warnings}
        error={error}
        discounts={calculated.ds}
        uniform={uniform}
        categories={categories}
        rules={priorities}
        tiers={tiers}
        onTiers={updateTiers}
        goal={floor}
        buffer={buffer}
        a={a}
        advanced={advanced}
        allocationActive={mode === "optimized"}
        onToggle={() => setAdvanced(true)}
        onUpload={upload}
        campaign={campaign}
        onTierUpload={uploadTier}
        onConfirmCosts={confirmCosts}
        importNotice={notice}
        onDemo={demoReset}
        onRules={setPriorities}
        onGoal={setFloor}
        onBuffer={setBuffer}
        onUniform={(n) => {
          setUniform(n);
          if (mode === "optimized") setOverrides({});
          setMode("manual");
        }}
        onCategory={(name, n) => {
          const next = { ...categories };
          if (n === undefined) delete next[name];
          else next[name] = n;
          setCategories(next);
          if (mode === "optimized") setOverrides({});
          setMode("manual");
        }}
        onApply={(ds) => {
          setOverrides(ds);
          setMode("manual");
        }}
        onOverride={(id, n) => {
          setOverrides({
            ...(mode === "optimized" ? calculated.ds : overrides),
            [id]: n,
          });
          setMode("manual");
        }}
        onClear={() => {
          setOverrides({});
          setCategories({});
          setMode("manual");
        }}
      />
    );
  return (
    <div className="app">
      <aside className="sidebar">
        <a href="#" className="brand">
          <span className="brand-icon">M</span> MarginGuard
          <span className="brand-sub">DISCOUNT PLANNER</span>
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
          <div className="actions">
            <button
              onClick={() => {
                setAdvanced(false);
                setMobileNavOpen(false);
              }}
            >
              Simple Mode
            </button>
            <button
              className="mobile-nav-toggle"
              aria-expanded={mobileNavOpen}
              aria-controls="advanced-mobile-navigation"
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
            >
              Navigation
            </button>
          </div>
          <span className="workspace-crumb">
            Workspace <span className="slash">/</span> Promotion planning
          </span>
          <span className="badge">
            PHASE 2D <span>·</span> BROWSER ONLY
          </span>
        </header>
        <nav
          className="mobile-navigation"
          id="advanced-mobile-navigation"
          aria-label="Advanced mobile navigation"
          hidden={!mobileNavOpen}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setMobileNavOpen(false);
              document
                .querySelector<HTMLButtonElement>(".mobile-nav-toggle")
                ?.focus();
            }
          }}
        >
          {[
            ["overview", "Campaign planner"],
            ["sku-table", "SKU profitability"],
            ["comparison", "Scenario comparison"],
            ["method", "Model & assumptions"],
          ].map(([id, label]) => (
            <a key={id} href={"#" + id} onClick={() => setMobileNavOpen(false)}>
              {label}
            </a>
          ))}
        </nav>
        <div className="content">
          <section className="heading" id="overview">
            <div>
              <div className="eyebrow">PLAN WITH CONFIDENCE</div>
              <h1>Plan Smarter Discounts. Protect Your Profit.</h1>
              <p>
                See how your promotions affect profit, protect important
                products, and find better discount plans.
              </p>
            </div>
          </section>
          <ImportSection
            campaign={campaign}
            source={source}
            advanced
            error={error}
            notice={notice}
            onUpload={upload}
            onTierUpload={uploadTier}
            onDemo={demoReset}
            onConfirmCosts={confirmCosts}
          />
          {calculated.error && (
            <div role="alert" className="notice danger">
              {calculated.error}
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
                  {!quality.complete && (
                    <p className="notice" role="note">
                      Some Costs Missing. Estimated contribution profit may be
                      overstated; omitted operating costs are counted as zero.
                      Confirm actual costs before relying on goal achievement.
                    </p>
                  )}
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
                        <strong>{wholeUSD(value as number)}</strong>
                        <small>{detail}</small>
                        <div className="card-delta">
                          {money((value as number) - (base as number))}{" "}
                          <span>vs. no discounts</span>
                        </div>
                      </article>
                    ))}
                  </section>
                  <div
                    className={`notice ${c.contribution < floor - 1e-6 ? "danger" : quality.complete ? "success" : ""}`}
                  >
                    <b>
                      {c.contribution < floor - 1e-6
                        ? "Profit floor breached"
                        : quality.complete
                          ? "Portfolio floor protected"
                          : "Estimated floor met — costs incomplete"}
                    </b>
                    <span>
                      {money(c.contribution - floor)} headroom · {c.negative}{" "}
                      SKUs have negative contribution profit.
                    </span>
                  </div>
                  <WarningSummary
                    warnings={calculated.issues ?? []}
                    skus={skus}
                  />
                  {mode === "optimized" && opt && !opt.feasible && (
                    <DiagnosticSummary
                      title="Optimization infeasible — required-discount diagnostic shown"
                      errors={opt.errors}
                      skus={skus}
                    />
                  )}
                  {mode === "optimized" && !!opt?.preferredWarnings.length && (
                    <details className="notice">
                      <summary>
                        {opt.preferredWarnings.length} preferred-discount
                        diagnostics
                      </summary>
                      <ul>
                        {opt.preferredWarnings.map((message, i) => (
                          <li key={i}>{message}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                  <TierSummary
                    skus={skus}
                    current={calculated.ds!}
                    suggested={calculated.tierRecommendation?.discounts ?? null}
                    rules={priorities}
                    state={tiers}
                    goal={floor}
                    buffer={buffer}
                    a={a}
                    costsComplete={quality.complete}
                  />
                  <section className="panel chart-panel">
                    <div className="panel-heading">
                      <div>
                        <h2>How Much More Can You Discount?</h2>
                        <p>See how much room your campaign has to give.</p>
                      </div>
                      <span className="legend">
                        <i />
                        Profit After Variable Costs
                      </span>
                    </div>
                    <Frontier
                      points={opt?.points ?? []}
                      floor={floor + buffer}
                      currentProfit={c.contribution}
                      buffer={buffer}
                    />
                    <p className="caption">
                      This calculation progressively adds product discounts in
                      the model’s allocation order. Each additional discount uses
                      up profit. The minimum profit goal line
                      {buffer > 0 ? " (including your safety buffer)" : ""} shows
                      when further discounts would exceed your profit budget.
                      The horizontal axis shows product discount steps, not time
                      or a uniform storewide discount.
                    </p>
                    <details>
                      <summary>How this calculation works</summary>
                      <p className="caption">
                        This cumulative profitability frontier measures
                        contribution profit (profit after variable costs).
                        Continuous weighted allocation: required minimums first,
                        then descending allocation weight per dollar of
                        contribution consumed; ties use SKU ID. P1 discounts are
                        fixed at required minimums. The curve continues to maximum
                        bounds to reveal breaches, independent of the scenario
                        preview. Crossing positions are interpolated by the
                        existing model; a fractional step marks a boundary between
                        product discount steps. The model holds expected sales
                        fixed; discounts do not automatically increase demand.
                      </p>
                    </details>
                  </section>
                  <section className="panel">
                    <div className="panel-heading">
                      <div>
                        <h2>Profit After Variable Costs by Category</h2>
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
                      Bar lengths show absolute profit after variable costs. Negative
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
                            <th>File priority (legacy)</th>
                            <th>Allocation weight</th>
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
                                  <td>
                                    <input
                                      type="number"
                                      aria-label={`${l.sku.id} allocation weight`}
                                      min="0"
                                      step="any"
                                      value={l.sku.weight}
                                      onChange={(e) => {
                                        const n = e.target.valueAsNumber;
                                        if (Number.isFinite(n) && n >= 0)
                                          setSkus(
                                            skus.map((s) =>
                                              s.id === l.sku.id
                                                ? { ...s, weight: n }
                                                : s,
                                            ),
                                          );
                                      }}
                                    />
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
                <NumberField
                  label="Additional Safety Buffer (USD)"
                  value={buffer}
                  onChange={setBuffer}
                />
                <p className="caption">
                  New uploads use 50% of positive baseline contribution as the
                  editable floor. Allocation must meet floor plus safety buffer.
                </p>
                <CheckoutDiscountNotice />
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
                <TierControls
                  key={dataVersion}
                  skus={skus}
                  rules={priorities}
                  state={tiers}
                  onChange={updateTiers}
                  advanced
                  showImportTools={false}
                />
                <RuleEditor
                  showImportTools={false}
                  skus={skus}
                  rules={priorities}
                  onChange={setPriorities}
                  onUpload={(f) => upload(f, true)}
                />
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
                        ...priorities.find((p) => p.id === priorityId),
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
          <LaunchHelp />
          <footer>
            MarginGuard{" "}
            <span>Built for better discount decisions. · Phase 2D</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
