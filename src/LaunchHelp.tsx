import feedback from "../config/feedback.json";

// Fail closed: never publish an invented/default contact address.
export function feedbackHref(email: unknown): string | null {
  if (typeof email !== "string" || !/^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)+$/i.test(email) ||
      /(?:example\.(?:com|org|net)|localhost|\.invalid|\.test)$/i.test(email)) return null;
  return `mailto:${email}?subject=${encodeURIComponent("MarginGuard beta feedback")}`;
}

export default function LaunchHelp() {
  const href = feedbackHref(feedback.publicEmail);
  return (
    <section id="help-feedback" className="panel launch-help" tabIndex={-1} aria-labelledby="launch-help-title">
      <h2 id="launch-help-title">Help & feedback</h2>
      <details>
        <summary>How do I get started?</summary>
        <p>Try the fictional demo: set discounts, check profit, then choose Improve My Plan. Upload your own product CSV when ready, and review missing costs before relying on the results.</p>
      </details>
      <details>
        <summary>Does MarginGuard upload my financial data?</summary>
        <p>Merchant CSV data is processed locally in this browser. The application does not upload your financial data. Files you export and screenshots you share are under your control.</p>
      </details>
      <details>
        <summary>What does Profit After Variable Costs mean?</summary>
        <p>It is modeled contribution profit: gross profit minus the variable costs supplied or confirmed in your inputs. It does not represent final net profit; fixed overhead, taxes and excluded costs are not included. MarginGuard does not guarantee profit.</p>
      </details>
      <details>
        <summary>Does MarginGuard directly change my Shopify discounts?</summary>
        <p>No. MarginGuard is a standalone planner with no Shopify connection. Verify suggested discounts against your real checkout rounding, discount rules and costs before applying them yourself.</p>
      </details>
      <details>
        <summary>Are my plans saved after refreshing?</summary>
        <p>No. Campaign state stays in memory and is not stored between page refreshes. Export the available CSV reports before leaving; exports are not a complete saved campaign.</p>
      </details>
      <p className="caption">Expected unit sales are fixed inputs, not demand forecasts. Discount suggestions do not assume that lower prices increase sales.</p>
      {href ? <a href={href}>Send Feedback</a> : (
        <p className="caption"><strong>Send Feedback — coming soon.</strong> A public contact address has not been configured.</p>
      )}
    </section>
  );
}
