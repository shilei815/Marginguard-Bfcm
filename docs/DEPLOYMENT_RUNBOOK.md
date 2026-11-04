# MarginGuard beta-1 deployment runbook

This is a preparation document, **not authorization to deploy**. Stage 3A stops
at a pushed release candidate and audit. Do not merge main, retarget/merge the
existing draft chain, change GitHub's default branch or Cloudflare's Production
settings/branch, deploy Production, or register/publish a domain during this task.

## Current verified state

| Item | Value / evidence |
| --- | --- |
| Repository | `shilei815/Marginguard-Bfcm`, public |
| GitHub default branch | `main`, verified by GitHub metadata and remote symbolic HEAD |
| Current fetched `main` | `99b12e9cb1a509c391076c30b585607c295c03e2`, original data only |
| Latest reviewed development | `polish-advanced-chart-language`, `ec278cc46f04fcf244c7438f4c3b0fd1562d9cc5` |
| Release candidate | `release/beta-1`; pin the audit commit using `git rev-parse release/beta-1` and record it in the release decision |
| Draft PR chain | #1 Phase 1 → main; #2 → Phase 1; #3 → Phase 2A; #4 → Phase 2B; #5 → Phase 2C; #6 → Phase 2D. All open/draft/unmerged at audit. |
| **Cloudflare current Production branch** | **NOT VERIFIED.** No Cloudflare read connector/configuration available. Owner confirmation requested; do not assume `main` or Phase 1. |
| Current Production deployment ID / rollback artifact | NOT VERIFIED; owner must record before any future rollout |
| Hosted preview / production headers / telemetry | NOT VERIFIED; no deployment performed here |

## Integration strategy

Keep feature branches and the RC frozen. Review the six existing incremental
drafts against their stated bases. They already form one ancestor chain inside
the RC; merging them into each other is unnecessary and could trigger Production
on an intermediate branch. The recommended later integration is a single
cumulative `release/beta-1` → `main` PR, with a merge commit preserving history.
Review its complete diff and RC audit before owner-approved integration. Close
the old draft chain as superseded only after approved integration; do not merge
both the chain and duplicate cumulative changes. No new integration PR is created
or merged by this runbook.

First map deployment triggers. If `main` is the current Production branch, merging
that PR is itself potentially a Production deployment and requires approval for
both actions. If Cloudflare watches a different branch, do not change it or merge
into it to work around the gate. Record how an approved exact RC artifact would
reach the existing configured environment, then obtain a separate release
instruction. GitHub default branch and Cloudflare Production branch are separate.

## Gate 1 — read-only release inventory (owner/operator)

Before public launch, record the actual project/account, current Production
branch, automatic-build trigger settings, current deployment ID/commit and
existing rollback path in the private release record. Review whether pushing a
release branch creates a preview automatically and whether previews expose the
same resources as Production. Confirm there is no workflow that publishes every
push to Production. Do not print hosting tokens or add them to this repository.

Resolve P0-02 with that evidence. Record owner disposition of development-tool
advisories, caption contrast, unverified browser/accessibility coverage and
merchant acceptance in [audit](BETA_RELEASE_AUDIT.md) /
[limitations](BETA_KNOWN_LIMITATIONS.md). Confirm the published beta label,
[user guide](BETA_USER_GUIDE.md), privacy/disclaimer text and support channel will
be available to invited merchants. These docs are drafts in the repo, not a
claim that a hosted page has already published them.

## Gate 2 — reproduce the pinned candidate locally or in isolated build CI

Use the exact audit SHA, a clean checkout, lockfile and Node 24.19.0 / npm 11.9.0
(the audited versions). No application secrets or paid service are required.

```sh
git fetch origin release/beta-1
git switch --detach FETCH_HEAD
git rev-parse HEAD
npm ci
npm test
npm run build
npm run test:browser
```

