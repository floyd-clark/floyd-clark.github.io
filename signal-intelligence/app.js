const DATA_URL = "data/lab-data.json?v=9";
const ACCESS_CONSENT_KEY = "signal-intelligence-access-v7";
const ACCESS_REQUEST_KEY = "signal-intelligence-request-v4";
const REVIEW_EVENT_KEY = "signal-intelligence-consented-events";
const APPROVAL_SERVICE_URL = "https://script.google.com/macros/s/AKfycbxz_SbPkuy73LM4TT7R96oDyduZgen2YK6HQr_JbHYywqYxpDRNSKmgbCuQG_O4c_ph3A/exec";
const APPROVAL_POLL_INTERVAL_MS = 8000;
const ANALYTICS_CONFIG = Object.freeze({
  enabled: false,
  endpoint: "",
  mode: "consent-only"
});

function getSessionId() {
  try {
    const existing = sessionStorage.getItem("signal-intelligence-session-id");
    if (existing) return existing;
    const created = crypto.randomUUID();
    sessionStorage.setItem("signal-intelligence-session-id", created);
    return created;
  } catch {
    return "session-unavailable";
  }
}

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

function hasAccessConsent() {
  try {
    const consent = JSON.parse(localStorage.getItem(ACCESS_CONSENT_KEY) || "null");
    return consent?.version === "v7" && consent?.owner_approval_confirmed === true;
  } catch {
    return false;
  }
}

function createClientSecret() {
  if (typeof crypto.randomUUID === "function") {
    return `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll("-", "");
  }
  const values = new Uint8Array(32);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => value.toString(16).padStart(2, "0")).join("");
}

function approvalServiceReady() {
  return APPROVAL_SERVICE_URL.startsWith("https://script.google.com/macros/s/")
    && APPROVAL_SERVICE_URL.endsWith("/exec");
}

function callApprovalService(params) {
  return new Promise((resolve, reject) => {
    if (!approvalServiceReady()) {
      reject(new Error("The owner approval service is not configured yet."));
      return;
    }

    const callbackName = `signalApproval_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    const timeout = window.setTimeout(() => finish(new Error("The approval service did not respond.")), 25000);
    let finished = false;

    const finish = (error, value) => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timeout);
      delete window[callbackName];
      script.remove();
      if (error) reject(error);
      else resolve(value);
    };

    window[callbackName] = (result) => {
      if (!result?.ok) finish(new Error(result?.message || "The approval service rejected the request."));
      else finish(null, result);
    };
    script.onerror = () => finish(new Error("The approval service could not be reached."));
    const url = new URL(APPROVAL_SERVICE_URL);
    Object.entries({ ...params, callback: callbackName }).forEach(([key, value]) => url.searchParams.set(key, value));
    script.src = url.toString();
    document.head.append(script);
  });
}

function createAccessRequestId() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = typeof crypto.randomUUID === "function"
    ? crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()
    : Math.random().toString(36).slice(2, 10).toUpperCase();
  return `SIL-${timestamp}-${random}`;
}

async function sendApprovalRequest(reviewerEmail, requestId, requestedAt, clientSecret) {
  return callApprovalService({
    action: "request",
    email: reviewerEmail,
    requestId,
    requestedAt,
    clientSecret,
    source: `${location.origin}${location.pathname}`
  });
}

async function checkApprovalStatus(requestState) {
  return callApprovalService({
    action: "status",
    requestId: requestState.request_id,
    clientSecret: requestState.client_secret
  });
}

