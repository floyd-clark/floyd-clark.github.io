import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const sent = [];
const seen = new Map();
const context = {
  ContentService: { createTextOutput: text => text },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  CacheService: { getScriptCache: () => ({ get: key => seen.get(key), put: (key, value) => seen.set(key, value) }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: name => name === 'ALERT_EMAIL' ? 'owner@example.test' : null }) },
  MailApp: { getRemainingDailyQuota: () => 1, sendEmail: (...args) => sent.push(args) }
};
vm.runInNewContext(readFileSync(new URL('./Code.gs', import.meta.url), 'utf8'), context);
const visit = parameters => context.doGet({ parameter: parameters });
const valid = {
  action: 'visit', page: 'https://floyd-clark.github.io/signal-intelligence/',
  event: 'e36f2fae-d927-4f97-930e-b3d8b5d2f196'
};
assert.equal(visit({ ...valid, page: 'https://evil.example/' }), 'Ignored');
assert.equal(visit({ ...valid, event: 'bad' }), 'Ignored');
assert.equal(sent.length, 0);
assert.equal(visit({ ...valid, recipient: 'attacker@example.com' }), 'Recorded');
assert.equal(visit(valid), 'Duplicate');
assert.equal(sent.length, 1);
assert.equal(sent[0][0], 'owner@example.test');
assert.ok(!sent[0][2].includes('attacker@example.com'));
console.log('Visitor-alert input, fixed recipient, and duplicate checks passed.');
