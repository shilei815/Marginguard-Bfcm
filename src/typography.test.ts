import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
const css = readFileSync(new URL("./style.css", import.meta.url), "utf8");
describe("beta typography regression boundaries", () => {
  it("uses a 16px root and no visible stylesheet text below 12px", () => {
    expect(css.match(/:root\s*\{[^}]*font-size:\s*16px/s)).toBeTruthy();
    for (const match of css.matchAll(/font-size:\s*([\d.]+)(px|rem)/g)) {
      const pixels = Number(match[1]) * (match[2] === "rem" ? 16 : 1);
      // The existing compact brand has 0px only while its sidebar is hidden.
      if (pixels !== 0) expect(pixels, match[0]).toBeGreaterThanOrEqual(12);
    }
  });
  it("keeps headline and KPI display sizes while improving surrounding text", () => {
    expect(css).toMatch(/h1\s*\{[^}]*font-size:\s*30px/s);
    expect(css).toMatch(/\.card strong\s*\{[^}]*font-size:\s*27px/s);
    expect(css).toMatch(/\.merchant-cards \.card strong\s*\{[^}]*font-size:\s*30px/s);
  });
  it("contains wide tables and readable charts inside scrollable panels", () => {
    expect(css).toMatch(/\.table-scroll\s*\{[^}]*overflow-x:\s*auto/s);
    expect(css).toMatch(/\.chart-panel,\s*\.simple-chart\s*\{\s*overflow-x:\s*auto/s);
    expect(css).toMatch(/\.frontier\s*\{\s*min-width:\s*700px/);
    expect(css).toMatch(/\.simple-chart text\s*\{\s*font-size:\s*18px/);
  });
  it("preserves the contrast tokens and visible focus outline", () => {
    for (const token of ["--text-muted: #4f665b", "--control-border: #62796b", "--focus-ring: #945424"])
      expect(css).toContain(token);
    expect(css).toContain("outline: 3px solid var(--focus-ring)");
  });


});
