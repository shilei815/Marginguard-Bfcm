# Temporary legacy 302 preview — preparation only

This is a separate package for the **existing legacy project**
`marginguard-bfcm`, on non-production branch **`redirect-validation-302`**.
Expected legacy Production branch: **`main`**. Those branch names are distinct.
The preflight refuses either the new project `marginguard` or Production `main`.
No Cloudflare settings are read/changed by these checks; the owner must confirm
the actual account/project and Production branch before an approved deployment.

Only `ops/legacy-redirect/preview-302/site` is an upload directory. It contains
exactly `_redirects` and a plain noindex 404 fallback linking to the evergreen
site. No app copy, JavaScript, Functions, Worker, tracking or dependencies.
The existing `ops/legacy-redirect/site` 301 assets and every other original
301 package file remain byte-for-byte unchanged.

## Exact rules

```text
/ https://marginguard.pages.dev/ 302
/* https://marginguard.pages.dev/:splat 302
```

## Local verification only

From the repository root:

```sh
npm test
npm run build
node ops/legacy-redirect/check.mjs
node ops/legacy-redirect/preview-302/check.mjs --project-name=marginguard-bfcm --branch=redirect-validation-302 --production-branch=main
CHROMIUM_NO_SANDBOX=1 node ops/legacy-redirect/preview-302/browser-qa.mjs
CHROMIUM_NO_SANDBOX=1 node ops/legacy-redirect/browser-qa.mjs
CHROMIUM_NO_SANDBOX=1 npm run test:browser
```

Chromium and loopback networking are required for browser QA. Use no-sandbox only
in a disposable container where necessary. The preview preflight validates the
planned project/branch/directory and hashes all **10** original 301 package
files against PR #11 commit `61dc8cf7d9619903579f51c3059d1cd76c3c28a6`.
The parent preflight separately verifies the 26 approved app/fixture checksums
and absence of redirect assets from normal `dist/`.

Example negative checks (must fail):

```sh
node ops/legacy-redirect/preview-302/check.mjs --project-name=marginguard
node ops/legacy-redirect/preview-302/check.mjs --branch=main
```

These are read-only checks, not deployment wrappers. They cannot intercept an
independent Wrangler command with different arguments. Pages path rules do not
enforce a hostname guard; wrong-project deployment can still loop. Never upload
this folder to `marginguard`, use the 301 directory for this preview, or assume a
branch is non-production without checking the actual project configuration.

## Proposed Preview command — NOT executed

After separate owner approval and account/project/branch verification only:

```sh
npx wrangler@4 pages deploy ops/legacy-redirect/preview-302/site --project-name=marginguard-bfcm --branch=redirect-validation-302
```

This must create a **Preview** deployment in the legacy project, not Production.
Verify the CLI/account/project/output and record the resulting Preview deployment
ID/URL. If it proposes a new project, names `marginguard`, selects `main`, requests
an unexpected account or identifies Production, cancel. Do not accept defaults,
retry after success, promote the Preview, or change project settings from this
preparation task. No Wrangler install, login or upload was performed here.

## What the tests prove, and what remains live

Unit tests cover exact 302 destinations, root/nested paths, explicit query
preservation intent, fragments excluded from HTTP Location, rejection of unsafe
plans, isolation and unchanged 301 package hashes. The browser harness starts two
temporary loopback HTTP model servers. It verifies actual Chromium-observed 302
responses, destination paths, query intent and inherited fragments, with no
external requests. Its source server uses `Cache-Control: no-store` only to keep
mock test cases independent; that header is not installed by this static package.

The local model **assumes** query forwarding; it is not Cloudflare's parser.
The original runbook's Pages query-behavior caveat still applies. Browser fragment
inheritance in the mock is not proof of Cloudflare's real Location response or
physical Safari/Firefox behavior. `assets/example.js` intentionally returns 404
in the mock: correct redirects do not imply historical asset availability.

After a separately approved Preview upload, the owner must use the actual
Preview URL (do not guess its alias) to check:

- Deployment is Preview on `redirect-validation-302`, in legacy project/account only. Legacy root and Production deployment ID remain unchanged; new `marginguard` project is unaffected.
- `/` and nested paths return **302**, with an absolute evergreen Location and no new-to-old redirect or loop.
- `/?utm_source=shopify` and repeat/encoded parameters preserve required queries. Stop if Pages drops or alters important query data.
- Browser `/#step-2` and combined query/fragment end at the evergreen URL with a working fragment; fragments are not sent in HTTP.
- CSV and known deployed JS/CSS resolve with correct final body/type; unknown hashed assets may be absent or return HTML fallback. See the parent asset inventory.
- Actual hosted status/header/cache behavior, TLS and browser results are recorded. The mock's no-store behavior is not a Cloudflare cache guarantee.

A successful Preview does not approve the permanent 301 deployment. Leave
Production untouched and obtain a separate release decision. If Preview fails,
stop; do not promote or replace Production as a workaround. A Preview is not a
Production rollback target. Retain the original Production deployment/rollback
IDs from the [main runbook](../../../docs/LEGACY_REDIRECT_RUNBOOK.md).

## Recorded local verification

- `npm test`: **300 tests in 16 files passed**, including 21 new preview cases.
- `npm run build`: TypeScript and Vite production build passed.
- Both package preflights passed; all **10 original 301 files** and **26 approved application/fixture checksums** remained unchanged. Both unsafe-project and Production-branch negative checks rejected the plan.
- Chromium: **six 302 model cases** and **six original 301 model cases** passed, with no external requests.
- Application browser QA: **131 states at eight widths (320–1920px)** plus **33 checks at 125%, 150% and 200% zoom** passed, without runtime errors or external page requests. Zoom checks used `BROWSER_ZOOM=1.25`, `1.5` and `2` with the existing `test:browser` command.

These results are local preparation evidence only. No Cloudflare deployment,
settings update, live redirect or Wrangler authentication was performed.
