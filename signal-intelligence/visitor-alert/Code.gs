/** Private Apps Script web app for Signal Intelligence page-open alerts.
 * Deploy as the owner, accessible to Anyone, with the mail scope authorized.
 * Keep this service separate from any legacy access-approval deployment.
 */
const SITE = 'https://floyd-clark.github.io/signal-intelligence/';

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
    if (MailApp.getRemainingDailyQuota() < 1) {
      return ContentService.createTextOutput('Mail quota reached');
    }
    const time = new Date().toISOString();
    const recipient = PropertiesService.getScriptProperties().getProperty('ALERT_EMAIL');
    if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
      return ContentService.createTextOutput('Recipient not configured');
    }
    MailApp.sendEmail(recipient, 'Signal Intelligence page opened',
      'A browser opened the public Signal Intelligence page.\n' +
      'Time: ' + time + '\nPage: ' + SITE + '\n' +
      'This is an anonymous page-open alert. It does not identify a person, ' +
      'prove that a human read the page, or grant access.');
    cache.put(key, '1', 21600);
    return ContentService.createTextOutput('Recorded');
  } finally {
    lock.releaseLock();
  }
}
