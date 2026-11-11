# Legacy redirect-only package — preparation only

**Never upload this package to `marginguard`.** It is intended only for the
existing `marginguard-bfcm` Pages project. The path-only rules cannot enforce a
hostname guard; wrong-project deployment can self-redirect the new site.

Only `site/` is a deployment directory. It contains `_redirects` and a plain,
noindex `404.html` fallback link, not the application. Sibling scripts, manifest,
checksums and tests are local preparation tools and are not deployment assets.
There is no deployment script, Cloudflare configuration or credential handling.

From the repository root, local verification only:

```sh
npm test
npm run build
node ops/legacy-redirect/check.mjs
CHROMIUM_NO_SANDBOX=1 node ops/legacy-redirect/browser-qa.mjs
```

Use the no-sandbox flag only in an isolated container that requires it. The
browser test starts two temporary loopback HTTP model servers; it never contacts
Cloudflare. Its query forwarding is an explicit assumption, not a Pages result.
The checksum file pins 26 app/fixture files to approved main `69f91e4`; it is a
release-preparation audit snapshot, not a recurring app-development freeze.

Read the [deployment/rollback runbook](../../docs/LEGACY_REDIRECT_RUNBOOK.md) and
[asset inventory](ASSET_INVENTORY.md). Owner approval and hosted checks are still
required. No 301 has been activated by committing these files.
