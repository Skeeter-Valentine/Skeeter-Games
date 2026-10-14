import assert from 'node:assert/strict';
import test from 'node:test';
import { dailyBoardSeconds, recentBoardIds } from './dailyBoard.js';

const now = Date.parse('2026-10-14T02:00:00Z');
const win = { game: 'pipes', date: '2026-10-14', mode: 'daily', status: 'won', seconds: 95 };

test('only a first daily win with a real time goes on the board', () => {
  assert.equal(dailyBoardSeconds(win, true, now), 95);
  assert.equal(dailyBoardSeconds({ ...win, date: '2026-10-13' }, true, now), 95, 'yesterday still counts');
  assert.equal(dailyBoardSeconds({ ...win, date: '2026-10-12' }, true, now), null);
  assert.equal(dailyBoardSeconds(win, false, now), null, 'replays never count');
  assert.equal(dailyBoardSeconds({ ...win, mode: 'archive' }, true, now), null);
  assert.equal(dailyBoardSeconds({ ...win, status: 'lost' }, true, now), null);
  assert.equal(dailyBoardSeconds({ ...win, seconds: null }, true, now), null);
  assert.equal(dailyBoardSeconds({ ...win, seconds: 2 }, true, now), null, 'impossibly fast');
});

test('a nickname change renames today\'s and yesterday\'s boards', () => {
  assert.deepEqual(recentBoardIds(['pipes', 'map'], now), ['pipes_2026-10-14', 'pipes_2026-10-13', 'map_2026-10-14', 'map_2026-10-13']);
});
