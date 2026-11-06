# MarginGuard evergreen identity and hostname migration

## Current state and scope

Product identity: **MarginGuard**, an evergreen discount profitability planner.
The public UI already uses this identity. Current README and launch copy remove
campaign-specific positioning. The merchant guide is evergreen; its issue-report
link retains the actual repository name so support links keep working.

### Stage 3D.2 — owner-verified migration facts

The owner has created the **marginguard** Cloudflare Pages project and verified
`https://marginguard.pages.dev/`. Its Production branch is **main**. The initial
production deployment is `7f34343640d307bd7b13ffdc54b1e9dee749ad2e`, reported
**Success**, and the owner reports passing functional smoke tests.

The **marginguard-bfcm** legacy project at
`https://marginguard-bfcm.pages.dev/` must remain available for existing external
links. The owner will manually disable **both Production and Preview automatic
deployments on the legacy project before approving any merge**. That operation
is a pending manual release gate, not something this PR performs or claims done.

PR **#10**, on the existing `chore/evergreen-domain-migration` branch targeting
`main`, now prepares the verified evergreen origin. No new PR is needed. This is
configuration in an unmerged PR, not a deployed metadata change. No Cloudflare
project/settings/token operation, repository/package rename, merge, direct main
push, deployment, redirect installation or Preview promotion is authorized here.

The verification facts above are attributed to the owner. The workspace's
outbound proxy rejected a direct HTTPS HEAD request with a CONNECT-tunnel 403;
no response from the site origin was obtained. This is not evidence that the
website returns 403. Live redirect/TLS response checks remain for the owner;
repository and generated-artifact redirect checks are recorded below.

Historical root `README`, `README.txt`, workbook, original CSV/JSON fixtures,
engineering phase reports, validation history and private package identifier are
retained for reproducibility. They are not current product branding. The eight
original fixtures stay byte-for-byte intact; source calculations and behavior
are unchanged. There is no automatic repository rename or link rewriting.

## Prepared metadata: one active origin

`config/site.json` is the single source for the evergreen name, title,
description and configured production origin. It now uses the owner-verified
`https://marginguard.pages.dev` in this PR. No legacy origin is embedded in
generated production or preview metadata.
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

The regression test explicitly pins the verified evergreen origin. Canonical,
Open Graph URL, Twitter/X URL, robots sitemap reference and sitemap root agree.
Preview retains `noindex, nofollow`, a crawlable robots file and no sitemap;
its canonical/OG/Twitter URLs point to the evergreen production origin, never a
preview host. These changes remain on PR #10 until owner-approved integration.

## Remaining release gates — no automatic operations

1. **Owner disables automatic Production and Preview deployments on the legacy project before merge approval.** Record confirmation privately; do not delete that project or its existing working deployment. This prevents both projects rebuilding the app from future main/branch pushes.
2. Owner reviews PR #10's generated production/preview metadata and preview artifact. The owner-verified initial deployment proves the new project exists and the app smoke test passed; it does not prove this still-unmerged metadata has reached Production.
3. After explicit owner approval only, integrate PR #10 through the existing release process. Its target stays `main`; do not push directly to main or promote a Preview from this task. The owner must account for automatic production deployment on the new project after an approved merge.
4. Owner verifies the resulting approved production deployment on the evergreen hostname: root/assets, both modes, local imports/exports, HTTPS, canonical, Open Graph/Twitter URLs, robots, sitemap, indexing and privacy headers. Check the actual HTTP chain has **no new-to-legacy redirect**. A static artifact scan cannot certify host-side rules.
5. Preserve the legacy app and existing shared links during acceptance. Inventory shared paths/fragments, query-bearing links and static assets before any redirect. An eventual **legacy-to-new 301** is a separate, later owner-approved operation. No redirect belongs in this shared app's `public/` directory.

No merchant database or account migration is required. Use fictional data for
validation. Keep verification evidence free of credentials and merchant data.
The initial project creation and smoke verification are complete owner-reported
facts, not pending name-availability tasks.

