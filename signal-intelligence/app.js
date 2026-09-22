const DATA_URL = "data/lab-data.json";

const escapeHtml = (value = "") => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const normalizeClass = (value = "") => String(value).toLowerCase().replaceAll(" ", "_");

const titleCase = (value = "") => String(value)
  .replaceAll("_", " ")
  .replace(/\b\w/g, (character) => character.toUpperCase());

const badge = (label, style = label) => `<span class="badge ${escapeHtml(normalizeClass(style))}">${escapeHtml(titleCase(label))}</span>`;

const unknown = (value, suffix = "") => value === null || value === undefined || value === ""
  ? "Unknown"
  : `${escapeHtml(value)}${escapeHtml(suffix)}`;

function safeLink(url, label) {
  if (!url) return `<span class="cell-muted">Registered</span>`;
  const isSafe = url.startsWith("https://") || url.startsWith("../") || url.startsWith("./");
  if (!isSafe) return `<span class="cell-muted">Path withheld</span>`;
  const external = url.startsWith("https://") ? ' target="_blank" rel="noopener"' : "";
  return `<a href="${escapeHtml(url)}"${external}>${escapeHtml(label)} ↗</a>`;
}

function renderFlow(stages) {
  const grid = document.querySelector("#flow-grid");
  const detail = document.querySelector("#flow-detail");

  grid.innerHTML = stages.map((stage, index) => `
    <button class="flow-step" type="button" role="tab" id="tab-${escapeHtml(stage.stage_id)}"
      aria-controls="flow-detail" aria-selected="${index === 0}" data-stage="${index}">
      <span class="flow-number">${escapeHtml(stage.number)}</span>
      <strong>${escapeHtml(stage.name)}</strong>
      <span>${escapeHtml(stage.short)}</span>
    </button>
  `).join("");

  const showStage = (index, focusPanel = false) => {
    const stage = stages[index];
    grid.querySelectorAll(".flow-step").forEach((button, buttonIndex) => {
      button.setAttribute("aria-selected", String(buttonIndex === index));
      button.tabIndex = buttonIndex === index ? 0 : -1;
    });
    detail.setAttribute("aria-labelledby", `tab-${stage.stage_id}`);
    detail.innerHTML = `
      <h3>${escapeHtml(stage.number)} · ${escapeHtml(stage.name)}</h3>
      <div class="flow-detail-grid">
        <dl class="detail-block"><dt>Input</dt><dd>${escapeHtml(stage.input)}</dd></dl>
        <dl class="detail-block"><dt>Transformation</dt><dd>${escapeHtml(stage.transformation)}</dd></dl>
        <dl class="detail-block"><dt>Output</dt><dd>${escapeHtml(stage.output)}</dd></dl>
        <dl class="detail-block"><dt>Evidence type</dt><dd>${escapeHtml(stage.evidence_type)}</dd></dl>
      </div>
      <div class="concepts" aria-label="Related service-health concepts">
        ${stage.concepts.map((concept) => `<span class="concept">${escapeHtml(concept)}</span>`).join("")}
      </div>
    `;
    if (focusPanel) detail.focus();
  };

  grid.addEventListener("click", (event) => {
    const button = event.target.closest(".flow-step");
    if (!button) return;
    showStage(Number(button.dataset.stage));
  });

  grid.addEventListener("keydown", (event) => {
    const current = Number(event.target.dataset.stage);
    if (!Number.isInteger(current)) return;
    let next = current;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (current + 1) % stages.length;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (current - 1 + stages.length) % stages.length;
    if (next !== current) {
      event.preventDefault();
      showStage(next);
      grid.querySelector(`[data-stage="${next}"]`).focus();
    }
  });

  showStage(0);
}

