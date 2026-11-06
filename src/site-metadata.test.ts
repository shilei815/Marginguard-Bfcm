import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { validateSiteMetadata, metadataTags, sitemap, robots } from "../scripts/site-metadata";
const site = validateSiteMetadata(JSON.parse(readFileSync(new URL("../config/site.json", import.meta.url), "utf8")));
describe("evergreen public metadata and migration hold", () => {
  it("keeps the active origin on the current site until a separately approved verification change", () => {
    expect(site.productionOrigin).toBe("https://marginguard-bfcm.pages.dev");
    expect([site.name, site.title, site.description].join(" ")).not.toMatch(/bfcm|black friday|cyber monday/i);
  });
  it("keeps canonical, social URLs and sitemap on one active HTTPS origin", () => {
    const tags = metadataTags(site, false);
    expect(tags.find(t => t.attrs?.rel === "canonical")?.attrs?.href).toBe(site.productionOrigin + "/");
    expect(tags.find(t => t.attrs?.property === "og:url")?.attrs?.content).toBe(site.productionOrigin + "/");
    expect(tags.find(t => t.attrs?.name === "description")?.attrs?.content).toBe(site.description);
    expect(tags.find(t => t.attrs?.property === "og:title")?.attrs?.content).toBe(site.title);
    expect(sitemap(site)).toContain(`<loc>${site.productionOrigin}/</loc>`);
    expect(robots(site, false)).toContain(`Sitemap: ${site.productionOrigin}/sitemap.xml`);
    expect(JSON.stringify(tags) + sitemap(site) + robots(site, false)).not.toContain("https://marginguard.pages.dev");
  });
  it("prevents preview indexing without publishing preview-host canonical URLs", () => {
    expect(metadataTags(site, true).find(t => t.attrs?.name === "robots")?.attrs?.content).toBe("noindex, nofollow");
    expect(robots(site, true)).toBe("User-agent: *\nAllow: /\n");
    expect(metadataTags(site, true).find(t => t.attrs?.property === "og:url")?.attrs?.content).toBe(site.productionOrigin + "/");
  });
  it.each(["http://example.com", "https://example.com/path", "https://example.com/", "https://example.com?x=1", "https://example.com#x", "https://user:pass@example.com"])("rejects an unsafe/noncanonical origin %s", productionOrigin => {
    expect(() => validateSiteMetadata({ ...site, productionOrigin })).toThrow();
  });
  it("keeps merchant launch and current README copy evergreen", () => {
    for (const path of ["../README.md", "../docs/PUBLIC_LAUNCH_COPY.md"]) {
      const text = readFileSync(new URL(path, import.meta.url), "utf8");
      expect(text).not.toMatch(/\bBFCM\b|Black Friday|Cyber Monday/i);
    }
  });
});
