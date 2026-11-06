# MarginGuard evergreen identity and hostname migration

## Current state and scope

Product identity: **MarginGuard**, an evergreen discount profitability planner.
The public UI already uses this identity. Current README and launch copy remove
campaign-specific positioning. The merchant guide is evergreen; its issue-report
link retains the actual repository name so support links keep working.

Current production URL, supplied by the owner:
`https://marginguard-bfcm.pages.dev/`.
Proposed URL, **availability/ownership not verified**:
`https://marginguard.pages.dev/`.

This PR does not create/delete/rename any Cloudflare project, rename the GitHub
repository, change Cloudflare settings, merge, or deploy. Do not treat a proposed
name, successful DNS lookup or a third party's HTTP response as proof this owner
controls that hostname. Cloudflare Pages names are globally allocated; the owner
must confirm availability and ownership in their account. If unavailable, stop
and choose an owner-approved name; do not publish metadata pointing to it.

Historical root `README`, `README.txt`, workbook, original CSV/JSON fixtures,
engineering phase reports, validation history and private package identifier are
retained for reproducibility. They are not current product branding. The eight
original fixtures stay byte-for-byte intact; source calculations and behavior
are unchanged. There is no automatic repository rename or link rewriting.

## Prepared metadata: one active origin

`config/site.json` is the single source for the evergreen name, title,
description and **active** production origin. It deliberately retains the current
legacy origin. No proposed hostname is embedded in generated production assets.
Changing the config changes canonical, Open Graph URL, sitemap and robots sitemap
location together at build time; no runtime service, merchant data or API request
is needed. No environment variable can substitute an arbitrary hostname.

`vite.config.ts` / `scripts/site-metadata.ts` generate static head metadata,
`dist/sitemap.xml` (root URL only) and `dist/robots.txt`. App hash navigation is
not separate indexable pages. No speculative dates, share image or non-existent
routes are published. Open Graph and Twitter title/description use the same
branding as the browser title and description.

Cloudflare non-main builds, identified by `CF_PAGES_BRANCH`, get `noindex,
nofollow`, a robots file permitting crawlers to read that noindex directive, and no sitemap. They still reference the
active production canonical, never the preview URL. These directives are crawler guidance, not access control or an indexing guarantee. Confirm Cloudflare supplies the branch variable on previews;
other preview hosts must provide equivalent indexing protection. Main is the
owner-confirmed Production branch; this PR does not change that setting.

The regression test explicitly pins the current origin. A future activation PR
must update both `config/site.json` and that assertion **after** owner
verification. This is a review gate, not automated proof that a hostname exists.
Do not flip the origin based on an availability guess or a build flag.

## Stage 1 — approve and prepare without disrupting the old site

1. Owner reviews this PR; do not merge or deploy until approved. Record the current production commit/deployment ID, project settings and rollback artifact privately. Keep the current site serving successfully; do not remove it, change its branch, or repurpose its URL.
2. Owner verifies name availability and manually creates the new Pages project only when separately authorized. A different `pages.dev` project name ordinarily requires a separate Pages project; do not assume the existing project can be renamed or that a second `pages.dev` alias can simply be attached. If the platform offers another supported path, verify it before selecting it.
3. Use the same repository, approved immutable commit, `npm ci`, `npm run build` and static output `dist/`, with a compatible pinned Node version. No merchant data, backend, database or application secrets need migration.
4. Review automatic deployment settings on both projects before connecting branches. Avoid permanently rebuilding both projects on every commit: after cutover/acceptance, make the legacy project a static redirect-only deployment and disable its unnecessary app auto-builds through a separately approved owner operation. Do not delete the legacy project or redirect deployment.
5. New-site validation/staging must not be indexed before cutover. Use an isolated preview or approved temporary indexing protection, not a publicly indexable duplicate. This PR does not configure that protection. Until activation, generated canonical/OG/sitemap continue to use the existing origin; that is intentional and must not be mistaken for final new-site SEO.

## Stage 2 — verify the proposed hostname and release artifact

Before authorizing origin activation, record evidence of all of the following:

- The new project and hostname are in the owner's account, with valid HTTPS/TLS and no login/error/interstitial or unintended redirect.
- The new root serves the approved MarginGuard artifact; JS/CSS, `/demo-skus.csv`, upload templates, both modes, chart explanations, keyboard controls and local exports work. Test with fictional data only.
- Required response headers and privacy practices are reviewed. Browser network inspection shows merchant inputs are still processed locally. Preview/production branch mapping is correct.
- The current legacy root and shared paths remain available. Inventory actual shared paths and fragments, any query-bearing links, static assets, robots and sitemap endpoints. Do not silently discard required routes or query strings.
- Actual platform support for host-to-host redirects, caching, path/query preservation and rollback is known. A proposed `_redirects` file is not evidence that the legacy Pages hostname will honor it.

Keep verification evidence free of credentials and merchant data. DNS/HTTPS
checks alone do not establish account ownership or release correctness.

## Stage 3 — separately approved metadata activation and cutover

