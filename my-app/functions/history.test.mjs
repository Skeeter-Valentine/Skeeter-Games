import assert from 'node:assert/strict';
import test from 'node:test';
import { dailyHistoryUpdate, gauntletHistoryUpdate, signedIn } from './history.js';

test('finished gauntlets are saved to the account', () => {
  const run = { finishedAt: 5, results: [{ status: 'won', total: 60 }, { status: 'lost', total: 400 }] };
  assert.deepEqual(gauntletHistoryUpdate('2026-11-15', run), { gauntletHistory: { '2026-11-15': { total: 460, solved: 1 } } });
  assert.equal(gauntletHistoryUpdate('2026-11-15', { ...run, finishedAt: null }), null);
  assert.equal(gauntletHistoryUpdate('2099-01-01', run), null, 'test gauntlets are not kept');
});

test('daily wins and losses are saved; starts and archive plays are not', () => {
  assert.deepEqual(dailyHistoryUpdate({ game: 'akari', date: '2026-11-15', mode: 'daily', status: 'won', seconds: 95 }),
    { dailyHistory: { akari: { '2026-11-15': { won: true, seconds: 95 } } } });
  assert.deepEqual(dailyHistoryUpdate({ game: 'akari', date: '2026-11-15', mode: 'daily', status: 'lost', seconds: 95 }).dailyHistory.akari['2026-11-15'],
    { won: false, seconds: null });
  assert.equal(dailyHistoryUpdate({ game: 'akari', date: '2026-11-15', mode: 'daily', status: 'started' }), null);
  assert.equal(dailyHistoryUpdate({ game: 'akari', date: '2026-11-01', mode: 'archive', status: 'won' }), null);
});

test('only signed-in accounts keep a history', () => {
  assert.ok(signedIn({ token: { firebase: { sign_in_provider: 'google.com' } } }));
  assert.ok(!signedIn({ token: { firebase: { sign_in_provider: 'anonymous' } } }));
  assert.ok(!signedIn(null));
});
