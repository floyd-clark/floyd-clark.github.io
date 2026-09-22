# Signal Intelligence Lab

Static, GitHub Pages-compatible review build for a public-safe Service Health / decision-intelligence operating model.

## Review locally

From the repository root:

```powershell
node signal-intelligence/scripts/serve.mjs
```

Open `http://127.0.0.1:4173/signal-intelligence/`.

Do not open `index.html` directly from the filesystem; browsers block the page from fetching its local JSON dataset under `file://`.

## Data ownership

All visible content is loaded from `data/lab-data.json`. UI code does not contain operational claims. The source tracker is private; the checked-in review dataset contains only aggregates, stable organization aliases, generic role families, stage dates, evidence-quality flags, public-safe event summaries, and explicit forecast assumptions. It contains no private recruiter messages, contact details, requisition IDs, company names, notes, email/calendar bodies, or private URLs.

The starter CSV rows from the build packet were treated as schema examples only. They were not imported as facts.

Forecast replay inputs are frozen at `2026-09-19T16:38:00Z`, the maximum LinkedIn visibility snapshot in the tracker. Later events may appear only as outcomes or post-freeze evidence. Because this replay was constructed afterward, it must remain labeled retrospective and must not be presented as a prospectively recorded prediction.

The 2032 option map uses normalized indices and anonymized option labels derived from the private decision-model tab. Intermediate years are illustrative compound paths between a common 2026 baseline and the model's 2032 endpoints. They are not annual salary or net-worth forecasts.

## Access and analytics boundary

The in-page dialog sends each request to a Google Apps Script approval service. The service emails the owner an approval action and records requests and decisions in a private Google Sheet. The interface unlocks only after the service returns the owner’s recorded approval. The dialog discloses that the reviewer address, request ID, timestamp, and page URL leave the browser when a visitor requests access.

This still is not file-level authentication. GitHub Pages cannot prevent a determined visitor from directly requesting public static assets or forwarding the URL. Use Zscaler Private Access or another identity-aware hosting layer before treating the page or its data as confidential.

Analytics are intentionally disabled in this static review build. Consented events are retained only in browser `sessionStorage` and are not transmitted. Before enabling the dormant event endpoint, deploy behind real identity-aware access control and provide a consented privacy notice that describes the exact retained fields, purpose, retention period, and deletion process. Do not add fingerprinting, advertising cookies, cross-site tracking, or undisclosed telemetry.

## Add records safely

1. Add or update a source in `sources`.
2. Add an evidence object with a stable ID, classification, public description, and `safe_to_render` flag.
3. Add immutable observed events that reference the source/evidence.
4. Derive signals, indicators, forecasts, decisions, and outcomes in separate collections.
5. Never edit a forecast after its outcome is known; add a `forecast_outcomes` record instead.
6. Put rule or weight changes in a new `model_versions` object.
7. Run the validator before review.

## Validate

```powershell
node signal-intelligence/scripts/validate-data.mjs
```

The page also runs a smaller set of read-only validation checks in the browser and displays them under **Data-quality controls**.

## Evidence-state invariant

- **Observed**: direct evidence exists.
- **Derived**: calculated from observed records.
- **Forecast**: frozen forward-looking estimate.
- **Hypothesis**: interpretation that requires more evidence.

Model output must never silently become an observed fact.

## Publish checklist

- Replace or retain the current `noindex,nofollow` meta tag intentionally.
- Confirm every `safe_to_render: true` object is public-safe.
- Validate all source and evidence references.
- Confirm no private paths, names, messages, credentials, or tokens are present.
- Test keyboard navigation, small screens, and 200% text zoom.
- Put the page behind authenticated access before claiming approval-only review.
- Keep analytics disabled until the consent notice, endpoint, retention policy, and access controls are verified.
- Run `node signal-intelligence/scripts/validate-data.mjs`.
- Review the page from a web server, not `file://`.
