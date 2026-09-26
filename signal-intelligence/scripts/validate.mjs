import fs from 'node:fs';
import path from 'node:path';

const root = new URL('../', import.meta.url);
const data = JSON.parse(fs.readFileSync(new URL('../data/public-snapshot.json', import.meta.url)));
const errors = [];
const fail = message => errors.push(message);
const sum = obj => Object.values(obj).reduce((n, v) => n + v, 0);
const counts = {};
for (const role of data.pipeline.journeys) counts[role.stage] = (counts[role.stage] || 0) + 1;
if (data.pipeline.journeys.length !== data.pipeline.active) fail('Active journey count differs from active total');
if (sum(data.pipeline.stages) !== data.pipeline.active) fail('Stage counts differ from active total');
for (const [stage, count] of Object.entries(data.pipeline.stages)) if ((counts[stage] || 0) !== count) fail(`Stage mismatch: ${stage}`);
if (data.pipeline.confirmedApplications !== data.pipeline.stages.Applied) fail('Applied subset differs from applied stage');
if (new Set(data.pipeline.journeys.map(r => r.id)).size !== data.pipeline.journeys.length) fail('Duplicate public aliases');
if (data.history.at(-1)?.date !== data.meta.asOf) fail('Latest history entry differs from snapshot date');
for (let i = 1; i < data.history.length; i++) if (data.history[i].date <= data.history[i-1].date) fail('History must be append-only and ordered');
for (const item of data.history.slice(0, -1)) {
  const file = path.resolve(root.pathname, item.path);
  if (!fs.existsSync(file)) { fail(`Missing historical snapshot: ${item.date}`); continue; }
  const prior = JSON.parse(fs.readFileSync(file));
  if (prior.meta.asOf !== item.date || prior.pipeline.active !== item.active || prior.pipeline.closed !== item.closed) fail(`Historical manifest mismatch: ${item.date}`);
}
const publicText = JSON.stringify(data);
for (const role of data.pipeline.journeys) for (const key of Object.keys(role)) if (!['id','family','stage','lastTouch','evidence'].includes(key)) fail(`Unexpected public journey field ${key}`);
for (const item of data.history.slice(0, -1)) {
  if (item.path && fs.existsSync(path.resolve(root.pathname, item.path))) {
    const previousText = fs.readFileSync(path.resolve(root.pathname, item.path), 'utf8');
    if (/mail\.google\.com|linkedin\.com\/in\/|[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(previousText)) fail(`Private identifier in historical snapshot ${item.date}`);
  }
}
for (const [label, pattern] of Object.entries({email:/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i, privateLink:/mail\.google\.com|linkedin\.com\/in\/|\b(?:ghp_|sk-)[A-Za-z0-9]{12}/i})) {
  if (pattern.test(publicText)) fail(`Public snapshot contains ${label}`);
}

// This graph is private by design. Validate a supplied file without copying it into public/data.
export function validateEvidenceGraph(graph) {
  const issues = [];
  const kinds = ['events', 'evidence', 'signals', 'hypotheses', 'forecasts'];
  const maps = Object.fromEntries(kinds.map(kind => [kind, new Map((graph[kind] || []).map(x => [x.id, x]))]));
  for (const kind of kinds) if (maps[kind].size !== (graph[kind] || []).length) issues.push(`Duplicate ${kind} ID`);
  for (const evidence of graph.evidence || []) {
    const event = maps.events.get(evidence.eventId);
    if (!event) issues.push(`${evidence.id}: missing event ${evidence.eventId}`);
    else if (event.domain !== evidence.domain || (event.entity && evidence.entity && event.entity !== evidence.entity)) issues.push(`${evidence.id}: event domain/entity mismatch`);
    if (!evidence.source || !evidence.observedAt) issues.push(`${evidence.id}: missing provenance`);
  }
  for (const signal of graph.signals || []) {
    const support = signal.supportingEvidenceIds || [], against = signal.contradictingEvidenceIds || [];
    for (const id of [...support, ...against]) {
      const evidence = maps.evidence.get(id);
      if (!evidence) issues.push(`${signal.id}: missing evidence ${id}`);
      else if (evidence.domain !== signal.domain || (signal.entity && evidence.entity && signal.entity !== evidence.entity)) issues.push(`${signal.id}: unrelated evidence ${id}`);
      else if (evidence.eventVersion && maps.events.get(evidence.eventId)?.version !== evidence.eventVersion) issues.push(`${signal.id}: stale event version ${id}`);
    }
    for (const id of support.filter(id => against.includes(id))) if (!signal.dualRoleExplanation) issues.push(`${signal.id}: unexplained dual-role evidence ${id}`);
    if (!signal.alternativeExplanation || !signal.expiresAt) issues.push(`${signal.id}: missing alternative or decay rule`);
  }
  for (const hypothesis of graph.hypotheses || []) for (const id of hypothesis.signalIds || []) if (!maps.signals.has(id)) issues.push(`${hypothesis.id}: missing signal ${id}`);
  for (const forecast of graph.forecasts || []) for (const id of forecast.hypothesisIds || []) if (!maps.hypotheses.has(id)) issues.push(`${forecast.id}: missing hypothesis ${id}`);
  return issues;
}
if (process.argv[2]) errors.push(...validateEvidenceGraph(JSON.parse(fs.readFileSync(process.argv[2]))));
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log(`Validated ${data.pipeline.active} public journeys, ${data.history.length} snapshots, and evidence links.`);
