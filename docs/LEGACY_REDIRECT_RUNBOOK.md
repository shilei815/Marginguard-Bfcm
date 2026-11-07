# Legacy Pages redirect preparation and owner runbook

**Assessment: CONDITIONAL PASS for preparation. NOT approval to deploy.**
Repository `shilei815/Marginguard-Bfcm`; branch
`chore/legacy-redirect-preparation`. Reviewed November 6, 2026
(America/Los_Angeles). PR #10 is confirmed merged and fetched `origin/main`
exactly matches approved merge `69f91e492e371dc4ca23f0d9b3d0c3c847e98696`.

This task adds isolated operational files and tests only. No application file,
financial/CSV/tier/state/export behavior, dependency, Vite configuration, DNS,
Cloudflare setting or production deployment changes. No Wrangler installation,
Cloudflare login/API request, project creation/deletion or redirect activation
was performed. The owner must separately approve any deployment.

## Package and final rules

Deployment directory: **`ops/legacy-redirect/site`**, not `dist`, not `public`,
not the entire `ops/legacy-redirect` directory. Its complete contents are:

- `_redirects`: the two rules below.
- `404.html`: a plain noindex fallback linking to the evergreen site, with no JavaScript, automatic navigation, analytics or tracking. It is not a copy of the app. If it appears, investigate failed rule application.

```text
/ https://marginguard.pages.dev/ 301
/* https://marginguard.pages.dev/:splat 301
```

The explicit static root rule comes first so root handling does not depend on
whether a wildcard captures an empty suffix. The second rule retains a nested
path through the documented splat. The destination never contains a fragment or
fixed query. There is no relative scheme/host substitution or new-to-old rule.

**Important limitation:** Pages `_redirects` sources are paths, not a supported
hostname condition. These rules act on the project receiving the package,
including its applicable preview/deployment aliases. They do **not** themselves
verify `Host: marginguard-bfcm.pages.dev`. Deploying them to `marginguard` could
create a self-loop. The exact legacy account/project selection and artifact
isolation are mandatory operational guards. If literal legacy-host-only matching
excluding all project aliases is required, this static package cannot prove that;
stop and seek a separately approved supported design rather than adding a Worker
or pretending an unsupported absolute-source rule works.

## Official behavior reviewed

Primary sources, checked during preparation:

