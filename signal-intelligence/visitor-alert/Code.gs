/** Private Apps Script web app for Signal Intelligence page-open alerts.
 * Deploy as the owner, accessible to Anyone, with the mail scope authorized.
 * Keep this service separate from any legacy access-approval deployment.
 */
const SITE = 'https://floyd-clark.github.io/signal-intelligence/';
const VISIT_HEADERS = ['Event ID', 'Observed UTC', 'Path', 'Referrer origin', 'User agent', 'Language', 'Time zone', 'Viewport', 'Tab session', 'Email status'];

function doGet(e) {
  const p = e && e.parameter || {};
  if (p.action !== 'visit' || p.page !== SITE ||
      !/^[0-9a-f]{8}-[0-9a-f-]{27,40}$/i.test(String(p.event || ''))) {
    return ContentService.createTextOutput('Ignored');
  }

  // Duplicate transport attempts for the same page open send only one email.
  const key = 'visit:' + p.event;
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const cache = CacheService.getScriptCache();
    if (cache.get(key)) return ContentService.createTextOutput('Duplicate');
    // A public endpoint cannot prove visitor identity or prevent forged calls.
    // Never accept a recipient, subject, or arbitrary message from the request.
    const time = new Date().toISOString();
    const visit = {
      event: String(p.event), time,
      path: clean_(p.path, 160), referrer: origin_(p.referrer),
      agent: clean_(p.agent, 200), language: clean_(p.language, 32),
      timezone: clean_(p.timezone, 50), viewport: /^\d{2,4}x\d{2,4}$/.test(String(p.viewport || '')) ? String(p.viewport) : '',
      session: /^[a-f0-9-]{36}$/i.test(String(p.session || '')) ? String(p.session) : ''
    };
    const recipient = PropertiesService.getScriptProperties().getProperty('ALERT_EMAIL');
    if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
      return ContentService.createTextOutput('Recipient not configured');
    }
    const sheet = getVisitsSheet_();
    const row = sheet.getLastRow() + 1;
    sheet.getRange(row, 1, 1, VISIT_HEADERS.length).setNumberFormat('@').setValues([[
      visit.event, visit.time, visit.path, visit.referrer, visit.agent, visit.language,
      visit.timezone, visit.viewport, visit.session, 'pending'
    ]]);
    cache.put(key, '1', 21600);
    if (MailApp.getRemainingDailyQuota() < 1) {
      sheet.getRange(row, 10).setValue('quota reached');
      return ContentService.createTextOutput('Recorded; mail quota reached');
    }
    try {
      MailApp.sendEmail(recipient, 'Signal Intelligence page opened',
        'A browser opened the public Signal Intelligence page.\n' +
        'Time (UTC): ' + time + '\nPage: ' + SITE + '\n' +
        'Referrer: ' + (visit.referrer || 'Direct or hidden') + '\n' +
        'Device: ' + visit.agent + '\n' +
        'Language / time zone: ' + visit.language + ' / ' + visit.timezone + '\n' +
        'Event ID: ' + visit.event + '\n' +
        'This is anonymous visit telemetry, not proof of a person or access authorization.');
      sheet.getRange(row, 10).setValue('sent');
    } catch (error) {
      sheet.getRange(row, 10).setValue('failed');
      throw error;
    }
    return ContentService.createTextOutput('Recorded');
  } finally {
    lock.releaseLock();
  }
}

function getVisitsSheet_() {
  const properties = PropertiesService.getScriptProperties();
  let id = properties.getProperty('VISITS_SPREADSHEET_ID');
  const book = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.create('Signal Intelligence Private Visits');
  if (!id) properties.setProperty('VISITS_SPREADSHEET_ID', book.getId());
  const sheet = book.getSheets()[0];
  if (sheet.getName() !== 'Visits') sheet.setName('Visits');
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, VISIT_HEADERS.length).setValues([VISIT_HEADERS]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function clean_(value, max) {
  const text = String(value || '').slice(0, max).replace(/[\r\n\x00-\x1f]/g, ' ');
  // A leading formula marker in Sheets must stay literal text.
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function origin_(value) {
  const match = /^https?:\/\/[^/?#\s]+/i.exec(String(value || ''));
  return match ? match[0].slice(0, 180) : '';
}