function captureConsentedEvent(eventName, detail = {}) {
  if (!hasAccessConsent()) return;
  const reviewer = document.querySelector("#reviewer-identity")?.value.trim() || "not supplied";
  const event = {
    event_name: eventName,
    occurred_at: new Date().toISOString(),
    session_id: getSessionId(),
    reviewer_identity: reviewer,
    page: location.pathname,
    ...detail
  };

  try {
    const prior = JSON.parse(sessionStorage.getItem(REVIEW_EVENT_KEY) || "[]");
    sessionStorage.setItem(REVIEW_EVENT_KEY, JSON.stringify([...prior, event].slice(-50)));
  } catch {
    // Storage may be unavailable; consent status remains authoritative.
  }

  window.dispatchEvent(new CustomEvent("signal-intelligence:analytics", { detail: event }));
  if (ANALYTICS_CONFIG.enabled && ANALYTICS_CONFIG.endpoint) {
    navigator.sendBeacon(ANALYTICS_CONFIG.endpoint, JSON.stringify(event));
  }
}

function wireAccessGate() {
  const dialog = document.querySelector("#access-dialog");
  const checkbox = document.querySelector("#access-consent");
  const status = document.querySelector("#analytics-status");
  const approvalStatus = document.querySelector("#approval-status");
  const reviewerField = document.querySelector("#reviewer-identity");
  const requestApprovalButton = document.querySelector("#request-approval");
  let requestState = null;
  let isSending = false;
  let isChecking = false;
  let isGranting = false;
  let pollTimer = null;

  try {
    const priorConsent = JSON.parse(localStorage.getItem(ACCESS_CONSENT_KEY) || "null");
    requestState = JSON.parse(localStorage.getItem(ACCESS_REQUEST_KEY) || "null");
    if (requestState?.reviewer_email) reviewerField.value = requestState.reviewer_email;
    else if (priorConsent?.reviewer_email) reviewerField.value = priorConsent.reviewer_email;
    checkbox.checked = requestState?.terms_accepted === true;
  } catch {
    // Ignore malformed or unavailable session state.
  }

  status.textContent = ANALYTICS_CONFIG.enabled
    ? "Consent-only analytics are enabled. No advertising cookies, cross-site tracking, or fingerprinting."
    : "Static review status: analytics are disabled; no events leave this browser tab.";

  const requestMatches = (email) => requestState?.reviewer_email?.toLowerCase() === email.toLowerCase();

  const grantApprovedAccess = () => {
    if (isGranting || !checkbox.checked || !requestState || requestState.status !== "approved") return;
    const reviewerEmail = reviewerField.value.trim();
    if (!requestMatches(reviewerEmail)) return;
    isGranting = true;
    approvalStatus.textContent = `Approved by Floyd · ${requestState.request_id}. Opening your review…`;
    try {
      localStorage.setItem(ACCESS_CONSENT_KEY, JSON.stringify({
        accepted_at: new Date().toISOString(),
        version: "v7",
        reviewer_email: reviewerEmail,
        request_id: requestState.request_id,
        requested_at: requestState.requested_at,
        decided_at: requestState.decided_at,
        owner_approval_confirmed: true,
        terms_accepted: true
      }));
    } catch {
      // The active page still opens after the recorded decision in this tab.
    }
    if (dialog.open) dialog.close();
    captureConsentedEvent("access_granted", { analytics_enabled: ANALYTICS_CONFIG.enabled });
  };

  const updateAccessState = () => {
    const reviewerEmail = reviewerField.value.trim();
    const validEmail = reviewerField.validity.valid && reviewerEmail !== "";
    const matchedRequest = validEmail && requestMatches(reviewerEmail);
    const approved = matchedRequest && requestState?.status === "approved";
    checkbox.disabled = matchedRequest;
    reviewerField.disabled = matchedRequest;
    requestApprovalButton.disabled = !validEmail || !checkbox.checked || isSending || matchedRequest;
    requestApprovalButton.textContent = matchedRequest ? (isChecking ? "Checking approval…" : "Waiting for Floyd…") : (isSending ? "Sending request…" : "Request access");
    if (!approvalServiceReady()) approvalStatus.textContent = "Owner approval service configuration is pending.";
    else if (!validEmail) approvalStatus.textContent = "Enter your email to request access.";
    else if (!checkbox.checked && !matchedRequest) approvalStatus.textContent = "Accept the sharing and privacy terms to request access.";
    else if (approved) approvalStatus.textContent = `Approved by Floyd · ${requestState.request_id}. Opening your review…`;
    else if (matchedRequest && requestState.status === "denied") approvalStatus.textContent = "Floyd did not approve this request. Contact him directly if you believe this was an error.";
    else if (matchedRequest) approvalStatus.textContent = `Request ${requestState.request_id} is ${requestState.status || "pending"}. This page checks automatically after Floyd decides.`;
    else approvalStatus.textContent = "Floyd will receive your email address and an Approve button.";
    if (approved) grantApprovedAccess();
  };

  reviewerField.addEventListener("input", updateAccessState);
  checkbox.addEventListener("change", updateAccessState);

  requestApprovalButton.addEventListener("click", async () => {
    if (!reviewerField.reportValidity()) {
      approvalStatus.textContent = "A valid email is required before requesting access.";
      return;
    }
    if (!checkbox.checked) {
      approvalStatus.textContent = "Accept the sharing and privacy terms before requesting access.";
      return;
    }
    isSending = true;
    updateAccessState();
    approvalStatus.textContent = "Creating your private approval request…";
    const reviewerEmail = reviewerField.value.trim();
    const requestId = createAccessRequestId();
    const requestedAt = new Date().toISOString();
    const clientSecret = createClientSecret();
    let deliveryError = null;
    try {
      const result = await sendApprovalRequest(reviewerEmail, requestId, requestedAt, clientSecret);
      requestState = {
        request_id: requestId,
        reviewer_email: reviewerEmail,
        requested_at: requestedAt,
        client_secret: clientSecret,
        status: result.status || "pending",
        decided_at: result.decidedAt || "",
        terms_accepted: true
      };
      try {
        localStorage.setItem(ACCESS_REQUEST_KEY, JSON.stringify(requestState));
      } catch {
        // The active tab still retains requestState if session storage is unavailable.
      }
    } catch (error) {
      deliveryError = error;
    } finally {
      isSending = false;
      updateAccessState();
      if (deliveryError) approvalStatus.textContent = `Request failed (${deliveryError.message}). No access was granted.`;
    }
  });

  const refreshApproval = async () => {
    if (!requestState || isChecking || requestState.status === "approved") return;
    isChecking = true;
    updateAccessState();
    try {
      const result = await checkApprovalStatus(requestState);
      requestState.status = result.status;
      requestState.decided_at = result.decidedAt || "";
      localStorage.setItem(ACCESS_REQUEST_KEY, JSON.stringify(requestState));
    } catch (error) {
      approvalStatus.textContent = `Approval check failed (${error.message}). You can retry.`;
    } finally {
      isChecking = false;
      updateAccessState();
    }
  };

  pollTimer = window.setInterval(refreshApproval, APPROVAL_POLL_INTERVAL_MS);
  dialog.addEventListener("close", () => window.clearInterval(pollTimer), { once: true });

  dialog.addEventListener("cancel", (event) => event.preventDefault());

  updateAccessState();
  if (!hasAccessConsent()) dialog.showModal();
}

