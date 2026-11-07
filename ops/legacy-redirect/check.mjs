// Read-only package/app isolation check. No network, credentials or deployment.
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertLegacyPackage, parsePreparedRules, preparedRules } from "./model.mjs";
const root = fileURLToPath(new URL("../../", import.meta.url));
const manifest = JSON.parse(readFileSync(new URL("./package.json", import.meta.url)));
assertLegacyPackage(manifest);
parsePreparedRules(preparedRules);
assert.deepEqual(readdirSync(new URL("./site", import.meta.url)).sort(), ["404.html", "_redirects"]);
const html = readFileSync(new URL("./site/404.html", import.meta.url), "utf8");
assert(!/<script|http-equiv\s*=\s*["']?refresh/i.test(html));
assert(!existsSync(resolve(root, "public/_redirects")));
for (const name of ["wrangler.toml", "wrangler.json", "wrangler.jsonc", "functions"]) {
  assert(!existsSync(resolve(root, name)), `Unexpected deployment configuration/runtime at repository root: ${name}`);
}
const dist = resolve(root, process.argv[2] ?? "dist");
assert(existsSync(resolve(dist, "index.html")), "Build the application before checking isolation");
assert(!existsSync(resolve(dist, "_redirects")) && !existsSync(resolve(dist, "_worker.js")));
for (const name of readdirSync(dist)) {
  if (!name.includes(".")) continue;
  assert(!readFileSync(resolve(dist, name), "utf8").includes("data-legacy-redirect-fallback"));
}
const hashes = JSON.parse(readFileSync(new URL("./approved-runtime-sha256.json", import.meta.url), "utf8"));
for (const [path, expected] of Object.entries(hashes)) {
  assert.equal(createHash("sha256").update(readFileSync(resolve(root, path))).digest("hex"), expected, `Approved application file changed: ${path}`);
}
console.log("PASS: legacy package structure, evergreen destinations, app-build isolation and unchanged approved application/fixtures. No deployment performed.");
