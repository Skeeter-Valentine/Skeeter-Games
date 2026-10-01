import assert from 'node:assert/strict';
import test from 'node:test';
import { validateAttempt, transition, timeBucket } from './attempts.js';
const input = { version: 'v1', game: 'map', date: '2026-09-29', mode: 'daily', status: 'started', seconds: 0 };
test('attempt validation accepts Map and rejects malformed payloads', () => {
  assert.deepEqual(validateAttempt(input, '2026-09-29'), input);
  for (const change of [{ game: 'fake' }, { seconds: -1 }, { date: '2026-02-30' }, { date: '2026-09-30' }, { mode: 'archive' }]) {
    assert.throws(() => validateAttempt({ ...input, ...change }, '2026-09-29'));
  }
});
test('starts and finishes count once and first outcome cannot be rewritten', () => {
  assert.equal(transition(null, input).starts, 1);
  assert.equal(transition(input, input), null);
  const won = { ...input, status: 'won' };
  assert.deepEqual(transition(input, won), { attempt: won, starts: 0, wins: 1, losses: 0, timedWins: 1, winSeconds: 0, bucket: 'b0' });
  assert.equal(transition(won, { ...input, status: 'lost' }), null);
  assert.equal(transition(null, won).starts, 1);
});
test('only winning times are added to time totals and buckets', () => {
  const won = { ...input, status: 'won', seconds: 250 };
  assert.deepEqual(transition(input, won), { attempt: won, starts: 0, wins: 1, losses: 0, timedWins: 1, winSeconds: 250, bucket: 'b4' });
  const lost = transition(input, { ...input, status: 'lost', seconds: 90 });
  assert.equal(lost.timedWins, 0); assert.equal(lost.winSeconds, 0); assert.equal(lost.bucket, null);
  assert.equal(transition(input, { ...input, status: 'won', seconds: null }).timedWins, 0);
  assert.equal(timeBucket(30), 'b0'); assert.equal(timeBucket(31), 'b1'); assert.equal(timeBucket(99999), 'b12');
});
