# Signal Intelligence Lab

A public projection of Floyd S. Clark II's real, privately maintained role tracker and LinkedIn analytics. The [live page](https://floyd-clark.github.io/signal-intelligence/) uses no login or analytics endpoint. It is a static site.

## Source and window

- **Pipeline:** “Floyd Clark - Job Application Tracker - Sep 2026,” Active Roles tab, read September 26, 2026. It has 55 active records and 5 closed; 32 active records have an applied stage. The Signal Register identifies two separately confirmed applications missing from Active Roles. These are a reconciliation exception, excluded from the 55 and 32 until entered and deduplicated. Tracker stages are not verified employer decisions.
- **LinkedIn:** “AggregateAnalytics_Floyd Clark, MEng, PMP_2026-09-19_2026-09-25.xlsx,” covering September 19–25. The export reports 4,900 impressions, 3,033 members reached, 62 daily engagement actions, 40 new followers, and 1,162 total followers as of September 25. September 25 may be a partial day.
- **Projection:** `data/public-snapshot.json` contains only broad role families, stage buckets, last-touch age bands, evidence labels, and aggregate LinkedIn measurements. Aliases are assigned within this snapshot and are not permanent cross-version identifiers.
- **History:** `data/history/2026-09-25.json` freezes the previous public projection. `history` in the current file is an ordered manifest. A new refresh should first copy the preceding current snapshot into `data/history/YYYY-MM-DD.json`, then append exactly one manifest entry. Do not backfill a missing day as observed. The September 26 LinkedIn window is retained from the previous export and is not new LinkedIn activity.

## Charts and equations

The Signal hourglass places LinkedIn displays/reach/actions above a marked attribution gap and active/applied tracker records below it. Its bar widths are illustrative visual hierarchy, not cross-source conversion ratios. The role funnel shows six mutually exclusive active stages divided by 55 active records. They are stage composition, not sequential conversion rates.

Pipeline aging is based on last tracker touch, including owner actions. It is not application-to-recruiter response time. The two-point history compares stock counts, not cohort conversion. Sequential conversion, stage dwell, response latency, referral lift, and employment-class lift remain **insufficient evidence** until dated transitions and stable role identities are captured in the private layer. Do not divide the 32 applied records by 55 active records and call it an application conversion rate.

The seven-day sensitivity plot uses `E(t) = N × [1 − (1 − q)^t]`, where `N` is applied or referral-requested cohort size, `q` is a manually selected assumed daily response rate, and `t` is days after September 26. The three curves use half, equal, and twice that rate. This equation assumes a constant rate and independent daily opportunities; no response rate is estimated from LinkedIn or tracker history. It shows expected counts under assumptions, not calibrated event odds.

The 2032 plot uses `I(y) = 100 × (I2032 / 100)^((y − 2026) / 6)` for each midpoint of the rounded private-model endpoint bands. Only endpoints come from the private model; yearly values are an illustrative interpolation. The public page includes no organization-level pathways.

## Interpretation

Observed inputs (tracker stages, touches, and export values) are separate from derived counts. A tracker application is not an interview. Impressions are repeated displays; reached members are unique within LinkedIn's reported window; engagements count actions. Neither source supplies matched viewer-to-recruiter or viewer-to-application attribution. No conversion, causality, or calibrated probability is claimed.

## Forecasts and scenarios

The public forecast ledger is issued September 26 for September 27–October 3, 2026. Two testable events refer to direct responses in the applied and referral-requested cohorts. Supporting and counterevidence, verification rules, window, version, and pending outcomes are published in `data/public-snapshot.json`. Future outcome updates must retain the original target and window and cite a dated tracker event. The ledger does not infer responses from LinkedIn exposure.

The seven-day plot is an **assumption sensitivity**, not a learned probability or uncertainty interval. There is no calibrated applications-per-interview or time-to-offer estimate. Add these only after a closed historical cohort has stage transition dates, right-censoring rules, and enough outcomes to show its denominator and interval. The 2032 curves are interpolated scenario endpoints, not observed career progression.

The 2032 scenario lens uses the private 2032 Decision Model. It pools five broad paths, excludes the private company-level options, and rounds the lower, middle, and upper modeled index ranges to five points. The 2026 index is 100. Ranges describe scenario endpoints across paths, not statistical confidence intervals, offer odds, or dollar returns. Refresh the private assumptions before using this model for a decision.

Excluded from the public projection: organization names, exact role titles, requisition IDs, contacts, correspondence, private links, and raw notes. The original tracker and export remain private. The live site and its source are public; do not add protected data to GitHub Pages.

## Evidence integrity and private processing

`node scripts/validate.mjs` checks public totals, stage membership, snapshot chronology and basic privacy patterns. `node scripts/validate.test.mjs` exercises known failure modes: an unrelated technical evidence item attached to a hiring signal, an unexplained support/contradiction dual role, and stale event versions. `validate.mjs /path/to/private-graph.json` validates private graph IDs and provenance locally; never add that graph to this public repository. Use `scripts/evidence.mjs` for ordinal support and visible age-based decay. The labels are not conversion probabilities.

The private graph contract uses `events`, `evidence`, `signals`, `hypotheses`, and `forecasts` arrays with stable IDs. Events have `domain`, `entity`, and `version`; evidence has `eventId`, matching domain/entity, `source`, `observedAt`, and `eventVersion`. Signals cite evidence IDs in support and contradiction arrays and state an alternative and `expiresAt`. Hypotheses cite signal IDs and forecasts cite hypothesis IDs. Preserve raw source and normalized value in the private layer, with retrieval timestamp and transformation version. If an event changes, increment its version and explicitly revalidate attached evidence. A normal ATS rejection or recruiter rejection is an outcome; profile attention is ambiguous and expires quickly. Inaction alone is no hidden process.

Keep career direction at AI infrastructure systems leadership: accelerator validation through infrastructure integration, platform programs, then organizational leadership. Evaluate scope, technical fit, compensation, warm path, and pursuit cost independently; do not let a closed single-company path define the product. Official employer careers/ATS and direct human communication outrank social posts, which outrank aggregators. A role's public posting status and the person's application status are separate records. Reposts never inherit application or referral state without direct evidence.

The public GitHub Pages directory is world-readable, including files removed from the current tree but still present in Git history. This site contains no client-side access-control claim. Private correspondence, compensation, contact data, and unredacted tracker rows must remain in the private spreadsheet or another authenticated store. This repository does not implement daily ingestion or a private authenticated dashboard; snapshot refresh remains an explicit, reviewed operation.

Run locally with `python3 -m http.server 8000` from repository root and visit `http://localhost:8000/signal-intelligence/`. No build step.

Source is viewable for inspection. No open-source license or permission to redistribute substantial portions has been granted. Copyright © 2026 Floyd S. Clark II.