## Exact generated metadata contract

| Item | Production build | Non-main Cloudflare preview build |
| --- | --- | --- |
| Canonical | `https://marginguard.pages.dev/` | Same evergreen canonical |
| Open Graph `og:url` | `https://marginguard.pages.dev/` | Same evergreen URL |
| Twitter/X `twitter:url` | `https://marginguard.pages.dev/` | Same evergreen URL |
| Robots meta | `index, follow` | `noindex, nofollow` |
| robots.txt | `Allow: /` plus `Sitemap: https://marginguard.pages.dev/sitemap.xml` | `Allow: /`, no sitemap reference |
| sitemap.xml root `<loc>` | `https://marginguard.pages.dev/` | No sitemap emitted |

The robots artifact is intended for `https://marginguard.pages.dev/robots.txt`;
the sitemap artifact for `https://marginguard.pages.dev/sitemap.xml`. The public
launch documentation now links to the owner-verified evergreen URL. Twitter/X
card/title/description retain evergreen copy and the explicit URL agrees with
Open Graph. No share image or non-existent route is invented.

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

- **Before merge:** leave PR #10 unmerged or revise its branch; the existing initial deployment remains unchanged. No Cloudflare rollback is needed merely for editing this PR.
- **After approved merge, before redirect:** owner restores the recorded known-good evergreen deployment (initial known reference `7f34343640d307bd7b13ffdc54b1e9dee749ad2e`, or a later accepted artifact) if necessary. Keep the legacy app intact, with automatic builds disabled. Prepare an owner-approved fix/revert rather than writing main from this task. Recheck canonical/OG/Twitter/robots/sitemap consistency; do not introduce an evergreen-to-legacy redirect as a shortcut.
- **After redirect:** stop promotions of the new URL; owner restores the old app deployment and removes/replaces the legacy redirect using the recorded platform rollback path. Restore legacy canonical/OG/sitemap via the approved rollback artifact. Do not add a reverse new-to-old redirect while a cached old-to-new 301 can create a loop. Keep a working app on the new hostname for cached-redirect clients until recovery is verified; cached 301s cannot reliably be revoked immediately.
- Record the incident and re-run synthetic smoke tests on both URLs. Never delete either project, rewrite shared Git history or rename the repository as a rollback shortcut. A redirect-only legacy deployment has no merchant database to restore, but downloaded reports remain the merchant's responsibility.

## Low-maintenance steady state

One evergreen app project, one origin configuration value, and a legacy
redirect-only project retained for old links. No seasonal branding switches,
custom backend or domain-routing service is required. Keep redirect ownership,
project access and rollback evidence available; review dependency/security
updates separately. The old technical repository and fixture names do not need
renaming to maintain the public MarginGuard identity.

## Verification of Stage 3D.2

- `npm test`: **261 tests in 14 files pass**, including original financial/fixture checks and the updated evergreen-origin metadata regressions.
- `npm run build`: strict TypeScript and static production build pass.
- Production and separate non-main preview artifacts are inspected for canonical, OG URL, Twitter/X URL/card/title/description, robots and sitemap. All metadata URLs use the evergreen origin; preview stays noindex/nofollow and has no sitemap. No legacy-host URL, meta refresh, redirect file or runtime redirect is added to the application output.
- `CHROMIUM_NO_SANDBOX=1 npm run test:browser`: **131 layout/state checks** at all eight supported widths, including actual rendered canonical/OG/Twitter URL checks; no runtime errors or external page requests. The no-sandbox flag is limited to the disposable test container.
- Financial engine, CSV/parser/import logic, tiers, recommendation logic, state, both modes, UI styles, exports, package/dependency files and original fixture bytes remain unchanged by this update.

Independent live HTTP verification was blocked by the workspace proxy as described
above. Owner confirmation of legacy auto-build disabling, merge approval,
post-merge hosted metadata/redirect checks and the later legacy 301 remain manual.
No Cloudflare changes, redirects, merge, main push or deployment were performed.
