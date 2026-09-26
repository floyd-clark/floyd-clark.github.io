import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const sent = [];
const seen = new Map();
const rows = [];
const sheet = {
  getName: () => 'Visits', getLastRow: () => rows.length,
  getRange: (row, col) => ({
    setNumberFormat() { return this; },
    setValues(values) { rows[row - 1] = values[0]; return this; },
    setFontWeight() { return this; },
    setValue(value) { rows[row - 1][col - 1] = value; return this; }
  }), setFrozenRows() {}
};
const context = {
  ContentService: { createTextOutput: text => text },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  CacheService: { getScriptCache: () => ({ get: key => seen.get(key), put: (key, value) => seen.set(key, value) }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: name => name === 'ALERT_EMAIL' ? 'owner@example.test' : name === 'VISITS_SPREADSHEET_ID' ? 'sheet-id' : null }) },
  SpreadsheetApp: { openById: () => ({ getSheets: () => [sheet] }) },
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
assert.equal(rows.length, 2);
assert.equal(rows[1][9], 'sent');
console.log('Visitor-alert validation, private log, fixed recipient, and duplicate checks passed.');
