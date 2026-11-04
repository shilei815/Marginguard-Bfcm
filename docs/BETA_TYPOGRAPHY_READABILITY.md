# Beta typography and readability polish

Prepared on `fix/beta-typography-readability` from contrast remediation commit
`8c76546`. This is CSS and regression-test work only. Application calculations,
state, tier policy, CSV contracts, uploads/exports and original fixtures are
unchanged. No merge, hosting setting or Production deployment is part of this work.

## Computed font-size comparison

Values below are actual Chromium computed CSS pixels at a 1440px viewport and
100% zoom. Simple / Advanced figures distinguish the two modes. KPI display
sizes and the main headline are preserved; the text surrounding them is larger.

| Element | Before: Simple / Advanced | After: Simple / Advanced |
| --- | --- | --- |
| Body | 14 / 14 | 16 / 16 |
| Main headline | 30 / 30 | 30 / 30 |
| Primary explanatory paragraph | 12 / 12 | 15 / 16 |
| Caption / helper text | 12 / 10 | 14 / 14 |
| Secondary button | 11 / 11 | 14 / 14 |
| Form label | 12 / 10 | 14 / 14 |
| Form value | 16 / 12 | 16 / 16 |
| Navigation | 12 / 12 | 14 / 14 |
| Disclosure summary | 12 / 11 | 14 / 14 |
| Table body | 12 / 10 | 14 / 13 |
| Table header | 11 / 9 | 13 / 12 |
| Section heading | 17 / 17 | 20 / 20 |
| KPI number | 30 / 27 | 30 / 27 |
| Warning container | 12 / 11 | 14 / 14 |
| Advanced chart legend | — / 9 | — / 13 |

All visible stylesheet font-size declarations are at least 12px. Primary copy uses
15–16px, meaningful helper copy 13–14px, while compact branding and secondary
metadata can use 12px. Paragraph line heights are 1.6; captions 1.7; general body
copy 1.5. Heading and KPI line heights preserve a compact display hierarchy.

SVG label size is also checked **after the SVG viewBox transform**, rather than
relying on computed font size alone. Labels use 18px in SVG coordinates, with
minimum chart widths that keep displayed text at least 13px. The cumulative chart
uses a 700px minimum / 900px maximum and Simple comparison an 800px maximum with
a 640px minimum. Narrow screens can pan charts inside their panels; page-level
horizontal scrolling is not needed. Plotted geometry/data are not changed. Duplicate in-plot threshold/break-even
annotations use the existing readable HTML keys below the chart, preventing
collisions between near-identical goal/buffer labels. Axis percentages move
slightly lower to avoid the Current Plan label. Wide
SKU and report tables retain their existing internal horizontal scrolling.

## Layout and accessibility preservation

Buttons, labels, headings and desktop action groups can wrap naturally. Forms
use 16px values and at least 42px input height, excluding native range/checkbox
controls. The Advanced workspace stacks when its columns would crowd readable
content. Its sidebar can scroll vertically at zoom. Legends remain available at
the intermediate desktop breakpoint rather than being hidden to save space.

The exact contrast tokens from `8c76546` are retained: muted text `#4f665b`,
control borders `#62796b`, focus `#945424`. The rendered contrast audit continues
to check normal text at 4.5:1, large text at 3:1 and relevant non-text boundaries
at 3:1 on actual white, green and warning surfaces. Native disabled state,
keyboard operation and visible focus are preserved.

## Reproducing verification

```sh
npm test
npm run build
npm test
CHROMIUM_NO_SANDBOX=1 npm run test:browser
CHROMIUM_NO_SANDBOX=1 BROWSER_ZOOM=1.25 npm run test:browser
CHROMIUM_NO_SANDBOX=1 BROWSER_ZOOM=1.5 npm run test:browser
CHROMIUM_NO_SANDBOX=1 BROWSER_ZOOM=2 npm run test:browser
```

Use the no-sandbox flag only in a disposable container that cannot start
Chromium's sandbox. An installed Chromium is required. The standard run checks
320, 375, 390, 430, 768, 1024, 1440 and 1920px. Zoom runs use actual desktop
Chromium profile zoom at 125%, 150% and 200% for physical windows 1024, 1440 and
1920px; the harness verifies the reduced CSS viewport, increased device pixel
ratio and unchanged pinch/page scale. These are not screenshot magnification
or pinch-zoom substitutes. Profiles are temporary and never shipped with the app.

Browser regressions assert computed font-size minimums, transformed SVG text
sizes, text-container overflow, page overflow, offscreen controls, sibling
layout overlaps and contrast. They exercise expanded disclosures, suggestions,
tiers, both modes, imports, diagnostics, chart keyboard controls and exports.
Reports/screenshot artifacts are in ignored `work/browser-qa/`: `report.json`
for 100%, and `zoom-125.json`, `zoom-150.json`, `zoom-200.json` for zoom runs.


## Executed results

- `npm test` → `npm run build` → `npm test`: **251 tests in 13 files pass on both runs**; strict TypeScript and Vite production build pass. All 247 earlier tests, including original fixture SHA checks and contrast regressions, are retained.
- Chromium 154.0.8037.57 at 100%: **131 layout/state checks** across all eight requested widths.
- Actual 125%, 150%, 200% browser zoom: **10, 11 and 12 additional checks**, respectively, across 1024/1440/1920px physical windows. The extra cases verify responsive navigation at reduced CSS widths, Enter activation and visible Tab focus; the primary cases cover expanded disclosures, suggested plans and Advanced charts.
- **164 total layout/state checks**, **85,050 sampled contrast checks**, zero recorded contrast failures, page overflow, offscreen controls, tested sibling/SVG label collisions, runtime exceptions or external page requests.
- Visually inspected both modes on mobile and desktop, the comparison chart, and desktop zoom screenshots. For example, a 1440px physical window at 200% correctly reports a 720px layout viewport, DPR 2 and page scale 1.
- Original financial/rule/import/CSV/state code and dependency manifests match `8c76546` byte-for-byte. Only application CSS, browser test code, a typography test and this report change.

## Remaining limits

Physical Safari/Firefox, screen readers, mobile pinch zoom, OS text-size settings,
forced colors and comprehensive accessibility certification remain unverified.
Desktop Chromium zoom/reflow and sampled keyboard checks do not establish full
WCAG compliance. Narrow chart panels intentionally scroll horizontally so labels
stay readable; merchants may need to pan to see the full curve. All previous beta
financial, input-quality, hosting and operational gates remain in force.
