import assert from 'node:assert/strict';
import test from 'node:test';
import { generateUniquePuzzle } from './puzzle.js';
import { getDailyConfig } from './dailyConfig.js';
import { hashiProgressKey, hashiSolvedKey, islandFingerprint, restoreHashi } from './progress.js';

const dailyIslands = date => { const config = getDailyConfig(date); return generateUniquePuzzle(config.size, config.rng); };

test('archive keys never collide with live daily keys', () => {
  assert.notEqual(hashiProgressKey('2026-09-01', true), hashiProgressKey('2026-09-01', false));
  assert.notEqual(hashiSolvedKey('2026-09-01', true), hashiSolvedKey('2026-09-01', false));
  assert.equal(hashiSolvedKey('2026-09-01', false), 'hashi_solved_v2_2026-09-01');
});

test('daily islands are deterministic and progress restores onto them only', () => {
  const islands = dailyIslands('2026-09-12');
  assert.equal(islandFingerprint(dailyIslands('2026-09-12')), islandFingerprint(islands));
  const [a, b] = islands;
  const saved = JSON.parse(JSON.stringify({ fingerprint: islandFingerprint(islands), bridges: [{ from: a.id, to: b.id, count: 2 }, { from: a.id, to: 999, count: 1 }], seconds: 12, solved: false }));
  assert.deepEqual(restoreHashi(islands, saved), { bridges: [{ from: a.id, to: b.id, count: 2 }], seconds: 12, solved: false });
  assert.equal(restoreHashi(dailyIslands('2026-09-13'), saved), null);
});
