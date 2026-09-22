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

All visible content is loaded from `data/lab-data.json`. UI code does not contain operational claims. The review dataset intentionally contains no private recruiter messages, contact details, interview content, email/calendar records, or fabricated journey events.

The starter CSV rows from the build packet were treated as schema examples only. They were not imported as facts.

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
- Run `node signal-intelligence/scripts/validate-data.mjs`.
- Review the page from a web server, not `file://`.
