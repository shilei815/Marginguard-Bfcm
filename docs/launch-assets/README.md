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
cp work/browser-qa/launch-advanced-frontier.png docs/launch-assets/03-advanced-demo.png
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
See `../PRODUCT_HUNT_LAUNCH.md` for copy and release gates. A configured and
verified public feedback address remains a launch blocker.
