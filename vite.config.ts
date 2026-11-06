import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import { siteMetadataPlugin } from "./scripts/site-metadata";
const site = JSON.parse(readFileSync(new URL("./config/site.json", import.meta.url), "utf8"));
// Branch names affect preview indexing only, never the production hostname.
const preview = !!process.env.CF_PAGES_BRANCH && process.env.CF_PAGES_BRANCH !== "main";
export default defineConfig({ plugins: [siteMetadataPlugin(site, preview)] });
