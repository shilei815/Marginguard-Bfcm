// Read-only verification. Does not invoke Wrangler or handle credentials.
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertPreviewTarget, parsePreviewRules, preparedRules } from "./model.mjs";
const root = fileURLToPath(new URL("../../../", import.meta.url));
const manifest = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
const options = Object.fromEntries(process.argv.slice(2).map(arg => {
  const match = arg.match(/^--(project-name|branch|production-branch)=(.+)$/);
  if (!match) throw Error("Unexpected preflight argument: " + arg);
  return [match[1], match[2]];
}));
const plan = { ...manifest,
  intendedProject: options["project-name"] ?? manifest.intendedProject,
  intendedBranch: options.branch ?? manifest.intendedBranch,
  productionBranch: options["production-branch"] ?? manifest.productionBranch,
};
assertPreviewTarget(plan);
parsePreviewRules(preparedRules);
assert.deepEqual(readdirSync(new URL("./site", import.meta.url)).sort(), ["404.html", "_redirects"]);
const fallback = readFileSync(new URL("./site/404.html", import.meta.url), "utf8");
assert(fallback.includes('href="https://marginguard.pages.dev/"'));
assert(!/<script|http-equiv\s*=\s*["']?refresh/i.test(fallback));
const hashes = JSON.parse(readFileSync(new URL("./production-301-sha256.json", import.meta.url), "utf8"));
for (const [path, hash] of Object.entries(hashes))
  assert.equal(createHash("sha256").update(readFileSync(resolve(root, path))).digest("hex"), hash, `Original 301 package changed: ${path}`);
assert(!existsSync(resolve(root, "public/_redirects")));
assert(existsSync(resolve(root, "dist/index.html")), "Build the main app before checking isolation");
assert(!existsSync(resolve(root, "dist/_redirects")));
assert(!readFileSync(resolve(root, "dist/index.html"), "utf8").includes("data-legacy-302-preview-fallback"));
console.log(`PASS: 302 preview for ${plan.intendedProject}/${plan.intendedBranch}, distinct from Production ${plan.productionBranch}; all ${Object.keys(hashes).length} original 301 package files unchanged. No deployment performed.`);
