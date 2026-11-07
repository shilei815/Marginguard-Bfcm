import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { parsePreviewRules, assertPreviewTarget, modeledLocation, preparedRules, targetOrigin } from "./model.mjs";
const manifest = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
describe("isolated 302 preview preparation", () => {
  it("uses exact evergreen 302 root and nested rules", () => {
    expect(parsePreviewRules(preparedRules)).toEqual([
      { source: "/", destination: targetOrigin + "/", status: 302 },
      { source: "/*", destination: targetOrigin + "/:splat", status: 302 },
    ]);
  });
  it.each(["/", "/demo-skus.csv", "/assets/example.js", "/nested/path/", "/cash/$&/$$"])("models exact 302 destination for %s", path => {
    expect(modeledLocation("https://marginguard-bfcm.pages.dev" + path, { preserveQuery: true })).toEqual({ status: 302, location: targetOrigin + path });
  });
  it("makes query preservation an explicit modeled assumption, not Pages proof", () => {
    const request = "https://marginguard-bfcm.pages.dev/?utm_source=shopify&a=1&a=2&x=%2F#step-2";
    expect(modeledLocation(request, { preserveQuery: true }).location).toBe(targetOrigin + "/?utm_source=shopify&a=1&a=2&x=%2F");
    expect(modeledLocation(request, { preserveQuery: false }).location).toBe(targetOrigin + "/");
  });
  it("leaves fragment inheritance to the browser, not HTTP Location", () => {
    expect(modeledLocation("https://marginguard-bfcm.pages.dev/#step-2", { preserveQuery: true }).location).toBe(targetOrigin + "/");
  });
  it.each([
    { intendedProject: "marginguard" }, { intendedBranch: "main" },
    { productionBranch: "redirect-validation-302" }, { productionBranch: "other" },
    { outputDirectory: "dist" }, { outputDirectory: "ops/legacy-redirect/site" }, { status: 301 },
  ])("rejects unsafe project/branch/output plans %j", change => {
    expect(() => assertPreviewTarget({ ...manifest, ...change })).toThrow();
  });
  it("accepts only the intended legacy preview plan, distinct from declared Production main", () => {
    expect(() => assertPreviewTarget(manifest)).not.toThrow();
    expect(manifest.intendedBranch).not.toBe(manifest.productionBranch);
  });
  it.each([preparedRules.replaceAll("302", "301"), preparedRules.replaceAll(targetOrigin, "https://marginguard-bfcm.pages.dev"), preparedRules.replace(":splat", "")])("rejects status/destination changes", text => {
    expect(() => parsePreviewRules(text)).toThrow();
  });
  it("keeps all original 301 package bytes unchanged", () => {
    const hashes = JSON.parse(readFileSync(new URL("./production-301-sha256.json", import.meta.url)));
    expect(Object.keys(hashes)).toHaveLength(10);
    for (const [path, expected] of Object.entries(hashes))
      expect(createHash("sha256").update(readFileSync(new URL("../../../" + path, import.meta.url))).digest("hex"), path).toBe(expected);
  });
  it("isolates two static files, no scripts/refresh or shared app redirect", () => {
    expect(readdirSync(new URL("./site", import.meta.url)).sort()).toEqual(["404.html", "_redirects"]);
    const html = readFileSync(new URL("./site/404.html", import.meta.url), "utf8");
    expect(html).toContain('href="https://marginguard.pages.dev/"');
    expect(html).not.toMatch(/<script|http-equiv\s*=\s*["']?refresh/i);
    expect(existsSync(new URL("../../../public/_redirects", import.meta.url))).toBe(false);
  });
});