- [Pages redirects](https://developers.cloudflare.com/pages/configuration/redirects/): path source, explicit redirect status, external destinations and greedy splat substitution; domain-level/query-conditioned sources are not supported. This documents rule structure, not all live edge behavior.
- [Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/): disabling automatic builds permits Wrangler uploads to an existing Git-integrated project. Do not convert/create a different project to perform this operation.
- [Wrangler Pages deploy](https://developers.cloudflare.com/workers/wrangler/commands/pages/#deploy): deploy a specified static directory to a named project and branch.
- [Pages rollback](https://developers.cloudflare.com/pages/configuration/rollbacks/): restore an earlier successful Production deployment; a Preview deployment is not a Production rollback target.
- [HTTP Location fragment handling, RFC 9110 §10.2.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-10.2.2): a redirect without a target fragment allows the user agent to inherit the original fragment.
- [Pages limits](https://developers.cloudflare.com/pages/platform/limits/): this two-file/two-rule static design uses no paid-only redirect feature and is well below the listed Free-plan file/rule limits.

### Query strings and fragments

Pages documentation rejects query-conditioned source rules and permits queries
in destinations, but does not clearly guarantee incoming-query passthrough for
this external splat rule. **Do not infer a passthrough guarantee from that table.**
Required acceptance intent is preservation, e.g. `/?utm_source=shopify` should
produce `https://marginguard.pages.dev/?utm_source=shopify`. The local model
explicitly chooses that behavior; it is not Cloudflare's parser/runtime.
Actual query preservation must pass an owner-approved hosted validation before
a permanent Production redirect. If it drops or changes important parameters,
stop and revise the plan; do not silently accept or add a backend/Worker.

Fragments are not transmitted in HTTP requests. The prepared Location has no
fragment, letting the browser perform inheritance. Chromium was tested locally
across two loopback origins, including `/#step-2` and a query plus fragment.
That verifies that browser's response handling in the mock, not Cloudflare's live
Location header or physical Safari/Firefox behavior. `curl` cannot verify a
browser fragment. Browser-cached 301 reuse is expected and is not a new server
request; a permanent redirect can outlive a server-side rollback.

## A. Prerequisites — owner must record before approval

1. Evergreen `https://marginguard.pages.dev/` is live, correct and not redirecting back to legacy. Inspect current canonical, OG/Twitter URL, `/robots.txt` sitemap reference and `/sitemap.xml` root. Verify JS/CSS, both modes, local import/export, TLS and representative synthetic workflow. Previous owner smoke reports are context, not current live checks by this task.
2. Legacy project **marginguard-bfcm** still exists and its automatic **Production and Preview** deployments are disabled. Record dashboard evidence; do not assume disabled builds also prohibit explicit Wrangler uploads. Confirm its configured Production branch is **main**; otherwise stop rather than changing settings here.
3. Confirm exact Cloudflare account ownership/ID and both similarly named projects. Use the owner's existing authorized identity only during a later approved operation. Never put tokens in this repository, runbook, logs or PR.
4. Record the currently successful **legacy Production deployment ID**, URL, commit and rollback target before replacement. The known Git merge hash is not a Cloudflare deployment ID. No actual legacy deployment ID is available in this preparation task; the owner must supply it. Ensure the rollback target still exists and is Production, not Preview.
5. Pin/review this preparation commit and the upload-folder contents. No Wrangler config, Functions directory or Worker may be discovered or bundled. `package.json` in the ops folder is descriptive preflight metadata, not a Wrangler project configuration or deployment script.
6. Review the [asset inventory](../ops/legacy-redirect/ASSET_INVENTORY.md), actual legacy deployment artifacts and shared URLs. Resolve required missing hashed assets or explicitly approve documented exceptions. A 301 path match is not evidence of a successful final asset request.
7. Obtain separate approval covering exact project, account, folder, 301 behavior, query results, rollback target and any validation-stage deployment. Do not merge this draft or execute the proposed upload merely because local tests pass.

## B. Local checks and exact proposed deployment command

Run local checks from the repository root (no Cloudflare access):

```sh
npm test
npm run build
node ops/legacy-redirect/check.mjs
CHROMIUM_NO_SANDBOX=1 node ops/legacy-redirect/browser-qa.mjs
CHROMIUM_NO_SANDBOX=1 npm run test:browser
```

Chromium must be installed; the no-sandbox flag is for a disposable test container
only. The ops check uses the recorded SHA-256 values of 26 approved application,
configuration, dependency and original fixture files, checks the two-file package,
and verifies normal app `dist/` has no redirect/Worker/fallback artifact. The
checksum snapshot is release-specific audit evidence, not a permanent CI freeze
on future app development. Do not refresh it casually to hide changes.

**PROPOSED ONLY — DO NOT EXECUTE IN THIS TASK:**

```sh
npx wrangler@4 pages deploy ops/legacy-redirect/site --project-name=marginguard-bfcm --branch=main
```

This explicitly uploads only the isolated folder to the existing legacy project;
`--branch=main` is Production only if the verified legacy production branch is
main. It is not a Git push or a new project. The owner should review/record the
exact Wrangler 4 patch used at execution time and the current official command
behavior; no Wrangler is installed or authenticated during preparation. If the
CLI suggests creating a project, names the new `marginguard` project, selects an
unexpected account, or uploads `dist`, **cancel**. Never accept an inferred project
or branch. No automatic repeat after success; record the resulting legacy
Production deployment ID and verify its target project immediately.

### Optional 302 validation — separately approved, never replace working Production casually

A non-production preview deployment to a distinct validation branch of the
**legacy project** can be considered after explicit owner approval and review of
Wrangler/Pages branch semantics. Copy only the two static assets into a separate
temporary staging folder, change its status codes to 302, and retain the original
301 package unchanged. A preview alias must be confirmed non-production before
upload. Do not use `--branch=main` for that stage. This runbook deliberately
provides no automatic staging/deploy script. Do not create another project or
repurpose the current Production site for 302 testing without approval.

Verify query/path/fragment behavior and rollback readiness there first. Preview
and Production routing may still differ, so repeat the acceptance checks after
an explicitly approved Production cutover. Temporary stage success is not a
license to run the permanent command automatically.

## C. Hosted acceptance — examples for the later approved operation

These public HTTP inspection commands do not install anything; they must be run
against the actual deployment after the appropriate approval/validation stage.
Inspect responses before following them:

```sh
curl --path-as-is -sS -D - -o /dev/null 'https://marginguard-bfcm.pages.dev/'
curl --path-as-is -sS -D - -o /dev/null 'https://marginguard-bfcm.pages.dev/demo-skus.csv'
curl --path-as-is -sS -D - -o /dev/null 'https://marginguard-bfcm.pages.dev/?utm_source=shopify'
curl --path-as-is -sS -D - -o /dev/null 'https://marginguard-bfcm.pages.dev/assets/example.js'
curl -sS -L --max-redirs 3 -o /dev/null -w 'status=%{http_code} hops=%{num_redirects} final=%{url_effective}\n' 'https://marginguard-bfcm.pages.dev/'
curl -sS -D - -o /dev/null 'https://marginguard.pages.dev/'
```

| Source on legacy | Required Location / browser result | Final resource requirement |
| --- | --- | --- |
| `/` | `https://marginguard.pages.dev/` | Correct evergreen app, no loop. |
| `/demo-skus.csv` | `https://marginguard.pages.dev/demo-skus.csv` | CSV served correctly. |
| `/?utm_source=shopify` | `https://marginguard.pages.dev/?utm_source=shopify` | Query intact; **live gate**, not locally proved. |
| `/#step-2` | HTTP Location root without hash; browser ends at new `/#step-2` | Anchor/step available; check real browsers. |
| `/?utm_source=shopify#step-2` | Query in actual Location, hash inherited by browser | Both preserved, no duplicate query. |
| `/assets/example.js` | `https://marginguard.pages.dev/assets/example.js` | Path preserved; example is absent in reproduced build. Live 404 or an HTML SPA fallback is possible; neither is a valid JS asset. |
| Known deployed JS/CSS paths | Same path on evergreen origin | Correct content type/body, not an HTML SPA fallback disguised as a successful asset. |

Verify explicit **301** status for permanent rules (302 only for approved staging),
absolute HTTPS Location on the evergreen host, path/trailing-slash/encoding and
query preservation, one intended hop, no new-to-old redirect and no meta/JS loop.
Check repeat/encoded query parameters if shared URLs use them. Fragments need
real browser address-bar and anchor checks. Inspect both new and old roots and
record exact legacy deployment ID plus known-good rollback ID alongside results.
Do not claim successful deployment from the CLI message alone.

## D. Rollback — owner action only

If a critical acceptance check fails, stop rollout and use the **legacy** project
Deployments history to select the recorded successful Production deployment.
Choose **Rollback to this deployment**, verify the confirmation identifies
`marginguard-bfcm`, and restore it. Record rollback/current deployment IDs and
repeat root, assets, query, canonical and loop checks. Cloudflare documents that
Preview deployments are not Production rollback targets.

Do not delete either project, alter the new project's routing, reverse the
redirect on the new host, or rewrite shared Git history. Keep the evergreen site
working for clients that cached the old 301. Browsers/search engines can retain
301 decisions after the old server is restored; rollback is not guaranteed to
revoke those client caches immediately. This is why a separately approved 302
preview validation can be useful. A restore operation itself still needs the
owner's production authority and must not be performed by this preparation task.

## E. Cost and maintenance

This static two-file/two-rule design requires no paid Cloudflare feature, server,
Worker/Pages Function, database, cron, tracking, account system or ongoing GitHub
deployment. It fits published Free-plan file/rule limits; this is not a guarantee
about every account's existing charges, future plan changes or traffic policy.
No dependency was added to the application. Keep legacy automatic builds off,
retain both project names and the rollback artifact, keep account access valid,
and periodically verify the redirect/new hostname and important shared links.
Future app releases can invalidate old hashed assets: maintain any agreed
immutable-asset retention policy on the new site. Do not keep rebuilding the
legacy app on each main push. Never delete the legacy URL just to remove old
branding.

## Verification and assessment

**CONDITIONAL PASS — preparation only.** Local structure, path intent, package
isolation, unchanged approved application and browser-model checks are verified.
The local matcher is deliberately narrow; it is not Cloudflare's parser or edge.
The localhost browser test assumes query forwarding, uses mock resources and
checks browser fragment inheritance, including permitted cached-301 reuse. It
also demonstrates that an absent historical asset can remain 404 after a correct
redirect. No Cloudflare account, live deployment or hosted redirect was tested.

Before owner-approved activation, the following remain unverified: current new
site/TLS/SEO and all required assets; legacy auto-build disabling and main branch;
exact account/project ownership; recorded legacy Production/rollback IDs; Pages
root/nested/query behavior on the deployed artifact; real-host fragment handling
and browser caches; final response codes/types; alias behavior and lack of live
loops; resolution of historical hashed-asset exceptions. Do not turn this into
an unconditional PASS or deploy until these gates have owner evidence.

### Executed local evidence

- Approved fetched main equals `69f91e492e371dc4ca23f0d9b3d0c3c847e98696`; GitHub metadata confirms PR #10 merged with that merge SHA.
- `npm test`: **279 tests in 15 files pass** (261 existing plus 18 redirect preparation cases).
- `npm run build`: TypeScript/Vite pass, 42 modules; normal `dist/` contains only evergreen application assets/metadata and no legacy redirect package.
- `node ops/legacy-redirect/check.mjs`: package/rules/isolation pass; all **26 pinned application/config/dependency/original-fixture checksums** match the approved main baseline. No root Wrangler configuration or Functions directory is present.
- Existing app browser QA: **131 layout/state checks**, Chromium 154.0.8037.57, eight widths from 320 to 1920px; no runtime errors or external page requests recorded.
- Local redirect model browser QA: **six cases pass** in Chromium, including root, CSV, query intent, fragment, combined query/fragment and missing example asset. No external requests; fragments absent from HTTP logs. The model results do not establish Cloudflare edge behavior.
- Upload directory has exactly **two files, 538 bytes total**. No application JS/CSS, Functions, Worker, dependency install, credential, CI workflow or deploy script is included.

Generated local reports are ignored under `work/`; the local mock browser report
is `work/legacy-redirect-qa/report.json`. No live checks or deployment have been
substituted with these model results. The snapshot records the current approved
release; future app/asset changes require separate owner review of any affected
migration assumptions, not automatic legacy rebuilds.
