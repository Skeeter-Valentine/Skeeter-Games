import assert from 'node:assert/strict';
import test from 'node:test';
import { playerSearch, playerSummary } from './creators.js';

test('searches go by sign-in email or the start of a nickname', () => {
  assert.deepEqual(playerSearch(' Sam@Example.com '), { email: 'sam@example.com' });
  assert.equal(playerSearch('sam@'), null);
  assert.deepEqual(playerSearch('Sam_Plays 1'), { prefix: 'samplays1' }, 'matches how nicknames are claimed');
  assert.equal(playerSearch('a'), null, 'too short to search');
  assert.equal(playerSearch(''), null);
});

test('results carry only what the owner needs', () => {
  assert.deepEqual(playerSummary('u1', { nickname: 'Sam', email: 'sam@example.com', creator: 1, extra: 'x' }),
    { uid: 'u1', nickname: 'Sam', email: 'sam@example.com', name: null, creator: true });
});
