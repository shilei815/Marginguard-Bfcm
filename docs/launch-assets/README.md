# Actual fictional-demo launch captures

Unedited PNG viewport captures from the local production build on
`feat/public-launch-readiness`, based on approved main
`69f91e492e371dc4ca23f0d9b3d0c3c847e98696`. Captured November 7, 2026 using
Chromium 154.0.8037.57, 1440 × 1000 viewport, 100% browser zoom. No merchant data.
These files are documentation assets, not runtime application assets.

Reproduce from the repository root:

```sh
npm run build
CHROMIUM_NO_SANDBOX=1 npm run test:browser
cp work/browser-qa/simple-1440.png docs/launch-assets/01-simple-demo.png
cp work/browser-qa/comparison-1440.png docs/launch-assets/02-demo-comparison.png
# Stage 4A.2 refreshes only 01 and 02. Preserve existing 03-advanced-demo.png.
# Original 03 source: work/browser-qa/launch-advanced-frontier.png
```

Use no-sandbox only in an appropriate disposable container. The existing QA
harness launches Chromium and serves the actual build over loopback; it does
not deploy. It asserts no external page requests and no runtime errors.

- **01**: initial fictional 30-SKU demo and new onboarding sentence.
- **02**: actual Simple comparison, prior to applying its suggestion, with a 20%
  storewide offer, $20,000 goal and $500 buffer. The harness also assigns tiers
  and changes Tier 1 defaults before reaching this state. Exact setup is in
  `scripts/browser-qa.mjs`; no results were manually entered into the screenshot.
- **03**: actual Advanced cumulative discount chart after applying the suggested
  plan and selecting Optimize. Expanded model disclosure and tier controls are
  visible; this is the existing engine output, not a demand forecast.

The screenshot content and figures are demonstration evidence only. No image
was generated, composited, annotated or retouched. Product Hunt presentation,
physical-device rendering and production-host behavior require owner review.
See `../PRODUCT_HUNT_LAUNCH.md` for copy and release gates. The owner-approved public address is now configured as miniventurelab@gmail.com;
manual email-client/delivery verification remains pending.

## Stage 4A.2 approved refresh

Images 01 and 02 were recaptured from application commit
`aafc999f9c78c27c12574e120e73484486a7548a` with the unchanged browser QA workflow.
Both show the actual Feedback entry in the Simple top bar. Original 1440 × 1000
pixel dimensions, 100% zoom, fictional demo inputs, tier setup and genuine chart
outputs are preserved. No retouching, chart edits or generated UI images.

Image 03 remains byte-for-byte unchanged: its visible scrolled chart content is
still accurate. Its original SHA-256 is
`a54a011ae58c5bb0f8a184fb9318c54a876740922cff47bbb4a5b088f003299c`.
The refreshed images and all three checksums are recorded in `SHA256SUMS`.

Owner review of the gallery, manual email-client/delivery verification, release
approval, production smoke testing and Product Hunt publication remain pending.

Refresh validation: `npm test` passed 263 tests in 15 files; `npm run build`
passed; the unchanged Chromium browser workflow passed 139 layout/state checks
at eight widths (320–1920px), with no runtime errors or external page requests.
Both refreshed images were visually inspected for Feedback visibility, matching
dimensions and genuine demo output. All screenshot checksums validate. Application
source, financial logic, browser workflow, configuration and dependencies are
unchanged from the captured application commit.
