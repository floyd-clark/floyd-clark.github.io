# Signal Intelligence Lab

A public projection of Floyd S. Clark II's real, privately maintained role tracker and LinkedIn analytics. The [live page](https://floyd-clark.github.io/signal-intelligence/) uses no login or analytics endpoint. It is a static site.

## Source and window

- **Pipeline:** “Floyd Clark - Job Application Tracker - Sep 2026,” Active Roles tab, updated September 25, 2026. The snapshot contains 55 active role records and 5 closed records. Of the active records, 32 are in an applied stage, including one with a pending role ID. Stage categories reflect the tracker, not verified employer decisions.
- **LinkedIn:** “AggregateAnalytics_Floyd Clark, MEng, PMP_2026-09-19_2026-09-25.xlsx,” covering September 19–25. The export reports 4,900 impressions, 3,033 members reached, 62 daily engagement actions, 40 new followers, and 1,162 total followers as of September 25. September 25 may be a partial day.
- **Projection:** `data/public-snapshot.json` contains only broad role families, stage buckets, last-touch age bands, evidence labels, and aggregate LinkedIn measurements. Aliases are assigned within this snapshot and are not permanent cross-version identifiers.

## Interpretation

Observed inputs (tracker stages, touches, and export values) are separate from derived counts. A tracker application is not an interview. Impressions are repeated displays; reached members are unique within LinkedIn's reported window; engagements count actions. Neither source supplies matched viewer-to-recruiter or viewer-to-application attribution. No conversion, causality, or calibrated forecast is claimed.

Excluded from the public projection: organization names, exact role titles, requisition IDs, contacts, correspondence, private links, and raw notes. The original tracker and export remain private. The live site and its source are public; do not add protected data to GitHub Pages.

Run locally with `python3 -m http.server 8000` from repository root and visit `http://localhost:8000/signal-intelligence/`. No build step.

Source is viewable for inspection. No open-source license or permission to redistribute substantial portions has been granted. Copyright © 2026 Floyd S. Clark II.
