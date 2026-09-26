# Signal Intelligence Lab

A public, inspectable demonstration by Floyd S. Clark II. It illustrates an evidence-to-decision loop: observe, qualify, decide, verify. [Open the page](https://floyd-clark.github.io/signal-intelligence/).

## Run locally

From the repository root, run `python3 -m http.server 8000` and open `http://localhost:8000/signal-intelligence/`. No build step or account is required.

## Structure

- `index.html`: accessible page structure and project explanation.
- `styles.css`: responsive presentation.
- `app.js`: sample explorer; fetched content is inserted as text, not HTML.
- `data/examples.json`: three entirely synthetic examples.

Each example has an ID, evidence record and timestamp, supporting and competing evidence, a decision, a next check, and a condition for revising the conclusion. `state` distinguishes observation from interpretation or forecast. The scenarios are illustrative; the labels are not calibrated probabilities.

## Adapt the method

Replace the synthetic JSON with your own **public-safe** examples while retaining source IDs, observation times, contradictory evidence, decision rules, and outcome checks. Do not place secrets, private records, or customer telemetry in a public static site. GitHub Pages publishes files directly; browser-side dialogs cannot secure them.

The source is available to inspect and discuss. No open-source license has been granted for reuse or redistribution. Copyright © 2026 Floyd S. Clark II; contact the author for permission before copying substantial portions. Issues and suggestions about the method are welcome.
