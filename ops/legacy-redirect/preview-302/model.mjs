// Local preflight/MODEL only; not Cloudflare's parser and not deployed code.
import { readFileSync } from "node:fs";
import { targetOrigin, legacyHost } from "../model.mjs";
export { targetOrigin };
export const preparedRules = readFileSync(new URL("./site/_redirects", import.meta.url), "utf8");
export function parsePreviewRules(text) {
  const rules = text.split(/\r?\n/).filter(line => line.trim() && !line.trim().startsWith("#"))
    .map(line => {
      const [source, destination, status, extra] = line.trim().split(/\s+/);
      if (status !== "302" || extra) throw Error("Preview requires explicit 302 rules only");
      return { source, destination, status: 302 };
    });
  if (JSON.stringify(rules) !== JSON.stringify([
    { source: "/", destination: targetOrigin + "/", status: 302 },
    { source: "/*", destination: targetOrigin + "/:splat", status: 302 },
  ])) throw Error("Unexpected preview root/wildcard destination or rule order");
  return rules;
}
export function assertPreviewTarget(plan) {
  if (plan.intendedProject !== "marginguard-bfcm" || plan.intendedBranch !== "redirect-validation-302" ||
      plan.productionBranch !== "main" || plan.intendedBranch === plan.productionBranch ||
      plan.sourceHostname !== legacyHost || plan.targetOrigin !== targetOrigin || plan.status !== 302 ||
      plan.outputDirectory !== "ops/legacy-redirect/preview-302/site")
    throw Error("302 preview must target the LEGACY project, isolated preview directory and non-production redirect-validation-302 branch, never marginguard/main");
}
export function modeledLocation(requestURL, { preserveQuery }) {
  const request = new URL(requestURL);
  const rules = parsePreviewRules(preparedRules);
  const rule = request.pathname === "/" ? rules[0] : rules[1];
  return {
    status: 302,
    location: rule.destination.replace(":splat", () => request.pathname.slice(1)) + (preserveQuery ? request.search : ""),
  };
}
