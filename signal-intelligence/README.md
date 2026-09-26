# Signal Intelligence Lab

A public projection of Floyd S. Clark II's real, privately maintained role tracker and LinkedIn analytics. The [live page](https://floyd-clark.github.io/signal-intelligence/) uses no login or analytics endpoint. It is a static site.

## Source and window

- **Pipeline:** “Floyd Clark - Job Application Tracker - Sep 2026,” Active Roles tab, updated September 25, 2026. The snapshot contains 55 active role records and 5 closed records. Of the active records, 32 are in an applied stage, including one with a pending role ID. Stage categories reflect the tracker, not verified employer decisions.
- **LinkedIn:** “AggregateAnalytics_Floyd Clark, MEng, PMP_2026-09-19_2026-09-25.xlsx,” covering September 19–25. The export reports 4,900 impressions, 3,033 members reached, 62 daily engagement actions, 40 new followers, and 1,162 total followers as of September 25. September 25 may be a partial day.
- **Projection:** `data/public-snapshot.json` contains only broad role families, stage buckets, last-touch age bands, evidence labels, and aggregate LinkedIn measurements. Aliases are assigned within this snapshot and are not permanent cross-version identifiers.

## Charts and equations

The Signal hourglass places LinkedIn displays/reach/actions above a marked attribution gap and active/applied tracker records below it. Its bar widths are illustrative visual hierarchy, not cross-source conversion ratios. The role funnel shows six mutually exclusive active stages divided by 55 active records. They are stage composition, not sequential conversion rates.

The seven-day sensitivity plot uses `E(t) = N × [1 − (1 − q)^t]`, where `N` is applied or referral-requested cohort size, `q` is a manually selected assumed daily response rate, and `t` is days after September 26. The three curves use half, equal, and twice that rate. This equation assumes a constant rate and independent daily opportunities; no response rate is estimated from LinkedIn or tracker history. It shows expected counts under assumptions, not calibrated event odds.

The 2032 plot uses `I(y) = 100 × (I2032 / 100)^((y − 2026) / 6)` for each midpoint of the rounded private-model endpoint bands. Only endpoints come from the private model; yearly values are an illustrative interpolation. The public page includes no organization-level pathways.

## Interpretation

Observed inputs (tracker stages, touches, and export values) are separate from derived counts. A tracker application is not an interview. Impressions are repeated displays; reached members are unique within LinkedIn's reported window; engagements count actions. Neither source supplies matched viewer-to-recruiter or viewer-to-application attribution. No conversion, causality, or calibrated probability is claimed.

## Forecasts and scenarios

The public forecast ledger is issued September 26 for September 27–October 3, 2026. Two testable events refer to direct responses in the applied and referral-requested cohorts. Supporting and counterevidence, verification rules, window, version, and pending outcomes are published in `data/public-snapshot.json`. Future outcome updates must retain the original target and window and cite a dated tracker event. The ledger does not infer responses from LinkedIn exposure.

The 2032 scenario lens uses the private 2032 Decision Model. It pools five broad paths, excludes the private company-level options, and rounds the lower, middle, and upper modeled index ranges to five points. The 2026 index is 100. Ranges describe scenario endpoints across paths, not statistical confidence intervals, offer odds, or dollar returns. Refresh the private assumptions before using this model for a decision.

Excluded from the public projection: organization names, exact role titles, requisition IDs, contacts, correspondence, private links, and raw notes. The original tracker and export remain private. The live site and its source are public; do not add protected data to GitHub Pages.

Run locally with `python3 -m http.server 8000` from repository root and visit `http://localhost:8000/signal-intelligence/`. No build step.

Source is viewable for inspection. No open-source license or permission to redistribute substantial portions has been granted. Copyright © 2026 Floyd S. Clark II.
