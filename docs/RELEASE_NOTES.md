# Phase 2A release notes

- Simple Mode now opens by default with Upload Products → Set Discounts → Check Profit → Improve My Plan.
- Clear profit-after-variable-costs cards and plain-English risk statuses explain whether your goal and optional safety buffer are met. Fixed overhead and taxes are visibly excluded.
- Large warning lists are replaced by a compact, expandable summary grouped by issue, category, and product.
- Must-Promote products support independent exact, minimum, maximum, and non-guaranteed preferred discounts. Select multiple products for bulk rules or special offers, or upload a list.
- Improve My Plan offers deterministic, verified recommendations and a before/after comparison without assuming extra demand. Conflicting goals never produce an apply action.
- The simple chart shows the current-to-suggested adjustment path with explicit sales weighting and profit/break-even markers.
- Advanced Mode retains financial details, continuous objectives, editable allocation weights, stress assumptions, scenario snapshots, and the original cumulative chart. View switching preserves campaign inputs.
- New product uploads initialize an explained, editable goal from their own baseline; synthetic demo dollar floors no longer carry into merchant data.
- Financial engine, original CSV implementation, and all eight reference fixtures are unchanged. No Cloudflare setting, production branch, deployment, backend, or paid service is changed.

Limitations: browser visual/accessibility QA was unavailable; CSV field mapping, demand response, saved campaigns, and discrete checkout rounding remain outside this phase. See PHASE_2A.md for policy details and browser QA steps.
