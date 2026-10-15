import assert from 'node:assert/strict';
import test from 'node:test';
import { buildStats, parseAttemptId, weekOf } from './adminStats.js';

test('attempt ids and weeks', () => {
  assert.deepEqual(parseAttemptId('v1_skeedle-beadle_2026-10-14_daily'), { game: 'skeedle-beadle', date: '2026-10-14', mode: 'daily' });
  assert.equal(parseAttemptId('junk'), null);
  assert.equal(weekOf('2026-10-14'), '2026-10-12');
  assert.equal(weekOf('2026-10-12'), '2026-10-12');
  assert.equal(weekOf('2026-10-18'), '2026-10-12');
});

test('players, their favourite games and game trends', () => {
  const stats = buildStats({
    today: '2026-10-14', weeks: 3, days: 3,
    players: [{ uid: 'a', nickname: 'Ann' }, { uid: 'b', nickname: 'Bo' }, { uid: 'c' }],
    attempts: [
      { uid: 'a', game: 'akari', date: '2026-10-14', mode: 'daily', status: 'won' },
      { uid: 'a', game: 'akari', date: '2026-10-13', mode: 'daily', status: 'started' },
      { uid: 'a', game: 'map', date: '2026-10-01', mode: 'archive', status: 'won' },
      { uid: 'z', game: 'map', date: '2026-10-14', mode: 'daily', status: 'won' },
    ],
    runs: [{ uid: 'b', day: '2026-10-13', finished: true }],
    rates: [
      { game: 'akari', date: '2026-10-14', mode: 'daily', starts: 5, wins: 4 },
      { game: 'akari', date: '2026-10-05', mode: 'daily', starts: 2, wins: 1 },
      { game: 'map', date: '2026-10-13', mode: 'daily', starts: 3, wins: 3 },
      { game: 'map', date: '2026-10-01', mode: 'archive', starts: 1, wins: 1 },
    ],
  });
  assert.equal(stats.summary.nicknamed, 2);
  assert.equal(stats.summary.recordedPlayers, 3);
  assert.equal(stats.summary.activeNicknamed7, 2);
  assert.deepEqual(stats.users.map(user => user.nickname ?? user.uid), ['Ann', 'Bo', 'z']);
  const ann = stats.users[0];
  assert.equal(ann.favorite, 'akari');
  assert.deepEqual(ann.games, [{ game: 'akari', plays: 2, wins: 1 }, { game: 'map', plays: 1, wins: 1 }]);
  assert.equal(ann.lastPlayed, '2026-10-14');
  assert.equal(stats.users[1].gauntletsFinished, 1);
  const akari = stats.games.find(game => game.game === 'akari');
  assert.deepEqual(stats.weekStarts, ['2026-09-28', '2026-10-05', '2026-10-12']);
  assert.deepEqual(akari.weekly, [0, 2, 5]);
  assert.equal(akari.last7, 5);
  assert.equal(akari.prev7, 2);
  assert.equal(akari.change, 1.5);
  assert.equal(stats.games[0].game, 'akari', 'sorted by plays this week');
  assert.deepEqual(stats.daily, [{ date: '2026-10-12', plays: 0 }, { date: '2026-10-13', plays: 3 }, { date: '2026-10-14', plays: 5 }]);
  assert.equal(stats.summary.plays, 11);
});
