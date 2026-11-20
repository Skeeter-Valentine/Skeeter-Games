import assert from 'node:assert/strict';
import test from 'node:test';
import { guestFromRun, playerSearch, playerSummary } from './creators.js';

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

test('creators record only the days they are invited to', async () => {
  const { creatorInvited } = await import('./creators.js');
  assert.ok(creatorInvited({ days: ['2026-12-03'] }, '2026-12-03'));
  assert.ok(!creatorInvited({ days: ['2026-12-03'] }, '2026-12-04'));
  assert.ok(creatorInvited({ allDays: true }, '2026-12-04'));
  assert.ok(!creatorInvited(null, '2026-12-04'));
});

test('the featured creator\'s run becomes the day\'s guest time', async () => {
  const { featuredCreator, guestRecord } = await import('./creators.js');
  const custom = { games: [], creator: { uid: 'SAM', name: 'Sam' } };
  assert.deepEqual(featuredCreator(custom, 'SAM'), { uid: 'SAM', name: 'Sam' });
  assert.equal(featuredCreator(custom, 'EVE'), null);
  assert.equal(featuredCreator(null, 'SAM'), null);
  const run = { lineup: ['map', 'akari'], results: [{ game: 'map', status: 'won', total: 61, seconds: 61 }, { game: 'akari', status: 'lost', total: 300 }] };
  assert.deepEqual(guestRecord('2026-12-03', run, custom.creator),
    { day: '2026-12-03', uid: 'SAM', name: 'Sam', total: 361, solved: 1, games: ['map', 'akari'], levels: [1, 3], results: [{ game: 'map', status: 'won', total: 61 }, { game: 'akari', status: 'lost', total: 300 }] });
});

test('a featured creator\'s earlier run can be published as the guest time', () => {
  const games = ['nonograms', 'pipes'];
  const custom = { games, creator: { uid: 'pt', name: 'PuzzleTank' } };
  const run = { finishedAt: 5, lineup: games, results: [{ game: 'nonograms', status: 'won', total: 200 }, { game: 'pipes', status: 'won', total: 223 }] };
  const { guest } = guestFromRun('2026-11-19', custom, run);
  assert.equal(guest.total, 423);
  assert.equal(guest.solved, 2);
  assert.equal(guest.uid, 'pt');
  assert.equal(guest.name, 'PuzzleTank');
  assert.equal(guestFromRun('2026-11-19', { games }, run).reason, 'no-creator');
  assert.equal(guestFromRun('2026-11-19', custom, { ...run, finishedAt: null }).reason, 'not-finished');
  assert.equal(guestFromRun('2026-11-19', custom, null).reason, 'not-finished');
  assert.equal(guestFromRun('2026-11-19', custom, { ...run, lineup: ['pipes', 'nonograms'] }).reason, 'different-games');
});
