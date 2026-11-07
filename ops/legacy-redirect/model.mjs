// TEST/PREFLIGHT MODEL ONLY. This is not Cloudflare's parser or a shipped server.
import { readFileSync } from "node:fs";
export const legacyHost = "marginguard-bfcm.pages.dev";
export const targetOrigin = "https://marginguard.pages.dev";
export const preparedRules = readFileSync(new URL("./site/_redirects", import.meta.url), "utf8");
export function parsePreparedRules(text) {
  const rules = text.split(/\r?\n/).filter(line => line.trim() && !line.trim().startsWith("#"))
    .map(line => {
      const fields = line.trim().split(/\s+/);
      if (fields.length !== 3 || fields[2] !== "301") throw Error("Expected explicit 301 rule");
      return { source: fields[0], destination: fields[1], status: 301 };
    });
  if (JSON.stringify(rules) !== JSON.stringify([
    { source: "/", destination: targetOrigin + "/", status: 301 },
    { source: "/*", destination: targetOrigin + "/:splat", status: 301 },
  ])) throw Error("Unexpected rule structure or destination: expected root then wildcard, evergreen target only");
  return rules;
}
export function assertLegacyPackage(manifest) {
  if (manifest.intendedProject !== "marginguard-bfcm" || manifest.intendedBranch !== "main" ||
      manifest.sourceHostname !== legacyHost || manifest.targetOrigin !== targetOrigin ||
      manifest.outputDirectory !== "ops/legacy-redirect/site")
    throw Error("Package must remain scoped to the legacy project and isolated site directory");
}
export function modeledLocation(requestURL, { preserveQuery }) {
  // Project selection is an OPERATOR guard, not a hostname feature in _redirects.
  // Only paths are matched by this local model. Query forwarding is an explicit
  // acceptance assumption, not a claim about Pages' live implementation.
  const request = new URL(requestURL);
  const rules = parsePreparedRules(preparedRules);
  const rule = request.pathname === "/" ? rules[0] : rules[1];
  const destination = rule.destination.replace(":splat", () => request.pathname.slice(1));
  return { status: rule.status, location: destination + (preserveQuery ? request.search : "") };
}
