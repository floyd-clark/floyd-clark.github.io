const CONFIG = Object.freeze({
  OWNER_EMAIL: "floyd.clark.usma@gmail.com",
  SPREADSHEET_NAME: "Signal Intelligence Access Approvals",
  SHEET_NAME: "Approvals",
  SITE_URL: "https://floyd-clark.github.io/signal-intelligence/",
  REQUEST_COOLDOWN_SECONDS: 600
});

const HEADERS = [
  "Request ID", "Reviewer Email", "Requested At", "Status", "Decided At",
  "Client Secret Hash", "Decision Token", "Source Page", "Last Checked At"
];

function doGet(event) {
  const parameters = event && event.parameter ? event.parameter : {};
  const action = String(parameters.action || "health").toLowerCase();

  try {
    if (action === "request") return jsonp_(parameters, createRequest_(parameters));
    if (action === "status") return jsonp_(parameters, getStatus_(parameters));
    if (action === "review") return renderDecisionPage_(parameters);
    return jsonp_(parameters, { ok: true, service: "signal-intelligence-approval", status: "ready" });
  } catch (error) {
    return jsonp_(parameters, { ok: false, message: error.message || "Approval service error." });
  }
}

function doPost(event) {
  const parameters = event && event.parameter ? event.parameter : {};
  try {
    return recordDecision_(parameters);
  } catch (error) {
    return renderResult_("Decision not recorded", error.message || "Approval service error.", false);
  }
}

function createRequest_(parameters) {
  const email = normalizeEmail_(parameters.email);
  const requestId = requireMatch_(parameters.requestId, /^SIL-[A-Z0-9-]{8,64}$/, "Invalid request ID.");
  const clientSecret = requireMatch_(parameters.clientSecret, /^[A-Za-z0-9_-]{32,128}$/, "Invalid client secret.");
  const requestedAt = requireIsoDate_(parameters.requestedAt);
  const source = String(parameters.source || "");
  if (source !== CONFIG.SITE_URL && source !== "http://127.0.0.1:4173/signal-intelligence/") {
    throw new Error("This request did not originate from the approved review page.");
  }

  const cache = CacheService.getScriptCache();
  const cooldownKey = `request:${digest_(email)}`;
  if (cache.get(cooldownKey)) throw new Error("A request for this email was recently sent. Wait ten minutes before retrying.");

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getSheet_();
    if (findRow_(sheet, requestId)) throw new Error("This request ID already exists.");

    const decisionToken = Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, "");
    const row = sheet.getLastRow() + 1;
    const values = [[
      requestId, email, requestedAt, "pending", "", digest_(clientSecret),
      decisionToken, source, new Date().toISOString()
    ]];
    sheet.getRange(row, 1, 1, HEADERS.length).setNumberFormat("@").setValues(values);
    sendOwnerEmail_(email, requestId, decisionToken);
    cache.put(cooldownKey, "1", CONFIG.REQUEST_COOLDOWN_SECONDS);
    return { ok: true, requestId, status: "pending" };
  } finally {
    lock.releaseLock();
  }
}

function getStatus_(parameters) {
  const requestId = requireMatch_(parameters.requestId, /^SIL-[A-Z0-9-]{8,64}$/, "Invalid request ID.");
  const clientSecret = requireMatch_(parameters.clientSecret, /^[A-Za-z0-9_-]{32,128}$/, "Invalid client secret.");
  const sheet = getSheet_();
  const row = findRow_(sheet, requestId);
  if (!row) throw new Error("Request not found.");

  const values = sheet.getRange(row, 1, 1, HEADERS.length).getDisplayValues()[0];
  if (!safeEqual_(values[5], digest_(clientSecret))) throw new Error("Request credentials did not match.");
  sheet.getRange(row, 9).setValue(new Date().toISOString());
  return { ok: true, requestId, status: values[3], decidedAt: values[4] || "" };
}

function renderDecisionPage_(parameters) {
  const token = requireMatch_(parameters.token, /^[A-Za-z0-9]{64,128}$/, "Invalid approval token.");
  const sheet = getSheet_();
  const row = findRowByToken_(sheet, token);
  if (!row) throw new Error("This approval link is invalid or expired.");
  const values = sheet.getRange(row, 1, 1, HEADERS.length).getDisplayValues()[0];
  const email = escapeHtml_(values[1]);
  const requestId = escapeHtml_(values[0]);
  const currentStatus = escapeHtml_(values[3]);
  const serviceUrl = ScriptApp.getService().getUrl();

  return HtmlService.createHtmlOutput(`<!doctype html><html><head><base target="_top"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Review access request</title><style>
    body{margin:0;background:#071019;color:#ecf4fa;font:16px system-ui,sans-serif}main{max-width:560px;margin:8vh auto;padding:32px;border:1px solid #294153;border-radius:20px;background:#0b1621}small{color:#8da1b1}h1{font-size:28px}strong{display:block;margin:24px 0 8px;font-size:22px;word-break:break-word}.actions{display:flex;gap:12px;margin-top:28px}button{padding:13px 20px;border:0;border-radius:10px;font-weight:800;cursor:pointer}.approve{background:#5cc8ff;color:#04111b}.deny{background:#263746;color:#ecf4fa}</style></head><body><main><small>Signal Intelligence · ${requestId}</small><h1>Approve this reviewer?</h1><strong>${email}</strong><p>Current status: ${currentStatus}</p><form method="post" action="${serviceUrl}"><input type="hidden" name="token" value="${escapeHtml_(token)}"><div class="actions"><button class="approve" name="decision" value="approved">Approve access</button><button class="deny" name="decision" value="denied">Deny</button></div></form></main></body></html>`)
    .setTitle("Review Signal Intelligence access");
}

