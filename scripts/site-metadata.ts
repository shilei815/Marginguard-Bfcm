import type { HtmlTagDescriptor, Plugin } from "vite";
export interface SiteMetadata {
  name: string;
  title: string;
  description: string;
  productionOrigin: string;
}
export function validateSiteMetadata(input: unknown): SiteMetadata {
  if (!input || typeof input !== "object") throw Error("Site metadata is required");
  const site = input as SiteMetadata;
  for (const field of ["name", "title", "description", "productionOrigin"] as const)
    if (typeof site[field] !== "string" || !site[field].trim())
      throw Error(`Site ${field} is required`);
  const url = new URL(site.productionOrigin);
  if (url.protocol !== "https:" || url.origin !== site.productionOrigin || url.username || url.password)
    throw Error("Production origin must be a bare HTTPS origin without credentials, path, query or fragment");
  return site;
}
export const sitemap = (site: SiteMetadata) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${site.productionOrigin}/</loc></url></urlset>\n`;
export const robots = (site: SiteMetadata, preview: boolean) => preview
  ? "User-agent: *\nAllow: /\n"
  : `User-agent: *\nAllow: /\nSitemap: ${site.productionOrigin}/sitemap.xml\n`;
export function metadataTags(site: SiteMetadata, preview: boolean): HtmlTagDescriptor[] {
  const meta = (key: string, content: string): HtmlTagDescriptor => ({
    tag: "meta", attrs: { [key.startsWith("og:") ? "property" : "name"]: key, content }, injectTo: "head",
  });
  return [
    { tag: "title", children: site.title, injectTo: "head" },
    meta("description", site.description),
    { tag: "link", attrs: { rel: "canonical", href: site.productionOrigin + "/" }, injectTo: "head" },
    meta("og:site_name", site.name), meta("og:type", "website"),
    meta("og:title", site.title), meta("og:description", site.description),
    meta("og:url", site.productionOrigin + "/"),
    meta("twitter:card", "summary"), meta("twitter:title", site.title),
    meta("twitter:description", site.description),
    meta("robots", preview ? "noindex, nofollow" : "index, follow"),
  ];
}
export function siteMetadataPlugin(input: unknown, preview: boolean): Plugin {
  const site = validateSiteMetadata(input);
  return {
    name: "marginguard-static-metadata",
    transformIndexHtml() { return metadataTags(site, preview); },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "robots.txt", source: robots(site, preview) });
      // Never advertise preview URLs in a sitemap.
      if (!preview) this.emitFile({ type: "asset", fileName: "sitemap.xml", source: sitemap(site) });
    },
  };
}
