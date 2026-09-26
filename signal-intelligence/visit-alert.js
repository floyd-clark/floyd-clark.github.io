// A page-open notification only; this is not authentication or access control.
// Set this to the /exec URL of the deployed visitor-alert Apps Script web app.
const VISIT_ALERT_URL = '';
if (VISIT_ALERT_URL && location.origin === 'https://floyd-clark.github.io') {
  const event = crypto.randomUUID();
  const url = new URL(VISIT_ALERT_URL);
  url.searchParams.set('action', 'visit');
  url.searchParams.set('page', 'https://floyd-clark.github.io/signal-intelligence/');
  url.searchParams.set('event', event);
  fetch(url, { mode: 'no-cors', cache: 'no-store', keepalive: true, referrerPolicy: 'no-referrer' })
    .catch(() => { /* Browser privacy settings can block third-party requests. */ });
}
