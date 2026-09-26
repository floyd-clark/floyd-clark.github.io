(function () {
  'use strict';
  const API = 'https://script.google.com/macros/s/AKfycbxz_SbPkuy73LM4TT7R96oDyduZgen2YK6HQr_JbHYywqYxpDRNSKmgbCuQG_O4c_ph3A/exec';
  const KEY = 'signal-intelligence-visitor-approval-v1';
  const style = document.createElement('style');
  style.textContent = 'html.si-locked body{overflow:hidden}#si-wall{position:fixed;inset:0;z-index:2147483647;background:#081923;color:#e9f4f7;display:grid;place-items:center;padding:24px;font:16px/1.5 system-ui,sans-serif}#si-wall *{box-sizing:border-box}#si-wall .panel{width:min(100%,520px);padding:clamp(24px,5vw,44px);border:1px solid #456271;border-radius:18px;background:#102a36;box-shadow:0 24px 80px #0009}#si-wall .eyebrow{color:#8fd7e9;letter-spacing:.14em;font-size:12px;text-transform:uppercase}#si-wall h1{font-size:clamp(27px,5vw,39px);line-height:1.1;margin:15px 0}#si-wall p{color:#c5d5db}#si-wall label{display:block;margin:22px 0 8px}#si-wall input{width:100%;padding:13px;border:1px solid #9eb8c2;border-radius:8px;background:#fff;color:#11232b;font:inherit}#si-wall button{margin-top:16px;padding:13px 19px;border:0;border-radius:8px;background:#8ce0f3;color:#08212b;font:600 16px system-ui;cursor:pointer}#si-wall button:disabled{opacity:.6;cursor:wait}#si-wall .small{font-size:13px;color:#aebfc6}#si-wall [role=status]{min-height:24px}';
  document.head.append(style);
  document.documentElement.classList.add('si-locked');
  function service(params) {
    return new Promise((resolve, reject) => {
      const cb = 'siApproval' + Date.now() + Math.random().toString(36).slice(2);
      const script = document.createElement('script');
      let done = false;
      const finish = (error, data) => { if (done) return; done = true; clearTimeout(timer); delete window[cb]; script.remove(); error ? reject(error) : resolve(data); };
      const timer = setTimeout(() => finish(new Error('Approval service timed out.')), 25000);
      window[cb] = data => data && data.ok ? finish(null, data) : finish(new Error(data?.message || 'Request rejected.'));
      script.onerror = () => finish(new Error('Approval service unavailable.'));
      const url = new URL(API);
      Object.entries({ ...params, callback: cb }).forEach(([k, v]) => url.searchParams.set(k, v));
      script.src = url.toString(); document.head.append(script);
    });
  }
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } };
  const save = value => { try { localStorage.setItem(KEY, JSON.stringify(value)); } catch {} };
  const id = () => 'SIL-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase();
  function unlock() { document.querySelector('#si-wall')?.remove(); document.documentElement.classList.remove('si-locked'); }
  function mount() {
    const wall = document.createElement('div'); wall.id = 'si-wall'; wall.setAttribute('role', 'dialog'); wall.setAttribute('aria-modal', 'true'); wall.setAttribute('aria-labelledby', 'si-wall-title');
    wall.innerHTML = '<div class="panel"><div class="eyebrow">Signal Intelligence / Visitor access</div><h1 id="si-wall-title">Request Floyd’s approval.</h1><p>Enter the email address Floyd will recognize. Your request goes to his Google approval service; this page opens after he approves it.</p><form><label for="si-email">Your email address</label><input id="si-email" type="email" autocomplete="email" required placeholder="you@example.com"><button type="submit">Request access</button></form><p role="status">Checking access…</p><p class="small">Approval controls this interface. The public GitHub Pages files are addressable directly and are not private storage.</p></div>';
    document.body.append(wall);
    const form = wall.querySelector('form'), input = wall.querySelector('input'), button = wall.querySelector('button'), status = wall.querySelector('[role=status]');
    let state = read(), checking = false;
    if (state?.email) input.value = state.email;
    async function check() {
      if (!state || checking) return;
      checking = true;
      try {
        const result = await service({ action:'status', requestId:state.requestId, clientSecret:state.secret });
        if (result.status === 'approved') { unlock(); return; }
        status.textContent = result.status === 'denied' ? 'Floyd did not approve this request.' : 'Request sent. Waiting for Floyd’s decision; checking automatically.';
      } catch (error) { status.textContent = 'Approval check unavailable: ' + error.message; }
      finally { checking = false; }
    }
    form.addEventListener('submit', async event => {
      event.preventDefault(); if (!input.reportValidity()) return;
      button.disabled = true; status.textContent = 'Sending request…';
      const email = input.value.trim(), requestId = id(), secret = crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
      try {
        const result = await service({ action:'request', email, requestId, requestedAt:new Date().toISOString(), clientSecret:secret, source:location.origin + location.pathname });
        state = { email, requestId, secret }; save(state);
        if (result.status === 'approved') unlock(); else { status.textContent = 'Request sent. Waiting for Floyd’s decision.'; check(); }
      } catch (error) { status.textContent = 'Request failed: ' + error.message; }
      finally { button.disabled = false; }
    });
    if (state) check(); else status.textContent = 'Enter your email to request access.';
    setInterval(check, 8000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once:true }); else mount();
})();
