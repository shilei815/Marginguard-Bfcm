# MarginGuard public beta launch kit

Status: **draft, blocked on an owner-approved public feedback address**. No launch
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

## Feedback configuration — launch blocker

No approved public contact email was found in the repository. The shared Help
section displays **Send Feedback — coming soon** with no clickable email address.
`config/feedback.json` deliberately contains `"publicEmail": null`.

The owner must provide an approved public mailbox, replace null with that address
in a reviewed change, then verify that both modes render a working mailto link
with subject `MarginGuard beta feedback`. `feedbackHref` rejects malformed and
reserved example/test addresses instead of emitting a fake contact link. This
is validation, not proof of mailbox ownership or deliverability. Do not use a
made-up address, private Git author address, or placeholder mailbox. Do not
publish while this blocker is unresolved.

The browser regression check currently expects no mailto while configuration is
null; update that expectation when activating the reviewed public address.

## Launch-day checklist

- [ ] Owner approves and verifies the feedback mailbox; resolve the blocker above.
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
- Chromium QA: 139 responsive layout/state checks at 320, 375, 390, 430, 768, 1024, 1440 and 1920px passed. Coverage includes both modes, native CSV import, failed-import rollback, recommendations, CSV exports/round-trip, demo reset at every width, Help disclosure keyboard activation and absent mailto while unconfigured.
- An additional 33 browser checks at 125%, 150% and 200% zoom passed (172 browser layout/state checks total).
- No runtime errors or external page requests were recorded by browser QA. Financial/model/CSV source, fixtures, public metadata, dependency files and Cloudflare configuration match main.
- Screenshots were inspected at desktop and mobile sizes; the three gallery captures use the fictional demo only.

These are local checks, not production smoke testing or comprehensive accessibility certification.
