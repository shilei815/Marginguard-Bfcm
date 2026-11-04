import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
const css = readFileSync(new URL("./style.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
function property(selector: string, name: string): string {
  let value = "";
  for (const [, selectors, declarations] of rules) {
    if (!selectors.split(",").map(s => s.trim()).includes(selector)) continue;
    const found = declarations.match(new RegExp(`(?:^|;)\\s*${name}:\\s*([^;]+)`));
    if (found) value = found[1].trim().replace(/\s*!important$/, "");
  }
  if (!value) throw Error(`Missing ${selector} ${name}`);
  const token = value.match(/^var\((--[\w-]+)\)$/);
  return token ? property(":root", token[1]) : value;
}
function contrast(a: string, b: string) {
  const luminance = (hex: string) => {
    if (!/^#[\da-f]{6}$/i.test(hex)) throw Error(`Expected full hex color, got ${hex}`);
    return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
      .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
  };
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
const surfaces = [":root", ".featured", ".notice", ".warning-summary", ".danger", ".cost-quality.complete", ".cost-quality.incomplete", ".tier-report"];
describe("AA contrast regressions against stylesheet surfaces", () => {
  it("uses the WCAG sRGB formula without rounding a failing ratio up", () => {
    expect(contrast("#000000", "#ffffff")).toBe(21);
    expect(contrast("#89968c", "#ffffff")).toBeCloseTo(3.08601086, 6);
  });
  it.each(surfaces)("keeps caption/helper text readable on %s", (surface) => {
    const background = property(surface, "background");
    expect(contrast(property(".caption", "color"), background)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(property("p", "color"), background)).toBeGreaterThanOrEqual(4.5);
  });
  it.each([".field", ".checkbox", ".legend", ".scrubber", ".chart-foot", "td small", ".card > span", ".range-labels"])("protects representative secondary selector %s", selector => {
    expect(contrast(property(selector, "color"), "#ffffff")).toBeGreaterThanOrEqual(4.5);
  });
  it.each([".priority.P1", ".priority.P2", ".plan-status.good", ".plan-status.risk", ".plan-status.bad"])("keeps badge/status %s readable on its actual fill", selector => {
    expect(contrast(property(selector, "color"), property(selector, "background"))).toBeGreaterThanOrEqual(4.5);
  });
  it("keeps disabled controls readable while preserving their native disabled state", () => {
    expect(property("button:disabled", "opacity")).toBe("1");
    expect(property("button:disabled", "cursor")).toBe("not-allowed");
    expect(contrast(property("button:disabled", "color"), property("button:disabled", "background"))).toBeGreaterThanOrEqual(4.5);
  });
  it.each(surfaces)("protects control and focus boundaries on %s", surface => {
    const bg = property(surface, "background");
    expect(contrast(property(":root", "--control-border"), bg)).toBeGreaterThanOrEqual(3);
    expect(contrast(property(":root", "--focus-ring"), bg)).toBeGreaterThanOrEqual(3);
  });
  it("makes baseline graph bars visible independently of their labels", () => {
    expect(contrast(property(".bar.baseline", "background"), "#ffffff")).toBeGreaterThanOrEqual(3);
  });
  it("keeps range tracks and the white thumb boundary distinct", () => {
    const track = property('input[type="range"]::-webkit-slider-runnable-track', "background");
    expect(contrast(track, "#ffffff")).toBeGreaterThanOrEqual(3);
    expect(contrast("#ffffff", "#087b66")).toBeGreaterThanOrEqual(3);
    expect(property('input[type="range"]::-moz-range-track', "background")).toBe(track);
  });

});
