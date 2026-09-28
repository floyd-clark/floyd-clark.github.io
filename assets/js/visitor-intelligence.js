(function () {
  'use strict';

  var EVENTS = new Set([
    'portfolio-view',
    'resume-open',
    'resume-download',
    'linkedin-click',
    'github-click',
    'email-click',
    'contact-click',
    'signal-intelligence-open',
    'scroll-50',
    'scroll-90',
    'return-visit'
  ]);
  var ATTR_KEYS = ['ref', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content'];
  var ATTR_STORAGE_KEY = 'vi_attr';
  var ONCE_STORAGE_KEY = 'vi_once';
  var script = document.currentScript;
  var siteCode = sanitize(script && script.dataset.goatcounterSite, 64);
  var debug = new URLSearchParams(location.search).get('analytics_debug') === '1';
  var queue = [];

  function sanitize(value, maxLength) {
    return String(value || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, maxLength || 100);
  }

  function readJSON(storage, key, fallback) {
    try {
      return JSON.parse(storage.getItem(key)) || fallback;
    } catch (_) {
      return fallback;
    }
  }

  function writeJSON(storage, key, value) {
    try {
      storage.setItem(key, JSON.stringify(value));
    } catch (_) {
      // Storage can be unavailable in privacy modes; analytics must not affect the site.
    }
  }

  function getAttribution() {
    var existing = readJSON(sessionStorage, ATTR_STORAGE_KEY, null);
    if (existing) return existing;

    var params = new URLSearchParams(location.search);
    var attr = {
      ref: '',
      utm_source: '',
      utm_medium: '',
      utm_campaign: '',
      utm_content: '',
      first_page: location.pathname || '/',
      first_seen: new Date().toISOString()
    };
    ATTR_KEYS.forEach(function (key) {
      attr[key] = sanitize(params.get(key), key === 'ref' ? 64 : 100);
    });
    writeJSON(sessionStorage, ATTR_STORAGE_KEY, attr);
    return attr;
  }

  var attribution = getAttribution();

  function attributionLabel() {
    if (attribution.ref) return 'ref/' + attribution.ref;
    var values = ATTR_KEYS.slice(1).filter(function (key) { return attribution[key]; })
      .map(function (key) { return key.replace('utm_', '') + '-' + attribution[key]; });
    return values.length ? 'utm/' + values.join('/') : '';
  }

  function debugLog(name) {
    if (!debug || !window.console || !console.log) return;
    console.log('[vi]', {
      event: name,
      page: location.pathname,
      attribution: attribution
    });
  }

  function send(payload) {
    try {
      if (window.goatcounter && typeof window.goatcounter.count === 'function') {
        window.goatcounter.count(payload);
      } else if (siteCode && siteCode !== 'GOATCOUNTER_SITE_CODE') {
        queue.push(payload);
      }
    } catch (_) {
      // Provider failures never interfere with navigation or rendering.
    }
  }

  function wasTrackedOnce(name) {
    var once = readJSON(sessionStorage, ONCE_STORAGE_KEY, {});
    if (once[name]) return true;
    once[name] = true;
    writeJSON(sessionStorage, ONCE_STORAGE_KEY, once);
    return false;
  }

  function track(name, once) {
    if (!EVENTS.has(name)) return false;
    if (once && wasTrackedOnce(location.pathname + ':' + name)) return false;

    debugLog(name);
    send({ path: name, title: name, event: true });
    if (attribution.ref) {
      send({
        path: 'ref/' + attribution.ref + '/' + name,
        title: name + ' (' + attribution.ref + ')',
        event: true
      });
    }
    try {
      window.dispatchEvent(new CustomEvent('visitor-intelligence', {
        detail: { event: name, page: location.pathname, attribution: attribution }
      }));
    } catch (_) {}
    return true;
  }

  function loadGoatCounter() {
    if (!siteCode || siteCode === 'GOATCOUNTER_SITE_CODE') return;
    if (document.querySelector('script[data-goatcounter]')) return;

    window.goatcounter = window.goatcounter || { no_onload: true, no_events: true };
    window.goatcounter.no_onload = true;
    window.goatcounter.no_events = true;
    window.goatcounter.endpoint = 'https://' + siteCode + '.goatcounter.com/count';

    var provider = document.createElement('script');
    provider.async = true;
    provider.src = 'https://gc.zgo.at/count.v5.js';
    provider.crossOrigin = 'anonymous';
    provider.integrity = 'sha384-atnOLvQb9t+jTSipvd75X2yginT4PjVbqDdlJAmxMm+wYElFmeR6EmLP5bYeoRVQ';
    provider.dataset.goatcounter = window.goatcounter.endpoint;
    provider.dataset.goatcounterSettings = JSON.stringify({ no_onload: true, no_events: true });
    provider.addEventListener('load', function () {
      if (!window.goatcounter || typeof window.goatcounter.count !== 'function') return;
      var pending = queue.slice();
      queue.length = 0;
      pending.forEach(send);
    });
    document.head.appendChild(provider);
  }

  function classifyClick(link) {
    var explicit = sanitize(link.dataset.track, 64);
    if (EVENTS.has(explicit)) return explicit;

    var href = link.getAttribute('href') || '';
    var lower = href.toLowerCase();
    if (lower.indexOf('signal-intelligence') !== -1) return 'signal-intelligence-open';
    if (lower.indexOf('mailto:') === 0) return 'email-click';
    if (lower.indexOf('linkedin.com') !== -1) return 'linkedin-click';
    if (lower.indexOf('github.com') !== -1) return 'github-click';
    if (/\.pdf(?:$|[?#])/i.test(href)) {
      return link.hasAttribute('download') || /download/i.test(href) ? 'resume-download' : 'resume-open';
    }
    return '';
  }

  document.addEventListener('click', function (event) {
    var link = event.target.closest && event.target.closest('a[href]');
    if (!link) return;
    var name = classifyClick(link);
    if (name) track(name, false);
  }, { capture: true });

  var ticking = false;
  function checkScroll() {
    ticking = false;
    var root = document.documentElement;
    var height = Math.max(root.scrollHeight, document.body ? document.body.scrollHeight : 0);
    if (!height) return;
    var depth = ((window.scrollY || root.scrollTop || 0) + window.innerHeight) / height;
    if (depth >= 0.5) track('scroll-50', true);
    if (depth >= 0.9) track('scroll-90', true);
  }
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(checkScroll);
  }, { passive: true });

  try {
    if (localStorage.getItem('vi_seen')) track('return-visit', true);
    else localStorage.setItem('vi_seen', '1');
  } catch (_) {}

  loadGoatCounter();
  send({
    path: location.pathname || '/',
    title: document.title,
    referrer: attributionLabel() || document.referrer || undefined
  });
  track('portfolio-view', false);
  window.requestAnimationFrame(checkScroll);

  window.__visitorIntelligence = {
    attribution: attribution,
    providerConfigured: Boolean(siteCode && siteCode !== 'GOATCOUNTER_SITE_CODE'),
    sanitize: sanitize,
    track: track
  };
}());