function recordDecision_(parameters) {
  const token = requireMatch_(parameters.token, /^[A-Za-z0-9]{64,128}$/, "Invalid approval token.");
  const decision = String(parameters.decision || "").toLowerCase();
  if (decision !== "approved" && decision !== "denied") throw new Error("Choose Approve or Deny.");

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getSheet_();
    const row = findRowByToken_(sheet, token);
    if (!row) throw new Error("This approval link is invalid or expired.");
    const email = sheet.getRange(row, 2).getDisplayValue();
    const decidedAt = new Date().toISOString();
    sheet.getRange(row, 4, 1, 2).setValues([[decision, decidedAt]]);
    sheet.getRange(row, 7).setValue("");
    return renderResult_(decision === "approved" ? "Access approved" : "Access denied", `${email} is now ${decision}. The visitor's page will update automatically.`, decision === "approved");
  } finally {
    lock.releaseLock();
  }
}

function sendOwnerEmail_(email, requestId, decisionToken) {
  const reviewUrl = `${ScriptApp.getService().getUrl()}?action=review&token=${encodeURIComponent(decisionToken)}`;
  const subject = `Approve Signal Intelligence access: ${email}`;
  const plainBody = `Reviewer: ${email}\n\nOpen this private decision page to approve or deny access:\n${reviewUrl}\n\nRequest ID: ${requestId}`;
  const htmlBody = `<p>Someone requested access to Signal Intelligence.</p><p style="font-size:20px"><strong>${escapeHtml_(email)}</strong></p><p><a href="${reviewUrl}" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#1677ff;color:#fff;text-decoration:none;font-weight:700">Review request</a></p><p style="color:#666;font-size:12px">Request ID: ${escapeHtml_(requestId)}</p>`;
  GmailApp.sendEmail(CONFIG.OWNER_EMAIL, subject, plainBody, { htmlBody, name: "Signal Intelligence Access" });
}

function getSheet_() {
  const properties = PropertiesService.getScriptProperties();
  let spreadsheetId = properties.getProperty("APPROVAL_SPREADSHEET_ID");
  let spreadsheet;
  if (spreadsheetId) {
    spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  } else {
    spreadsheet = SpreadsheetApp.create(CONFIG.SPREADSHEET_NAME);
    spreadsheetId = spreadsheet.getId();
    properties.setProperty("APPROVAL_SPREADSHEET_ID", spreadsheetId);
  }
  let sheet = spreadsheet.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) sheet = spreadsheet.getSheets()[0].setName(CONFIG.SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function findRow_(sheet, requestId) {
  if (sheet.getLastRow() < 2) return 0;
  const match = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).createTextFinder(requestId).matchEntireCell(true).findNext();
  return match ? match.getRow() : 0;
}

function findRowByToken_(sheet, token) {
  if (sheet.getLastRow() < 2) return 0;
  const match = sheet.getRange(2, 7, sheet.getLastRow() - 1, 1).createTextFinder(token).matchEntireCell(true).findNext();
  return match ? match.getRow() : 0;
}

function normalizeEmail_(value) {
  const email = String(value || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error("Enter a valid email address.");
  return email;
}

function requireMatch_(value, pattern, message) {
  const text = String(value || "");
  if (!pattern.test(text)) throw new Error(message);
  return text;
}

function requireIsoDate_(value) {
  const text = String(value || "");
  const parsed = new Date(text);
  if (!text || isNaN(parsed.getTime()) || Math.abs(Date.now() - parsed.getTime()) > 86400000) throw new Error("Invalid request timestamp.");
  return parsed.toISOString();
}

function digest_(value) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value), Utilities.Charset.UTF_8);
  return bytes.map(byte => (byte + 256).toString(16).slice(-2)).join("");
}

function safeEqual_(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

function jsonp_(parameters, payload) {
  const callback = String(parameters.callback || "callback");
  if (!/^[A-Za-z_$][0-9A-Za-z_$]{0,100}$/.test(callback)) throw new Error("Invalid callback.");
  return ContentService.createTextOutput(`${callback}(${JSON.stringify(payload)});`).setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function renderResult_(title, message, approved) {
  return HtmlService.createHtmlOutput(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml_(title)}</title><style>body{margin:0;background:#071019;color:#ecf4fa;font:16px system-ui,sans-serif}main{max-width:560px;margin:12vh auto;padding:34px;border:1px solid #294153;border-radius:20px;background:#0b1621}h1{color:${approved ? "#79e0ae" : "#ffcc73"}}p{line-height:1.6}</style></head><body><main><h1>${escapeHtml_(title)}</h1><p>${escapeHtml_(message)}</p><p>You may close this tab.</p></main></body></html>`).setTitle(title);
}

function escapeHtml_(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
