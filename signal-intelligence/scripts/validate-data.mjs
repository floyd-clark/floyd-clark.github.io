import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.resolve(scriptDirectory, "../data/lab-data.json");
const data = JSON.parse(await readFile(dataPath, "utf8"));
const errors = [];

const requiredCollections = [
  "sources", "evidence", "journeys", "events", "signals", "forecasts",
  "forecast_outcomes", "anomalies", "actions", "model_versions"
];

for (const collection of requiredCollections) {
  if (!Array.isArray(data[collection])) errors.push(`${collection} must be an array`);
}

const idFields = {
  sources: "source_id",
  evidence: "evidence_id",
  journeys: "journey_id",
  events: "event_id",
  signals: "signal_id",
  forecasts: "forecast_id",
  anomalies: "anomaly_id",
  actions: "action_id",
  model_versions: "model_version"
};

for (const [collection, field] of Object.entries(idFields)) {
  const seen = new Set();
  for (const item of data[collection] || []) {
    if (!item[field]) errors.push(`${collection} contains an item without ${field}`);
    if (seen.has(item[field])) errors.push(`${collection} contains duplicate ${field}: ${item[field]}`);
    seen.add(item[field]);
  }
}

const sourceIds = new Set(data.sources.map((source) => source.source_id));
for (const item of data.evidence) {
  if (!sourceIds.has(item.source_id)) errors.push(`${item.evidence_id} references missing source ${item.source_id}`);
  if (item.safe_to_render && !item.description_public) errors.push(`${item.evidence_id} is renderable but has no public description`);
  if (item.safe_to_render && item.confidentiality !== "public" && item.path_or_url) {
    errors.push(`${item.evidence_id} exposes a path/URL for non-public evidence`);
  }
}

const evidenceIds = new Set(data.evidence.map((item) => item.evidence_id));
for (const pattern of data.domain_patterns) {
  for (const id of pattern.evidence_ids) {
    if (!evidenceIds.has(id)) errors.push(`${pattern.domain} references missing evidence ${id}`);
  }
}

const allowedEvidenceStates = new Set(data.taxonomy.evidence_states);
for (const item of [...data.events, ...data.domain_patterns]) {
  if (item.evidence_state && !allowedEvidenceStates.has(item.evidence_state)) {
    errors.push(`Unsupported evidence state: ${item.evidence_state}`);
  }
}

const forecastIds = new Set(data.forecasts.map((forecast) => forecast.forecast_id));
for (const outcome of data.forecast_outcomes) {
  if (!forecastIds.has(outcome.forecast_id)) errors.push(`Outcome references missing forecast ${outcome.forecast_id}`);
}

for (const forecast of data.forecasts) {
  if (forecast.created_at !== data.meta.forecast_freeze_at) {
    errors.push(`${forecast.forecast_id} is not frozen at ${data.meta.forecast_freeze_at}`);
  }
}

for (const journey of data.journeys) {
  if (!/^Organization \d{2}$/.test(journey.organization_alias || "")) {
    errors.push(`${journey.journey_id} does not use a stable organization alias`);
  }
  for (const forbidden of ["company", "req_id", "contact", "url", "notes"]) {
    if (Object.hasOwn(journey, forbidden)) errors.push(`${journey.journey_id} exposes forbidden field ${forbidden}`);
  }
}

for (const event of data.events) {
  if (!event.safe_to_render || !event.summary_public) errors.push(`${event.event_id} is missing a public-safe event summary`);
  if (!evidenceIds.has(event.source_id)) errors.push(`${event.event_id} references missing evidence ${event.source_id}`);
}

if (errors.length) {
  console.error(`Data validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Data validation passed: ${data.evidence.length} evidence objects, ${data.events.length} observed events, ${data.forecasts.length} forecasts.`);
