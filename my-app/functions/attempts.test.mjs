import assert from 'node:assert/strict';
import test from 'node:test';
import { validateAttempt, transition } from './attempts.js';
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
  assert.deepEqual(transition(input, won), { attempt: won, starts: 0, wins: 1, losses: 0 });
  assert.equal(transition(won, { ...input, status: 'lost' }), null);
  assert.equal(transition(null, won).starts, 1);
});
