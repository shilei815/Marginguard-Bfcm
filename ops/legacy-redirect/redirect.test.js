import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { parsePreparedRules, preparedRules, assertLegacyPackage, modeledLocation, targetOrigin } from "./model.mjs";
const manifest = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
describe("isolated legacy redirect preparation", () => {
  it("uses explicit root and one wildcard, status 301 and only the evergreen target", () => {
    expect(parsePreparedRules(preparedRules)).toEqual([
      { source: "/", destination: targetOrigin + "/", status: 301 },
      { source: "/*", destination: targetOrigin + "/:splat", status: 301 },
    ]);
  });
  it.each(["/", "/demo-skus.csv", "/assets/example.js", "/assets/nested/file.js", "/%E2%9C%93", "/cash/$&/$$", "//other.example/path"])("models exact preserved path %s without changing the target host", path => {
    const result = modeledLocation("https://marginguard-bfcm.pages.dev" + path, { preserveQuery: true });
    expect(result).toEqual({ status: 301, location: targetOrigin + path });
    expect(new URL(result.location).origin).toBe(targetOrigin);
  });
  it("models the required query intent explicitly, not platform proof", () => {
    const url = "https://marginguard-bfcm.pages.dev/?utm_source=shopify&a=1&a=2&encoded=%2F";
    expect(modeledLocation(url, { preserveQuery: true }).location).toBe(targetOrigin + "/?utm_source=shopify&a=1&a=2&encoded=%2F");
    expect(modeledLocation(url, { preserveQuery: false }).location).toBe(targetOrigin + "/");
  });
  it("never places a fragment in the modeled HTTP Location header", () => {
    expect(modeledLocation("https://marginguard-bfcm.pages.dev/#step-2", { preserveQuery: true }).location).toBe(targetOrigin + "/");
  });
  it("rejects a manifest targeting the new project or shared dist", () => {
    expect(() => assertLegacyPackage(manifest)).not.toThrow();
    expect(() => assertLegacyPackage({ ...manifest, intendedProject: "marginguard" })).toThrow();
    expect(() => assertLegacyPackage({ ...manifest, outputDirectory: "dist" })).toThrow();
  });
  it.each([
    preparedRules.replaceAll("301", "302"),
    preparedRules.replaceAll(targetOrigin, "https://marginguard-bfcm.pages.dev"),
    preparedRules.replace("/*", "https://marginguard-bfcm.pages.dev/*"),
    preparedRules + "/ https://other.example 301\n",
    preparedRules.replace(":splat", ""),
  ])("rejects altered/host-qualified/reverse or ambiguous rule structure", text => {
    expect(() => parsePreparedRules(text)).toThrow();
  });
  it("ships only the rules and a non-scripted fallback, never app code or Functions", () => {
    expect(readdirSync(new URL("./site", import.meta.url)).sort()).toEqual(["404.html", "_redirects"]);
    const html = readFileSync(new URL("./site/404.html", import.meta.url), "utf8");
    expect(html).toContain('href="https://marginguard.pages.dev/"');
    expect(html).not.toMatch(/<script|http-equiv\s*=\s*["']?refresh|marginguard-bfcm\.pages\.dev/i);
    expect(existsSync(new URL("../../public/_redirects", import.meta.url))).toBe(false);
    const site = JSON.parse(readFileSync(new URL("../../config/site.json", import.meta.url)));
    expect(site.productionOrigin).toBe(targetOrigin);
  });
  it("does not pretend the path-only rules enforce a hostname guard", () => {
    // This deliberately demonstrates the self-loop hazard if deployed to NEW.
    expect(modeledLocation(targetOrigin + "/", { preserveQuery: true }).location).toBe(targetOrigin + "/");
  });
});
