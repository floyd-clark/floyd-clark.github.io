const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('assets/js/visitor-intelligence.js', 'utf8');

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    snapshot() { return Object.fromEntries(values); }
  };
}

function load(search = '', sharedSession = storage(), sharedLocal = storage()) {
  const documentListeners = {};
  const windowListeners = {};
  const observed = [];
  const logs = [];
  const location = {
    pathname: '/',
    search,
    href: `https://floyd-clark.github.io/${search}`,
    hostname: 'floyd-clark.github.io'
  };
  const window = {
    innerHeight: 100,
    scrollY: 0,
    addEventListener(name, callback) { windowListeners[name] = callback; },
    requestAnimationFrame(callback) { callback(); },
    dispatchEvent(event) { observed.push(event.detail); },
    console: { log(label, value) { logs.push([label, value]); } }
  };
  const document = {
    title: 'Portfolio',
    referrer: '',
    currentScript: { dataset: { goatcounterSite: 'GOATCOUNTER_SITE_CODE' } },
    documentElement: { scrollHeight: 1000, scrollTop: 0 },
    body: { scrollHeight: 1000 },
    addEventListener(name, callback) { documentListeners[name] = callback; },
    querySelector() { return null; },
    createElement() { return { dataset: {}, addEventListener() {} }; },
    head: { appendChild() {} }
  };
  const context = {
    URLSearchParams,
    Set,
    Date,
    JSON,
    Boolean,
    String,
    CustomEvent: class CustomEvent { constructor(type, init) { this.type = type; this.detail = init.detail; } },
    console: window.console,
    document,
    location,
    localStorage: sharedLocal,
    sessionStorage: sharedSession,
    window
  };
  window.window = window;
  vm.runInNewContext(source, context);
  return { window, document, documentListeners, windowListeners, observed, logs, sharedSession, sharedLocal };
}

function click(app, href, dataTrack, download = false) {
  const link = {
    dataset: dataTrack ? { track: dataTrack } : {},
    getAttribute(name) { return name === 'href' ? href : null; },
    hasAttribute(name) { return name === 'download' && download; }
  };
  app.documentListeners.click({ target: { closest() { return link; } } });
}

const attributed = load('?ref=test-recruiter&utm_source=linkedin&analytics_debug=1');
const attr = JSON.parse(attributed.sharedSession.getItem('vi_attr'));
assert.equal(attr.ref, 'test-recruiter');
assert.equal(attr.utm_source, 'linkedin');
assert.ok(attributed.observed.some((item) => item.event === 'portfolio-view'));
assert.ok(attributed.logs.some(([label]) => label === '[vi]'));

const persisted = load('', attributed.sharedSession, attributed.sharedLocal);
assert.equal(persisted.window.__visitorIntelligence.attribution.ref, 'test-recruiter');
assert.ok(persisted.observed.some((item) => item.event === 'return-visit'));

const anonymous = load();
assert.equal(anonymous.window.__visitorIntelligence.attribution.ref, '');
assert.equal(anonymous.window.__visitorIntelligence.providerConfigured, false);

click(anonymous, 'mailto:test@example.com');
click(anonymous, 'https://linkedin.com/in/example');
click(anonymous, 'https://github.com/example');
click(anonymous, '/resume.pdf');
click(anonymous, '/resume.pdf', '', true);
click(anonymous, '/signal-intelligence/');
click(anonymous, 'mailto:test@example.com', 'contact-click');
for (const name of ['email-click', 'linkedin-click', 'github-click', 'resume-open', 'resume-download', 'signal-intelligence-open', 'contact-click']) {
  assert.ok(anonymous.observed.some((item) => item.event === name), `${name} should fire`);
}

anonymous.window.scrollY = 450;
anonymous.windowListeners.scroll();
anonymous.window.scrollY = 850;
anonymous.windowListeners.scroll();
anonymous.windowListeners.scroll();
assert.equal(anonymous.observed.filter((item) => item.event === 'scroll-50').length, 1);
assert.equal(anonymous.observed.filter((item) => item.event === 'scroll-90').length, 1);

const hostile = load('?ref=%3Cscript%3Ealert(1)%3C%2Fscript%3E');
assert.equal(hostile.window.__visitorIntelligence.attribution.ref, 'scriptalert1script');
assert.doesNotMatch(hostile.sharedSession.getItem('vi_attr'), /[<>]/);

console.log('PASS visitor-intelligence targeted tests');
