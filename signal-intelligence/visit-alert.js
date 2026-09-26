// Anonymous page-open telemetry and notification; this is not access control.
// Set this to the /exec URL of the deployed visitor-alert Apps Script web app.
const VISIT_ALERT_URL = 'https://script.google.com/macros/s/AKfycbxz_SbPkuy73LM4TT7R96oDyduZgen2YK6HQr_JbHYywqYxpDRNSKmgbCuQG_O4c_ph3A/exec';
if (VISIT_ALERT_URL && location.origin === 'https://floyd-clark.github.io') {
  const event = crypto.randomUUID();
  const url = new URL(VISIT_ALERT_URL);
  url.searchParams.set('action', 'visit');
  url.searchParams.set('page', 'https://floyd-clark.github.io/signal-intelligence/');
  url.searchParams.set('event', event);
  url.searchParams.set('path', location.pathname.slice(0, 160));
  url.searchParams.set('referrer', (() => { try { return new URL(document.referrer).origin; } catch { return ''; } })());
  url.searchParams.set('agent', navigator.userAgent.slice(0, 200));
  url.searchParams.set('language', navigator.language.slice(0, 32));
  url.searchParams.set('timezone', Intl.DateTimeFormat().resolvedOptions().timeZone.slice(0, 50));
  url.searchParams.set('viewport', `${innerWidth}x${innerHeight}`);
  let session = sessionStorage.getItem('si-visit-session');
  if (!session) { session = crypto.randomUUID(); sessionStorage.setItem('si-visit-session', session); }
  url.searchParams.set('session', session);
  fetch(url, { mode: 'no-cors', cache: 'no-store', keepalive: true, referrerPolicy: 'no-referrer' })
    .catch(() => { /* Browser privacy settings can block third-party requests. */ });
}