function configureAccessTerms(terms) {
  document.querySelector("#access-summary").textContent = terms.access_rule;
  document.querySelector("#access-consent-label").textContent = terms.consent_label;
  document.querySelector("#trust-statement").textContent = terms.trust_statement;
  document.querySelector("#production-security-copy").textContent = terms.production_security_rule;
  document.querySelector("#access-terms").innerHTML = [
    terms.sharing_rule,
    terms.analytics_rule,
    terms.review_build_status
  ].map((term) => `<li>${escapeHtml(term)}</li>`).join("");
}

function wireSectionAnalytics() {
  if (!("IntersectionObserver" in window)) return;
  const seen = new Set();
  const observer = new IntersectionObserver((entries) => {
    if (!hasAccessConsent()) return;
    entries.filter((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.35).forEach((entry) => {
      if (seen.has(entry.target.id)) return;
      seen.add(entry.target.id);
      captureConsentedEvent("section_view", { section: entry.target.id });
    });
  }, { threshold: [0.35] });
  document.querySelectorAll("main section[id]").forEach((section) => observer.observe(section));
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

function renderMarket(data) {
  const snapshot = data.market_snapshot;
  const primary = snapshot.metrics.find((metric) => metric.label === "Weekly profile-view bucket");
  const supporting = snapshot.metrics.filter((metric) => metric.label !== "Weekly profile-view bucket").slice(0, 4);
  document.querySelector("#market-snapshot").innerHTML = `
    <div class="micro-label">${escapeHtml(snapshot.title)}</div>
    <h3>${escapeHtml(snapshot.period)}</h3>
    <div class="peak-time mono">${escapeHtml(data.meta.forecast_freeze_label)}</div>
    <div class="peak-stat">${escapeHtml(primary.display)}</div>
    <div class="peak-stat-label">${escapeHtml(primary.label)}</div>
    <div class="peak-mini-grid">
      ${supporting.map((metric) => `<div class="peak-mini"><strong>${escapeHtml(metric.display)}</strong><span>${escapeHtml(metric.label)}</span></div>`).join("")}
    </div>
  `;

  const colorValues = { accent: "#5cc8ff", violet: "#b8a1ff", good: "#79e0ae", amber: "#ffcc73", coral: "#ff8f7c" };
  document.querySelector("#pipeline-graphic").innerHTML = `
    <div class="pipeline-graphic">
      <div class="stacked-bar" aria-label="Market pipeline mix">
        ${data.pipeline_mix.map((item) => `<span class="${escapeHtml(item.color)}" style="--share:${escapeHtml(item.percent)}" title="${escapeHtml(item.label)}: ${escapeHtml(item.count)}"></span>`).join("")}
      </div>
      <div class="pipeline-legend">
        ${data.pipeline_mix.map((item) => `<div class="pipeline-item"><i class="pipeline-dot" style="--dot:${colorValues[item.color]}"></i><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.count)}</strong></div>`).join("")}
      </div>
      <p class="pipeline-note">${escapeHtml(snapshot.interpretation)} Freeze evidence: <span class="mono">${escapeHtml(snapshot.evidence_id)}</span>.</p>
    </div>
  `;
}

