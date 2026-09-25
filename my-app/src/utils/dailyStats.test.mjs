import assert from 'node:assert/strict';
import test from 'node:test';
import { clockKey, formatDuration, readDailyStats, readLocal, recordDailyResult, statsKey, summarizeDailyStats, writeLocal } from './dailyStats.js';

const values = new Map();
globalThis.localStorage = {
  getItem: key => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
};

test('first daily result is immutable across wins, losses, resets, and reloads', () => {
  recordDailyResult('first-result', '2026-09-24', false, 120);
  recordDailyResult('first-result', '2026-09-24', true, 30);
  const saved = JSON.parse(values.get(statsKey('first-result')));
  assert.deepEqual(saved.results['2026-09-24'], { won: false, seconds: 120 });
  assert.equal(summarizeDailyStats(readDailyStats('first-result'), '2026-09-24').played, 1);
  recordDailyResult('other-game', '2026-09-24', true, 20);
  assert.equal(readDailyStats('other-game').results['2026-09-24'].won, true);
});

test('calendar streaks break on missed days and losses, including across months', () => {
  const results = {
    '2026-08-30': { won: true, seconds: 90 },
    '2026-08-31': { won: true, seconds: 60 },
    '2026-09-01': { won: true, seconds: 30 },
    '2026-09-03': { won: true, seconds: 120 },
    '2026-09-04': { won: false, seconds: 10 },
    '2026-09-05': { won: true, seconds: 150 },
  };
  const summary = summarizeDailyStats({ results }, '2026-09-05');
  assert.deepEqual(summary, { played: 6, wins: 5, winRate: 83, currentStreak: 1, maxStreak: 3, bestTime: 30, averageTime: 90 });
  assert.equal(summarizeDailyStats({ results }, '2026-09-06').currentStreak, 1);
  assert.equal(summarizeDailyStats({ results }, '2026-09-07').currentStreak, 0);
  assert.equal(summarizeDailyStats({ results }, '2026-09-04').currentStreak, 0);
  assert.equal(summarizeDailyStats({ results }, '2026-09-02').currentStreak, 3);
});

test('unknown historic times are excluded rather than counted as zero', () => {
  recordDailyResult('unknown-time', '2026-09-23', true, null);
  recordDailyResult('unknown-time', '2026-09-24', true, 65.8);
  assert.equal(summarizeDailyStats(readDailyStats('unknown-time'), '2026-09-24').averageTime, 65);
  assert.equal(formatDuration(null), 'Not recorded');
  assert.equal(formatDuration(0), '0:00');
  assert.equal(formatDuration(65), '1:05');
  assert.equal(formatDuration(3723), '1:02:03');
});

test('malformed storage and invalid fields do not poison statistics', () => {
  values.set(statsKey('bad-json'), '{');
  assert.deepEqual(readDailyStats('bad-json').results, {});
  values.set(statsKey('bad-fields'), JSON.stringify({ results: {
    '2026-02-30': { won: true, seconds: 2 },
    'not-a-date': { won: true },
    '2026-09-21': { won: 'yes' },
    '2026-09-22': { won: true, seconds: -1 },
    '2026-09-23': { won: false, seconds: '10' },
  } }));
  assert.deepEqual(readDailyStats('bad-fields').results, {
    '2026-09-22': { won: true, seconds: null },
    '2026-09-23': { won: false, seconds: null },
  });
  assert.throws(() => recordDailyResult('bad-date', '2026-02-30', true, 2));
});

test('clock progress is separate for each game and puzzle date', () => {
  writeLocal(clockKey('clock', '2026-09-24'), 25.5);
  assert.equal(readLocal(clockKey('clock', '2026-09-24'), 0), 25.5);
  assert.equal(readLocal(clockKey('clock', '2026-09-25'), 0), 0);
  assert.equal(readLocal(clockKey('another-clock', '2026-09-24'), 0), 0);
});

test('storage failures preserve results for the current session', () => {
  const working = globalThis.localStorage;
  globalThis.localStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('quota'); } };
  try {
    recordDailyResult('blocked-storage', '2026-09-24', true, 45);
    recordDailyResult('blocked-storage', '2026-09-24', true, 10);
    assert.equal(readDailyStats('blocked-storage').results['2026-09-24'].seconds, 45);
  } finally { globalThis.localStorage = working; }
});