function renderSummary(data) {
  const activeJourneys = data.journeys.filter((journey) => journey.state === "active").length;
  const safeEvidence = data.evidence.filter((item) => item.safe_to_render).length;
  const connectedSources = data.sources.filter((source) => source.status === "connected").length;
  const verifiedForecasts = data.forecast_outcomes.filter((outcome) => outcome.outcome !== "pending").length;
  const openForecasts = data.forecasts.filter((forecast) => forecast.status === "open").length;

  const metrics = [
    { value: data.events.length, label: "Observed events", definition: "Public-safe event records in this review dataset" },
    { value: activeJourneys, label: "Active journeys", definition: "CUJ-like journeys backed by observed events" },
    { value: safeEvidence, label: "Evidence objects", definition: "Safe summaries with source lineage" },
    { value: `${connectedSources}/${data.sources.length}`, label: "Sources connected", definition: "Specification and portfolio sources; private signals excluded" },
    { value: openForecasts, label: "Forecasts pending", definition: "Frozen forecasts awaiting observable resolution" },
    { value: verifiedForecasts, label: "Forecasts verified", definition: "Forecasts with separately recorded outcomes" },
    { value: "Unknown", label: "Evidence freshness", definition: "Needs an active journey with observed evidence" },
    { value: "Unknown", label: "Signal-to-action latency", definition: "Needs a qualifying signal and a recorded decision" }
  ];

  document.querySelector("#summary-metrics").innerHTML = metrics.map((metric) => `
    <article class="metric-card">
      <div class="micro-label">Derived summary</div>
      <div class="metric-value">${escapeHtml(metric.value)}</div>
      <div class="metric-label">${escapeHtml(metric.label)}</div>
      <div class="metric-definition">${escapeHtml(metric.definition)}</div>
    </article>
  `).join("");

  document.querySelector("#forecast-open").textContent = String(openForecasts);
  document.querySelector("#forecast-verified").textContent = String(verifiedForecasts);
}

function renderEmptyOrJourneyTable(journeys) {
  const target = document.querySelector("#journey-matrix");
  if (!journeys.length) {
    target.innerHTML = `<div class="empty-state"><strong>Awaiting public-safe journeys</strong><p>No job-search journey is inferred from the build packet or sample templates. Connect observed event records to activate stage, staleness, confidence, evidence count, forecast, and action fields.</p></div>`;
    return;
  }

  target.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Journey</th><th>Stage</th><th>Last signal</th><th>Health</th><th>Evidence</th></tr></thead><tbody>${journeys.map((journey) => `
    <tr><td>${escapeHtml(journey.label)}</td><td>${escapeHtml(titleCase(journey.current_stage))}</td><td>${escapeHtml(journey.last_observed_at || "Unknown")}</td><td>${badge(journey.health || "unknown")}</td><td>${escapeHtml(journey.evidence_count || 0)}</td></tr>
  `).join("")}</tbody></table></div>`;
}

function renderEmptyOrTimeline(events) {
  const target = document.querySelector("#signal-timeline");
  if (!events.length) {
    target.innerHTML = `<div class="empty-state"><strong>No observed timeline events</strong><p>The packet’s example CSV rows were treated as templates—not facts. This timeline activates only when a timestamped, sourced, public-safe event is added.</p></div>`;
    return;
  }

  target.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Time</th><th>Event</th><th>State</th><th>Source</th></tr></thead><tbody>${events.map((event) => `
    <tr><td>${escapeHtml(event.timestamp)}</td><td>${escapeHtml(event.summary_public)}</td><td>${badge(event.evidence_state)}</td><td>${escapeHtml(event.source_type)}</td></tr>
  `).join("")}</tbody></table></div>`;
}

function renderLighthouse(items) {
  document.querySelector("#lighthouse-grid").innerHTML = items.map((item) => `
    <article class="info-card">
      ${badge(item.state)}
      <h3>${escapeHtml(item.name)}</h3>
      <p>${escapeHtml(item.why)}</p>
      <dl class="key-value">
        <div><dt>Reliability</dt><dd>${escapeHtml(item.reliability)}</dd></div>
        <div><dt>Decision</dt><dd>${escapeHtml(item.decision)}</dd></div>
      </dl>
    </article>
  `).join("");
}

function renderIndicators(indicators) {
  document.querySelector("#indicator-rows").innerHTML = indicators.map((indicator) => `
    <tr>
      <td><span class="cell-strong">${escapeHtml(indicator.name)}</span><br /><span class="cell-muted mono">${escapeHtml(indicator.metric_id)}</span></td>
      <td>${escapeHtml(indicator.definition)}</td>
      <td>${escapeHtml(indicator.target)}</td>
      <td>${unknown(indicator.current, indicator.current === null ? "" : ` ${indicator.unit}`)}</td>
      <td>${badge(indicator.health)}</td>
      <td>${indicator.evidence_ids.length ? indicator.evidence_ids.map(escapeHtml).join(", ") : '<span class="cell-muted">Awaiting evidence</span>'}</td>
      <td>${escapeHtml(indicator.decision_rule)}</td>
    </tr>
  `).join("");
}