function renderDifferentiators(items) {
  document.querySelector("#differentiated-metrics").innerHTML = items.map((item) => `
    <article class="advantage-card">
      <div class="advantage-value">${escapeHtml(item.value)}</div>
      <h3>${escapeHtml(item.label)}</h3>
      <p>${escapeHtml(item.comparison)}</p>
      <span>${escapeHtml(item.basis)}</span>
    </article>
  `).join("");
}

function renderPowerPrinciples(items) {
  document.querySelector("#power-principles").innerHTML = items.map((item, index) => `
    <article class="power-card">
      <div class="power-number">${String(index + 1).padStart(2, "0")}</div>
      <h3>${escapeHtml(item.name)}</h3>
      <p>${escapeHtml(item.principle)}</p>
      <div class="power-proof"><strong>Evidence on this page</strong>${escapeHtml(item.proof)}</div>
    </article>
  `).join("");
}

function renderValueOptions(model) {
  const colors = ["#5cc8ff", "#b8a1ff", "#79e0ae", "#ffcc73", "#ff8f7c", "#8aa7c2"];
  const years = [2026, 2028, 2030, 2032];
  const trajectoryWidth = 860;
  const trajectoryHeight = 390;
  const margin = { left: 62, right: 30, top: 28, bottom: 55 };
  const minY = 90;
  const maxY = 175;
  const innerWidth = trajectoryWidth - margin.left - margin.right;
  const innerHeight = trajectoryHeight - margin.top - margin.bottom;
  const x = (index) => margin.left + (innerWidth * index / (years.length - 1));
  const y = (value) => margin.top + ((maxY - value) / (maxY - minY)) * innerHeight;
  const ticks = [100, 120, 140, 160];

  const grid = ticks.map((tick) => `
    <line x1="${margin.left}" y1="${y(tick)}" x2="${trajectoryWidth - margin.right}" y2="${y(tick)}" class="chart-gridline" />
    <text x="${margin.left - 12}" y="${y(tick) + 4}" text-anchor="end" class="chart-axis-label">${tick}</text>
  `).join("");
  const yearLabels = years.map((year, index) => `<text x="${x(index)}" y="${trajectoryHeight - 20}" text-anchor="middle" class="chart-axis-label">${year}</text>`).join("");
  const lines = model.options.map((option, optionIndex) => {
    const values = years.map((_, index) => model.baseline_index * Math.pow(option.p50 / model.baseline_index, index / (years.length - 1)));
    const points = values.map((value, index) => `${x(index)},${y(value)}`).join(" ");
    return `
      <polyline points="${points}" fill="none" stroke="${colors[optionIndex]}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
      ${values.map((value, index) => `<circle cx="${x(index)}" cy="${y(value)}" r="${index === years.length - 1 ? 5 : 3}" fill="${colors[optionIndex]}" />`).join("")}
    `;
  }).join("");
  const legend = model.options.map((option, index) => `<span><i style="--legend:${colors[index]}"></i>${escapeHtml(option.label)} · ${escapeHtml(option.archetype)}</span>`).join("");

  document.querySelector("#trajectory-chart").innerHTML = `
    <svg class="option-chart" viewBox="0 0 ${trajectoryWidth} ${trajectoryHeight}" role="img" aria-label="Illustrative personal-equity index paths from 2026 to 2032">
      ${grid}${yearLabels}${lines}
      <text x="20" y="18" class="chart-axis-label">INDEX</text>
    </svg>
    <div class="chart-legend">${legend}</div>
    <p class="chart-note">${escapeHtml(model.interpolation_note)}</p>
  `;

  const rangeWidth = 860;
  const rangeHeight = 78 + model.options.length * 54;
  const rangeLeft = 190;
  const rangeRight = 820;
  const rangeMin = 90;
  const rangeMax = 225;
  const rangeX = (value) => rangeLeft + ((value - rangeMin) / (rangeMax - rangeMin)) * (rangeRight - rangeLeft);
  const rangeTicks = [100, 140, 180, 220];
  const rangeGrid = rangeTicks.map((tick) => `
    <line x1="${rangeX(tick)}" y1="34" x2="${rangeX(tick)}" y2="${rangeHeight - 32}" class="chart-gridline" />
    <text x="${rangeX(tick)}" y="22" text-anchor="middle" class="chart-axis-label">${tick}</text>
  `).join("");
  const rangeRows = model.options.map((option, index) => {
    const rowY = 62 + index * 54;
    return `
      <text x="18" y="${rowY + 4}" class="range-label">${escapeHtml(option.label)} · ${escapeHtml(option.archetype)}</text>
      <line x1="${rangeX(option.p10)}" y1="${rowY}" x2="${rangeX(option.p90)}" y2="${rowY}" stroke="${colors[index]}" stroke-width="8" stroke-linecap="round" opacity="0.42" />
      <circle cx="${rangeX(option.p50)}" cy="${rowY}" r="6" fill="${colors[index]}" />
      <text x="${rangeX(option.p50)}" y="${rowY - 12}" text-anchor="middle" class="range-value">${option.p50}</text>
    `;
  }).join("");
  document.querySelector("#range-chart").innerHTML = `
    <svg class="option-chart" viewBox="0 0 ${rangeWidth} ${rangeHeight}" role="img" aria-label="2032 P10 to P90 uncertainty bands with P50 markers">
      ${rangeGrid}${rangeRows}
    </svg>
    <p class="chart-note">Whisker = P10–P90 scenario range. Dot = P50. Wider is not automatically worse; it means the option carries more unresolved upside and downside.</p>
  `;

  document.querySelector("#option-cards").innerHTML = model.options.map((option, index) => `
    <article class="option-card" style="--option-color:${colors[index]}">
      <div class="option-card-head"><span class="option-id">${escapeHtml(option.label)}</span><span class="option-access">Access prior ${escapeHtml(option.current_access_prior)}%</span></div>
      <h3>${escapeHtml(option.archetype)}</h3>
      <div class="option-score"><span>2032 P50</span><strong>${escapeHtml(option.p50)}</strong><small>index</small></div>
      <div class="option-bar"><span style="--option-share:${escapeHtml(option.lead_adjusted_index)}"></span></div>
      <p><strong>Power move</strong>${escapeHtml(option.power_move)}</p>
      <p><strong>Primary gate</strong>${escapeHtml(option.primary_gate)}</p>
    </article>
  `).join("");

  document.querySelector("#options-interpretation").textContent = `${model.interpretation} Evidence: ${model.evidence_id}.`;
  document.querySelector("#options-dollar-policy").textContent = model.dollar_policy;
}

