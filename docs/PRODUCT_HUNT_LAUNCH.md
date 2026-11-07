# MarginGuard public beta launch kit

Status: **draft; approved feedback contact configured, release and publication pending**. No launch
or deployment is authorized by this document.

## Listing copy

**Name:** MarginGuard

**Tagline (49 characters):** Plan discounts with a clearer view of your profit

**Description:** MarginGuard is a free discount planner for small e-commerce merchants. Try fictional demo products or import a CSV to compare offers, protect priority products and explore suggested discounts against a minimum profit goal. Calculations run locally in your browser. Expected sales stay fixed; results model profit after variable costs, not final net profit. No Shopify connection or saved campaigns.

**Website:** https://marginguard.pages.dev/

**Recommended topics:** E-Commerce, Productivity, Analytics (confirm available
Product Hunt categories when preparing the listing).

## Maker first comment

Hi Product Hunt! I built MarginGuard to help small e-commerce merchants see what
a discount plan could do to their profit before setting up offers in their store.

A fictional demo is already loaded: change a discount, check the profit view, and
try Improve My Plan. You can also import your own product CSV. The app processes
financial inputs in your browser and does not upload them. There are no accounts;
refreshing clears the campaign, so export the available CSV reports before leaving.

This is a free public beta. The model uses fixed expected sales, supplied or
confirmed variable costs, and explicit discount constraints. It does not forecast
demand or guarantee profit. Suggested offers need checking against your actual
checkout rounding and discount rules. There is no Shopify integration.

I'd love to hear which parts of planning offers are hardest for you, and where
the explanations could be clearer. Please avoid posting private merchant data
in public comments.

## Three-image gallery

Use the unaltered browser captures in `docs/launch-assets/`:

1. `01-simple-demo.png` — first-screen workflow with the fictional demo, no upload needed.
2. `02-demo-comparison.png` — actual Current Plan versus Suggested Plan chart using fictional products. The QA workflow changes the storewide offer to 20%, goal to $20,000 and buffer to $500; these are demonstration inputs, not recommendations for a real merchant.
3. `03-advanced-demo.png` — actual Advanced Mode with the fictional products and model allocation visible; the QA workflow has applied its suggested plan and selected Optimize.

All three are 1440px-wide Chromium captures of the local production build, at
100% zoom. They contain only synthetic demo products. No chart values were
fabricated, composited or edited. Screenshot provenance and limitations are in
`launch-assets/README.md`. Review image crops/readability in Product Hunt before
publication; do not suggest that demo results predict merchant outcomes.

## Approved feedback contact

The owner confirms **miniventurelab@gmail.com** is owned, approved for public
display and able to receive email. It is configured in `config/feedback.json`.
Both top bars have a **Feedback** anchor to the stable `#help-feedback` section;
this keeps the current campaign on the page. The final **Send Feedback** action
in that section resolves to:

`mailto:miniventurelab@gmail.com?subject=MarginGuard%20beta%20feedback`

The subject is **MarginGuard beta feedback**. The existing `feedbackHref` helper
remains the single source of mailto construction, including fail-closed checks
for invalid/unconfigured addresses. The coming-soon placeholder is absent with
this approved configuration. Automated tests inspect the link without activating
an email client or sending mail.

**Owner action:** manually test the link in a configured email client and confirm
delivery. Production deployment and Product Hunt publication remain pending and
require separate owner approval.

## Launch-day checklist

- [ ] Owner manually tests the configured Send Feedback action and confirms email delivery.
- [ ] Review this Draft PR and screenshots; approve copy and model disclosures.
- [ ] Confirm production release baseline and explicitly approve merge/release separately. PR #11 legacy redirect work is a separate operation and is not required by this launch change.
- [ ] Run unit tests, production build and browser QA on the final reviewed commit.
- [ ] After an owner-approved release, smoke-test both modes, demo reset, product import, suggestions and CSV exports on https://marginguard.pages.dev/.
- [ ] Check help disclosures, feedback link, mobile layout and canonical/social metadata on production. Preview must remain noindex.
- [ ] Check Product Hunt's current listing requirements, topic availability and gallery rendering; submit the listing manually only after approval.
- [ ] Publish the maker comment and monitor public feedback without requesting private financial CSVs in public threads.

## Scope and limitations

This change adds onboarding wording, native Help disclosures and configurable
feedback only. No financial calculations, optimizer, CSV contracts, persistence,
analytics, backend, external scripts or Cloudflare configuration were changed.
Browser automation uses Chromium and local fictional fixtures; it does not prove
Safari/Firefox, assistive-technology or full WCAG compliance. Production and
Product Hunt publication remain manual release gates.

## Local verification evidence

- `npm test`: 263 tests across 15 files passed, including the new Help/feedback regression checks and original financial/fixture tests.
- `npm run build`: TypeScript and Vite production build passed.
- Chromium QA: 139 responsive layout/state checks at 320, 375, 390, 430, 768, 1024, 1440 and 1920px passed. Coverage includes both modes, native CSV import, failed-import rollback, recommendations, CSV exports/round-trip, demo reset at every width, Help disclosure keyboard activation and active mailto correctness (updated in Stage 4A.1).
- An additional 33 browser checks at 125%, 150% and 200% zoom passed (172 browser layout/state checks total).
- No runtime errors or external page requests were recorded by browser QA. Financial/model/CSV source, fixtures, public metadata, dependency files and Cloudflare configuration match main.
- Screenshots were inspected at desktop and mobile sizes; the three gallery captures use the fictional demo only.

These are local checks, not production smoke testing or comprehensive accessibility certification.

## Stage 4A.1 activation verification

The approved email is active in both modes. Mouse click and keyboard Enter on
the top-bar Feedback anchor reach and focus `#help-feedback`, with the financial
cards unchanged. Tab/Shift+Tab verifies the link's visible focus outline. The
139-state responsive suite covers eight widths including 320px, native FAQ
keyboard operation, demo reset, mode switching, recommendations and CSV import/
export. It recorded no runtime errors or external application requests.

Commands: `npm test`, `npm run build`, and
`CHROMIUM_NO_SANDBOX=1 npm run test:browser`. The Chromium no-sandbox flag is for
this disposable test container only. Additional existing zoom checks use
`BROWSER_ZOOM=1.25`, `1.5` and `2`. No separate lint script is configured;
TypeScript checking runs in the production build, and `node --check
scripts/browser-qa.mjs` plus `git diff --check` passed.

Original gallery PNGs and SHA-256 checksums are unchanged. Images 01 and 02 show
the older Simple top bar without Feedback; obtain owner approval to recapture
them before publication. Image 03's visible scrolled chart content remains
accurate. Email-client behavior/delivery and live production remain untested;
no real email was sent.