Chromium must be installed. In a disposable container where Chromium's sandbox
cannot start, `CHROMIUM_NO_SANDBOX=1 npm run test:browser` is the audited harness
invocation; do not disable browser sandboxing for normal merchant use. The runner
starts a temporary loopback static server for testing only, then closes it.
Expected current results: 214 tests / 11 files, TypeScript + Vite build, 100
Chromium layout/state checks at 320, 375, 390, 430, 768 and 1440px. Reports and
screenshots are under ignored `work/browser-qa/`. Re-run scans at release time:

```sh
npm audit --omit=dev
npm audit
```

The full scan currently reports development-tool advisories; do not suppress them
or force-upgrade during release freeze without review. Build only trusted commits
in an isolated environment with no production financial data or unnecessary
credentials. Vite dev/Vitest services are not production servers.

Compare the RC against `ec278cc`: only the checkout warning, audit tests/browser
checks and four beta documents should be new. Verify original eight fixture
hashes through the test suite; financial/optimization/CSV modules, chart data and
exports must remain unchanged. If code or dependencies change, invalidate the
old test evidence and repeat relevant release checks.

## Gate 3 — approved isolated preview, later task only

After explicit owner authorization and verified preview isolation, use the
existing hosting platform's preview mechanism for the pinned RC. Do not change
the Production branch, custom domain or paid configuration. Required static build
settings to review, not apply during this audit:

- Repository root build directory; install from `package-lock.json` with `npm ci`.
- Build command `npm run build`; output directory `dist`.
- Compatible pinned Node version. No server runtime, database binding, payment integration or application environment secret.
- Serve HTTPS, HTML/CSS/JS and CSV with correct types. Ensure any injected host analytics, third-party scripts and access logging agree with published privacy wording.
- Inspect actual response headers, caching and security policy on preview. Consider a restrictive self-origin policy without blocking the required local Blob CSV downloads; verify it before applying any header change in a separately approved task.
- Exclude source checkout, test artifacts, `.env`, repository credentials and `work/` from published output. Publish static `dist/` only, never the repository or development server.

Use fictional/sanitized data: upload both templates, supplied/missing/explicit-zero
costs, tier and exact/min/max rules, failed-import rollback, infeasible goals,
rounded checkout offers and local exports. Verify Simple/Advanced state, charts,
warning disclosures and keyboard focus. Record browser versions and actual
physical Safari/Firefox/screen-reader results, or retain NOT VERIFIED. Inspect
network traffic to confirm uploaded data is not posted externally. Hosting/CDN
behavior can differ from local Chromium results.

## Gate 4 — future production release decision

Only after gate evidence, merchant acceptance and owner approval should an
operator integrate/deploy through the verified existing production path. Record:

1. Approved exact RC and any merge commit SHA, review decision and accepted limitations.
2. Existing project/branch mapping, deployment trigger, previous known-good deployment and rollback owner.
3. Test/build artifact identity and clean lockfile build; the deployed commit/artifact must match the approved candidate.
4. A post-deployment synthetic smoke test of page load, local upload, financial reference case, infeasible recommendation, rounding warning and CSV download; check network traffic and errors.
5. Stop/invite-beta decision. Do not send merchant invitations until the release owner approves the observed result.

If branch changes or domain publication are needed, stop and request a separate
explicit instruction. This runbook does not authorize them, payments, account
systems or any additional infrastructure.

## Rollback preparation (not exercised)

Before rollout, retain the existing known-good deployment ID/artifact and pinned
commit. If the new build breaks calculations, hard-rule verification, imports,
privacy or basic navigation, pause invitations and use the platform's existing
approved rollback mechanism to restore that known-good deployment, without
rewriting shared Git history or changing branch settings. Re-run the synthetic
smoke test afterward and record the incident. If no known-good app deployment or
rollback mechanism is available, treat that as an unresolved release gate rather
than inventing a rollback command. Local tests do not verify Cloudflare rollback.
