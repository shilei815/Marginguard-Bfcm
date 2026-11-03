import { useState, type InputHTMLAttributes } from "react";
import { type SKU } from "./engine";
import { groupWarnings, type PlanWarning } from "./planner";
export const usd = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
export const wholeUSD = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
export const displayNumber = (value: number, digits = 2) =>
  String(Number(value.toFixed(digits)));
// Formatting never writes back. Only an explicit input change updates campaign state.
export function DisplayNumberInput({
  value,
  onValueChange,
  digits = 2,
  onFocus,
  onBlur,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  value: number;
  onValueChange: (value: number) => void;
  digits?: number;
}) {
  const [editing, setEditing] = useState(false),
    [draft, setDraft] = useState("");
  return (
    <input
      {...props}
      type="number"
      value={editing ? draft : displayNumber(value, digits)}
      onFocus={(e) => {
        setDraft(displayNumber(value, digits));
        setEditing(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setEditing(false);
        onBlur?.(e);
      }}
      onChange={(e) => {
        setDraft(e.target.value);
        if (Number.isFinite(e.target.valueAsNumber))
          onValueChange(e.target.valueAsNumber);
      }}
    />
  );
}
// Release disclosure only: never round or rewrite the underlying discount vector.
export function CheckoutDiscountNotice() {
  return (
    <p className="caption">
      Displayed percentages are rounded; recommendations and CSV exports retain
      full precision. Rounding checkout discounts can break minimum, maximum or
      exact offers and put profit below your goal plus safety buffer. Re-enter
      the actual checkout discounts and check all warnings before launch.
    </p>
  );
}
export function presentWarnings(warnings: PlanWarning[], skus: SKU[]) {
  const ids = new Map(skus.map((s) => [s.id, s]));
  return warnings.map((w) => {
    if (w.id) return w;
    const split = w.message.indexOf(": "),
      id = split < 0 ? "" : w.message.slice(0, split),
      sku = ids.get(id);
    return sku ? { ...w, id, category: sku.category } : w;
  });
}
export function WarningSummary({
  warnings,
  skus = [],
}: {
  warnings: PlanWarning[];
  skus?: SKU[];
}) {
  if (!warnings.length) return null;
  const rows = presentWarnings(warnings, skus),
    groups = groupWarnings(rows),
    unique = (items: PlanWarning[]) =>
      new Set(items.flatMap((w) => (w.id ? [w.id] : []))).size;
  return (
    <details className="notice warning-summary">
      <summary>
        {rows.length === 1
          ? "1 discount rule or profit warning needs attention."
          : `${rows.length} discount rules or profit warnings need attention.`}{" "}
        <span className="affected-count">
          {unique(rows)} unique {unique(rows) === 1 ? "product" : "products"}{" "}
          affected.
        </span>
      </summary>
      <p className="caption">
        A product can have more than one warning. Campaign-wide and input
        warnings may not name an individual product.
      </p>
      {[...groups].map(([kind, categories]) => {
        const items = [...categories.values()].flat();
        return (
          <details key={kind}>
            <summary>
              {kind} · {items.length}{" "}
              {items.length === 1 ? "warning" : "warnings"} · {unique(items)}{" "}
              {unique(items) === 1 ? "product" : "products"}
            </summary>
            {[...categories].map(([category, items]) => (
              <details key={category}>
                <summary>
                  {category} · {items.length}{" "}
                  {items.length === 1 ? "warning" : "warnings"} ·{" "}
                  {unique(items)} {unique(items) === 1 ? "product" : "products"}
                </summary>
                <ul>
                  {items.map((w, i) => (
                    <li key={i}>
                      {w.id && <b>{w.id}: </b>}
                      {w.message}
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </details>
        );
      })}
    </details>
  );
}
export function DiagnosticSummary({
  title,
  errors,
  skus,
}: {
  title: string;
  errors: string[];
  skus: SKU[];
}) {
  const hasConflicts = errors.some((e) => /conflict/i.test(e));
  const primary = hasConflicts
    ? "Some required offers conflict with the product discount rules. Review the affected products and adjust those rules."
    : errors.some((e) => /below|floor|goal plus buffer|at most/i.test(e))
      ? "The required offers leave too little profit to meet your goal plus safety buffer. Lower the goal or revise the required offers."
      : "A rule-compliant plan could not be verified. Review the detailed diagnostics.";
  const rows: PlanWarning[] = errors.map((message) => ({
    kind: hasConflicts ? "Conflicting rules" : "Profit goal",
    category: "Campaign",
    message,
  }));
  return (
    <div role="alert" className="notice danger diagnostic-summary">
      <b>{title}</b>
      <p>{primary}</p>
      <WarningSummary warnings={rows} skus={skus} />
    </div>
  );
}