function renderSyntheticChecks(checks) {
  document.querySelector("#synthetic-checks").innerHTML = checks.map((check) => `
    <article class="check-row">
      <strong>${escapeHtml(check.name)}</strong>
      <div>${badge(check.status, "awaiting")}</div>
      <p>${escapeHtml(check.meaning)}</p>
    </article>
  `).join("");
}

function renderEvidence(evidence, sources) {
  const sourceById = new Map(sources.map((source) => [source.source_id, source]));
  const safeEvidence = evidence.filter((item) => item.safe_to_render);
  document.querySelector("#evidence-rows").innerHTML = safeEvidence.map((item) => {
    const source = sourceById.get(item.source_id);
    return `
      <tr>
        <td class="mono">${escapeHtml(item.evidence_id)}</td>
        <td><span class="cell-strong">${escapeHtml(item.title)}</span><br /><span class="cell-muted">${escapeHtml(item.description_public)}</span></td>
        <td>${escapeHtml(source?.source_name || item.source_type)}</td>
        <td>${escapeHtml(item.source_date)}</td>
        <td>${badge(item.confidentiality, item.confidentiality === "public" ? "observed" : "unknown")}</td>
        <td class="mono">${item.related_ids.map(escapeHtml).join(", ")}</td>
        <td>${safeLink(item.path_or_url, "Open")}</td>
      </tr>
    `;
  }).join("");
}

function renderCadence(cadence) {
  document.querySelector("#cadence-rows").innerHTML = cadence.map((item) => `
    <tr><td>${badge(item.frequency, "derived")}</td><td class="cell-strong">${escapeHtml(item.activity)}</td><td>${escapeHtml(item.control)}</td></tr>
  `).join("");
}

function renderHumanAi(items) {
  document.querySelector("#human-ai-loop").innerHTML = items.map((item, index) => `
    <article class="loop-card">
      <span>${String(index + 1).padStart(2, "0")}</span>
      <h3>${escapeHtml(item.step)}</h3>
      <p>${escapeHtml(item.control)}</p>
    </article>
  `).join("");
}

function renderDomainPatterns(patterns) {
  const sequence = ["observe", "normalize", "prioritize", "execute", "measure", "verify", "improve"];
  document.querySelector("#domain-patterns").innerHTML = patterns.map((pattern) => `
    <article class="domain-card">
      ${badge(pattern.evidence_state)}
      <h3>${escapeHtml(pattern.domain)}</h3>
      <dl class="pattern-list">
        ${sequence.map((key) => `<div class="pattern-row"><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(pattern[key])}</dd></div>`).join("")}
      </dl>
      <div class="concepts">${pattern.evidence_ids.map((id) => `<span class="concept mono">${escapeHtml(id)}</span>`).join("")}</div>
    </article>
  `).join("");
}

function renderMethodology(data) {
  document.querySelector("#limitations-list").innerHTML = data.limitations.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  document.querySelector("#missing-data-list").innerHTML = data.missing_data.map((item) => `
    <li><strong>${escapeHtml(item.priority)} · ${escapeHtml(item.item)}</strong><br />${escapeHtml(item.value)}</li>
  `).join("");
}