1. After Stage 2 and explicit owner approval, create a small activation PR changing `productionOrigin` to `https://marginguard.pages.dev` (or the verified owner-approved alternative) and update the origin-pinning test. No trailing slash in the config; generated page URLs add it once. Attach hostname/artifact verification evidence. Do not activate via the current PR.
2. Run `npm test`, `npm run build`, browser QA and inspect built HTML, `robots.txt`, sitemap and social tags. All active URLs must agree. Remove staging indexing restrictions only for the approved public artifact. Preview builds remain noindex. Search visibility and social caches are not instant guarantees.
3. Owner deploys the approved artifact to the verified new project. Verify root/assets, canonical, `og:url`, robots and sitemap from the actual responses. Keep the old site intact during acceptance, before installing permanent redirects.
4. After new-site acceptance, install an owner-approved legacy-to-new **301** on the legacy hostname. Do not put the old-host redirect in the new/shared application output: doing so could redirect the new site to itself or affect previews.
5. Retain the old project/hostname and its redirect for previously shared links. Update launch/support links to the new verified URL only now. If used, update search-engine sitemap/change-of-address tooling through the owner's existing account; it is not required infrastructure for the app.

### Redirect design (plan only — not an active file or rule)

For a Pages redirect-only deployment on the **legacy project**, a candidate
`_redirects` rule is:

```text
/* https://marginguard.pages.dev/:splat 301
```

This is illustrative, not a verified Cloudflare configuration. Keep it outside
this app's `public/` and `dist/`. Test it first in an isolated legacy-rule staging
setup or use a temporary redirect during acceptance if the supported platform
workflow allows it. Confirm Pages supports the intended matching behavior for
this `pages.dev` project; zone-level redirect rules for a custom domain do not
automatically imply control of the provider's parent `pages.dev` zone. Use the
platform-supported legacy-only method the owner can actually manage.

Acceptance examples after installation: legacy `/` → new `/`; legacy
`/demo-skus.csv` → new `/demo-skus.csv`; legacy `/?campaign=test#step-2` → new
same path/query and working `#step-2`; legacy `/#sku-table` → new working
fragment. Fragments are not sent to HTTP servers, so verify browser handling
rather than promising server-side fragment inspection. Test exact 301 status,
one redirect hop, query/path preservation and no loop from the new host. Verify
known shared paths individually, including any static assets that the final
artifact must continue serving. Do not redirect all paths blindly to `/`.

301 responses can be cached by browsers and search engines. Do not use a
permanent redirect for initial acceptance while rollback is still likely.

## Rollback

- **Before redirect:** leave the old app as the stable entrypoint. Revert the activation commit/config/test and restore the recorded legacy artifact if necessary. Restore staging noindex on the failed new deployment. Recheck canonical/OG/robots/sitemap consistency on both sites.
- **After redirect:** stop promotions of the new URL; owner restores the old app deployment and removes/replaces the legacy redirect using the recorded platform rollback path. Restore legacy canonical/OG/sitemap via the approved rollback artifact. Do not add a reverse new-to-old redirect while a cached old-to-new 301 can create a loop. Keep a working app on the new hostname for cached-redirect clients until recovery is verified; cached 301s cannot reliably be revoked immediately.
- Record the incident and re-run synthetic smoke tests on both URLs. Never delete either project, rewrite shared Git history or rename the repository as a rollback shortcut. A redirect-only legacy deployment has no merchant database to restore, but downloaded reports remain the merchant's responsibility.

## Low-maintenance steady state

One evergreen app project, one origin configuration value, and a legacy
redirect-only project retained for old links. No seasonal branding switches,
custom backend or domain-routing service is required. Keep redirect ownership,
project access and rollback evidence available; review dependency/security
updates separately. The old technical repository and fixture names do not need
renaming to maintain the public MarginGuard identity.

## Verification of this preparation PR

- `npm test`: **261 tests in 14 files pass**, including the original financial/fixture regressions and 10 new metadata/evergreen-copy cases.
- `npm run build`: strict TypeScript and static production build pass; canonical, Open Graph and Twitter metadata, robots and root-only sitemap are emitted.
- Separate actual preview build with `CF_PAGES_BRANCH=chore/evergreen-domain-migration`: noindex/nofollow, crawlable robots and no sitemap. Production and preview HTML/XML artifacts were inspected programmatically; both retain only the current production origin and contain no proposed-host URLs.
- `CHROMIUM_NO_SANDBOX=1 npm run test:browser`: **131 layout/state checks** at 320, 375, 390, 430, 768, 1024, 1440 and 1920px. Evergreen UI/title and rendered canonical/OG/description values are checked; no runtime errors or external page requests are recorded. The no-sandbox flag is limited to the disposable test container.
- Original eight fixture hashes pass. Runtime financial/state/UI source, styles, CSV contracts and dependency manifests are unchanged. Existing public assets retain their paths.

Hostname availability, account ownership, TLS/HTTP responses at the proposed site,
Cloudflare redirect behavior, hosted cutover and rollback remain **NOT VERIFIED**.
No project operation, repository rename, merge, Production deployment, live
redirect or Cloudflare settings/API-token use was performed by this PR.