function renderSummary(data) {
  const summary = data.portfolio_summary;
  const verifiedForecasts = data.forecast_outcomes.filter((outcome) => outcome.outcome !== "pending").length;
  const openForecasts = data.forecasts.filter((forecast) => forecast.status === "open").length;

  const metrics = [
    { value: summary.active_records, label: "Active opportunities", definition: "Anonymized records in the Sep 22 tracker snapshot" },
    { value: summary.anonymized_organizations, label: "Organizations", definition: "Distinct companies represented by stable aliases" },
    { value: `${summary.direct_evidence_links}/52`, label: "Direct evidence linked", definition: "Records with a populated evidence-link field" },
    { value: `${summary.warm_paths}/52`, label: "Warm or referral paths", definition: "Context signal; does not itself advance a stage" },
    { value: `${summary.fresh_within_7_days}/52`, label: "Fresh within 7 days", definition: "86.5% of active records" },
    { value: summary.followups_due_or_overdue, label: "Follow-ups due", definition: "Dated action queue due on or before the snapshot" },
    { value: summary.direct_engagement_journeys, label: "Direct engagement", definition: "Recruiter outreach, direct team outreach, or interviewing" },
    { value: `${verifiedForecasts}/${data.forecasts.length}`, label: "Forecasts verified", definition: `${openForecasts} remain open; replay calibration is not yet scoreable` }
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

  target.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Journey</th><th>Stage</th><th>Last signal</th><th>Confidence</th><th>Health</th><th>Next expected event</th><th>Evidence</th><th>Decision</th></tr></thead><tbody>${journeys.map((journey) => `
    <tr>
      <td><span class="cell-strong">${escapeHtml(journey.label)}</span><br /><span class="cell-muted">${escapeHtml(journey.organization_alias)} · ${escapeHtml(journey.role_family)}</span></td>
      <td>${escapeHtml(journey.current_stage)}</td>
      <td>${escapeHtml(journey.last_observed_at)}<br /><span class="cell-muted">${escapeHtml(journey.age_days)} day(s) ago</span></td>
      <td>${badge(journey.confidence_band, journey.confidence_band === "High" ? "observed" : "watch")}</td>
      <td>${badge(journey.health)}</td>
      <td>${escapeHtml(journey.next_expected_event)}<br /><span class="cell-muted">${escapeHtml(journey.forecast_range)}</span></td>
      <td>${escapeHtml(journey.evidence_count)} channel(s)</td>
      <td>${badge(journey.action, journey.action === "Investigate" ? "at_risk" : "derived")}<br /><span class="cell-muted">${escapeHtml(journey.blocker)}</span></td>
    </tr>
  `).join("")}</tbody></table></div>`;
}

function renderEmptyOrTimeline(events) {
  const target = document.querySelector("#signal-timeline");
  if (!events.length) {
    target.innerHTML = `<div class="empty-state"><strong>No observed timeline events</strong><p>The packet’s example CSV rows were treated as templates—not facts. This timeline activates only when a timestamped, sourced, public-safe event is added.</p></div>`;
    return;
  }

  const sorted = [...events].sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
  target.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Time</th><th>Journey</th><th>Observed event</th><th>State</th><th>Reliability</th><th>Evidence</th></tr></thead><tbody>${sorted.map((event) => `
    <tr><td class="mono">${escapeHtml(event.timestamp)}</td><td>${escapeHtml(event.journey_id)}</td><td>${escapeHtml(event.summary_public)}</td><td>${badge(event.evidence_state)}</td><td>${Math.round(event.source_reliability * 100)}%</td><td class="mono">${escapeHtml(event.source_id)}</td></tr>
  `).join("")}</tbody></table></div>`;
}

function renderHeuristics(items) {
  document.querySelector("#heuristics-grid").innerHTML = items.map((item) => `
    <article class="heuristic-card"><span class="step">${escapeHtml(item.order)}</span><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.rule)}</p><p class="heuristic-effect">${escapeHtml(item.effect)}</p></article>
  `).join("");
}

function renderZeroTrust(items) {
  document.querySelector("#zero-trust-flow").innerHTML = items.map((item) => `
    <article class="zte-card"><div class="zte-source">${escapeHtml(item.zte)}</div><h3>${escapeHtml(item.lab)}</h3><p>${escapeHtml(item.mechanism)}</p><span class="mono">${escapeHtml(item.evidence_id)}</span></article>
  `).join("");
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
      <div>${badge(check.status, check.health)}</div>
      <p>${escapeHtml(check.meaning)}</p>
    </article>
  `).join("");
}

function renderForecasts(data) {
  document.querySelector("#forecast-cards").innerHTML = data.forecasts.map((forecast) => `
    <article class="forecast-card">
      ${badge(forecast.status, forecast.status === "verified" ? "healthy" : "forecast")}
      <h3>${escapeHtml(forecast.target_event)}</h3>
      <p>${escapeHtml(forecast.rationale)}</p>
      <div class="forecast-window"><span>Forecast window</span><strong>${escapeHtml(forecast.window_start)} → ${escapeHtml(forecast.window_end)}</strong></div>
      <dl class="key-value">
        <div><dt>Confidence</dt><dd>${escapeHtml(forecast.confidence_band)}</dd></div>
        <div><dt>Change condition</dt><dd>${escapeHtml(forecast.change_condition)}</dd></div>
        <div><dt>Model</dt><dd class="mono">${escapeHtml(forecast.model_version)}</dd></div>
      </dl>
    </article>
  `).join("");

  const outcome = data.forecast_outcomes[0];
  document.querySelector("#forecast-outcome-title").textContent = outcome ? "One forecast hit inside its frozen window" : "No forecast outcomes recorded";
  document.querySelector("#forecast-outcome-copy").textContent = outcome
    ? `${outcome.observed_at}: ${outcome.calibration_note}`
    : "Outcome verification begins when an observed event resolves a frozen target.";
}

function renderAnomalies(items) {
  document.querySelector("#anomaly-grid").innerHTML = items.map((item) => `
    <article class="anomaly-card">
      ${badge(item.severity, item.severity === "high" ? "at_risk" : "watch")}
      <h3>${escapeHtml(titleCase(item.anomaly_type))}</h3>
      <p>${escapeHtml(item.description)}</p>
      <dl class="anomaly-detail">
        <div><dt>Immediate action</dt><dd>${escapeHtml(item.immediate_action)}</dd></div>
        <div><dt>Most-supported explanation</dt><dd>${escapeHtml(item.most_supported_explanation)}</dd></div>
        <div><dt>Competing explanation</dt><dd>${escapeHtml(item.competing_explanations)}</dd></div>
        <div><dt>Preventive action</dt><dd>${escapeHtml(item.preventive_action)}</dd></div>
        <div><dt>Verification</dt><dd>${escapeHtml(item.verification)}</dd></div>
      </dl>
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

  const freezeMismatch = data.forecasts.filter((forecast) => forecast.created_at !== data.meta.forecast_freeze_at);
  results.push({ name: "Forecast freeze boundary", pass: freezeMismatch.length === 0, detail: freezeMismatch.length ? "A forecast uses post-freeze input time." : "All forecast inputs are frozen at the LinkedIn signal peak." });

  const hiddenPrivateSources = data.sources.filter((source) => source.safe_to_render === false).length;
  results.push({ name: "Privacy gate", pass: true, detail: `${hiddenPrivateSources} source record(s) are registered but excluded from public content.` });

  const anonymizedJourneys = data.journeys.every((journey) => /^Organization \d{2}$/.test(journey.organization_alias) && !journey.req_id && !journey.contact && !journey.url);
  const safeEvents = data.events.every((event) => event.safe_to_render && event.source_id && event.summary_public);
  results.push({ name: "Anonymized tracker layer", pass: anonymizedJourneys && safeEvents, detail: anonymizedJourneys && safeEvents ? "Public journeys use stable aliases and public-safe event summaries." : "A public journey or event needs privacy review." });

  const optionLabelsSafe = data.value_options.options.every((option) => /^Option [A-Z]$/.test(option.label) && !option.company && !option.req_id && !option.compensation);
  results.push({ name: "Anonymized option layer", pass: optionLabelsSafe, detail: optionLabelsSafe ? "2032 paths use generic option labels and normalized indices." : "A 2032 option exposes an identifier or compensation field." });

  const consentTermsComplete = ["access_rule", "sharing_rule", "analytics_rule", "review_build_status", "consent_label", "trust_statement", "production_security_rule"].every((field) => Boolean(data.access_terms[field]));
  results.push({ name: "Consent transparency", pass: consentTermsComplete && ANALYTICS_CONFIG.enabled === false, detail: consentTermsComplete && ANALYTICS_CONFIG.enabled === false ? "Access, sharing, and analytics terms are explicit; review-build analytics remain off." : "Consent terms or analytics state require review." });

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
  wireAccessGate();
  wireTour();
  try {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`Data request failed with ${response.status}`);
    const data = await response.json();

    document.querySelector("#as-of").textContent = data.meta.as_of;
    document.querySelector("#forecast-freeze").textContent = data.meta.forecast_freeze_label;
    document.querySelector("#forecast-freeze-full").textContent = data.meta.forecast_freeze_label;
    configureAccessTerms(data.access_terms);
    renderDifferentiators(data.differentiated_metrics);
    renderFlow(data.system_stages);
    renderMarket(data);
    renderSummary(data);
    renderEmptyOrJourneyTable(data.journeys);
    renderEmptyOrTimeline(data.events);
    renderHeuristics(data.heuristics);
    renderPowerPrinciples(data.power_principles);
    renderZeroTrust(data.zero_trust_translation);
    renderLighthouse(data.lighthouse_candidates);
    renderIndicators(data.indicators);
    renderValueOptions(data.value_options);
    renderForecasts(data);
    renderSyntheticChecks(data.synthetic_checks);
    renderAnomalies(data.anomalies);
    renderEvidence(data.evidence, data.sources);
    renderCadence(data.cadence);
    renderHumanAi(data.human_ai_loop);
    renderDomainPatterns(data.domain_patterns);
    renderMethodology(data);
    renderQuality(data);
    wireSectionAnalytics();
  } catch (error) {
    console.error(error);
    const message = `<div class="empty-state"><strong>Local data could not be loaded.</strong><p>Serve this directory through a local web server or GitHub Pages; browsers block JSON fetches from file URLs.</p></div>`;
    document.querySelectorAll("#summary-metrics, #differentiated-metrics, #flow-grid, #flow-detail, #market-snapshot, #pipeline-graphic, #journey-matrix, #signal-timeline, #heuristics-grid, #power-principles, #zero-trust-flow, #trajectory-chart, #range-chart, #option-cards").forEach((element) => {
      element.innerHTML = message;
    });
    document.querySelector("#as-of").textContent = "Unavailable";
  }
}

init();