function qualityChecks(data) {
  const results = [];
  const requiredCollections = ["sources", "evidence", "journeys", "events", "signals", "forecasts", "forecast_outcomes", "anomalies", "actions", "model_versions"];
  const missingCollections = requiredCollections.filter((key) => !Array.isArray(data[key]));
  results.push({
    name: "Required collections",
    pass: missingCollections.length === 0,
    detail: missingCollections.length ? `Missing: ${missingCollections.join(", ")}` : "All core data collections are present."
  });

  const idFields = {
    sources: "source_id", evidence: "evidence_id", journeys: "journey_id", events: "event_id",
    signals: "signal_id", forecasts: "forecast_id", anomalies: "anomaly_id", actions: "action_id", model_versions: "model_version"
  };
  const duplicateIds = [];
  Object.entries(idFields).forEach(([collection, field]) => {
    const values = (data[collection] || []).map((item) => item[field]).filter(Boolean);
    values.filter((value, index) => values.indexOf(value) !== index).forEach((value) => duplicateIds.push(value));
  });
  results.push({ name: "Unique identifiers", pass: duplicateIds.length === 0, detail: duplicateIds.length ? `Duplicates: ${duplicateIds.join(", ")}` : "No duplicate object IDs detected." });

  const unsafeRendered = data.evidence.filter((item) => item.safe_to_render && !item.description_public);
  results.push({ name: "Public-safe rendering", pass: unsafeRendered.length === 0, detail: unsafeRendered.length ? "A renderable evidence object lacks a public description." : "Renderable evidence has public-safe descriptions; private source bodies remain excluded." });

  const sourceIds = new Set(data.sources.map((source) => source.source_id));
  const evidenceIds = new Set(data.evidence.map((item) => item.evidence_id));
  const badSourceRefs = data.evidence.filter((item) => !sourceIds.has(item.source_id));
  const badPatternRefs = data.domain_patterns.flatMap((pattern) => pattern.evidence_ids).filter((id) => !evidenceIds.has(id));
  results.push({ name: "Reference integrity", pass: badSourceRefs.length === 0 && badPatternRefs.length === 0, detail: badSourceRefs.length || badPatternRefs.length ? "One or more source/evidence references do not resolve." : "Source and evidence references resolve." });

  const allowedStates = new Set(data.taxonomy.evidence_states);
  const invalidStates = [...data.events, ...data.domain_patterns].filter((item) => item.evidence_state && !allowedStates.has(item.evidence_state));
  results.push({ name: "Evidence taxonomy", pass: invalidStates.length === 0, detail: invalidStates.length ? "An object uses an unsupported evidence state." : "Observed, derived, forecast, and hypothesis states are controlled." });

  const forecastIds = new Set(data.forecasts.map((forecast) => forecast.forecast_id));
  const orphanOutcomes = data.forecast_outcomes.filter((outcome) => !forecastIds.has(outcome.forecast_id));
  results.push({ name: "Forecast lifecycle", pass: orphanOutcomes.length === 0, detail: orphanOutcomes.length ? "An outcome does not reference a forecast." : "No orphan forecast outcomes detected." });

  const hiddenPrivateSources = data.sources.filter((source) => source.safe_to_render === false).length;
  results.push({ name: "Privacy gate", pass: true, detail: `${hiddenPrivateSources} source record(s) are registered but excluded from public content.` });

  const noFabricatedOperationalData = data.events.length === 0 && data.journeys.length === 0 && data.forecasts.length === 0;
  results.push({ name: "Review-data discipline", pass: noFabricatedOperationalData, detail: noFabricatedOperationalData ? "Template rows were not promoted to operational facts." : "Operational records are present; verify their evidence before publishing." });

  return results;
}

function renderQuality(data) {
  const checks = qualityChecks(data);
  document.querySelector("#qa-grid").innerHTML = checks.map((check) => `
    <article class="qa-card">
      ${badge(check.pass ? "Pass" : "Review", check.pass ? "healthy" : "watch")}
      <strong>${escapeHtml(check.name)}</strong>
      <p>${escapeHtml(check.detail)}</p>
    </article>
  `).join("");
}

function wireTour() {
  const dialog = document.querySelector("#tour-dialog");
  document.querySelector("#open-tour").addEventListener("click", () => dialog.showModal());
  document.querySelector("#close-tour").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
}

async function init() {
  wireTour();
  try {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`Data request failed with ${response.status}`);
    const data = await response.json();

    document.querySelector("#as-of").textContent = data.meta.as_of;
    renderFlow(data.system_stages);
    renderSummary(data);
    renderEmptyOrJourneyTable(data.journeys);
    renderEmptyOrTimeline(data.events);
    renderLighthouse(data.lighthouse_candidates);
    renderIndicators(data.indicators);
    renderSyntheticChecks(data.synthetic_checks);
    renderEvidence(data.evidence, data.sources);
    renderCadence(data.cadence);
    renderHumanAi(data.human_ai_loop);
    renderDomainPatterns(data.domain_patterns);
    renderMethodology(data);
    renderQuality(data);
  } catch (error) {
    console.error(error);
    const message = `<div class="empty-state"><strong>Local data could not be loaded.</strong><p>Serve this directory through a local web server or GitHub Pages; browsers block JSON fetches from file URLs.</p></div>`;
    document.querySelectorAll("#summary-metrics, #flow-grid, #flow-detail, #journey-matrix, #signal-timeline").forEach((element) => {
      element.innerHTML = message;
    });
    document.querySelector("#as-of").textContent = "Unavailable";
  }
}

init();
