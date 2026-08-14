import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeJwtPayload, parseCodexUsage, parseOpenCodeUsage } from '../lib/provider-usage.js';

test('parseCodexUsage preserves percentage and reset timestamp', () => {
  assert.deepEqual(parseCodexUsage({
    rate_limit: {
      primary_window: { used_percent: 35, reset_at: 1787202585, limit_window_seconds: 604800 },
    },
  }), [{ label: '1周', usedPercent: 35, remainingPercent: 65, resetsAt: 1787202585000 }]);
});

test('decodeJwtPayload returns claims without validating signature', () => {
  const payload = Buffer.from(JSON.stringify({ sub: 'user', nested: { id: 'account' } })).toString('base64url');
  assert.deepEqual(decodeJwtPayload(`header.${payload}.signature`), { sub: 'user', nested: { id: 'account' } });
  assert.equal(decodeJwtPayload('broken'), undefined);
});

test('parseOpenCodeUsage maps rolling/weekly/monthly windows', () => {
  assert.deepEqual(parseOpenCodeUsage({
    usage: {
      rolling: { status: 'ok', percent: 0, resetsAt: '2026-08-14T11:06:01.774Z' },
      weekly: { status: 'ok', percent: 7, resetsAt: '2026-08-17T00:00:00.774Z' },
      monthly: { status: 'ok', percent: 15, resetsAt: '2026-08-27T22:42:33.774Z' },
    },
  }), [
    { label: '滚动限额', usedPercent: 0, remainingPercent: 100, resetsAt: Date.parse('2026-08-14T11:06:01.774Z') },
    { label: '周限额', usedPercent: 7, remainingPercent: 93, resetsAt: Date.parse('2026-08-17T00:00:00.774Z') },
    { label: '月限额', usedPercent: 15, remainingPercent: 85, resetsAt: Date.parse('2026-08-27T22:42:33.774Z') },
  ]);
});
