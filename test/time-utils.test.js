const assert = require('node:assert/strict');
const test = require('node:test');

const { buildTimestampPrefix, prefixTextWithTimestamp } = require('../src/time-utils');

test('buildTimestampPrefix formats [YYYYMMDDTHHMM]', () => {
  const date = new Date('2026-01-27T12:34:56.000Z');
  const prefix = buildTimestampPrefix({ date, timeZone: 'Europe/Madrid' });
  assert.equal(prefix, '[20260127T1334]');
});

test('prefixTextWithTimestamp adds prefix only for non-empty text', () => {
  const date = new Date('2026-01-27T12:34:56.000Z');
  assert.equal(prefixTextWithTimestamp('   ', { date, timeZone: 'Europe/Madrid' }), '   ');
  assert.equal(
    prefixTextWithTimestamp('  hello', { date, timeZone: 'Europe/Madrid' }),
    '[20260127T1334] hello'
  );
});
