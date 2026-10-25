import assert from 'node:assert/strict';
import test from 'node:test';
import { generateDailyPuzzle, generateUniquePuzzle } from './puzzle.js';
import { gradePuzzle } from './grader.js';
import { countSolutions } from './solver.js';
import { HASHI_LEVELS, HASHI_LEVELS_FROM, getDailyConfig } from './dailyConfig.js';
import { hashiProgressKey, hashiSolvedKey, islandFingerprint, restoreHashi } from './progress.js';

const dailyIslands = date => generateDailyPuzzle(getDailyConfig(date));

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

test('dailies before the new levels keep their original boards', () => {
    for (const date of ['2026-09-12', '2026-10-01', '2026-10-25']) {
        const config = getDailyConfig(date);
        assert.equal(config.steps, null);
        assert.deepEqual(dailyIslands(date), generateUniquePuzzle(config.size, getDailyConfig(date).rng));
    }
});

test('each pepper level gets its board size and amount of logic', () => {
    const seen = { 1: 0, 2: 0, 3: 0 };
    for (let day = 0; day < 21; day++) {
        const date = new Date(Date.parse(`${HASHI_LEVELS_FROM}T00:00:00Z`) + day * 86400000).toISOString().slice(0, 10);
        const config = getDailyConfig(date);
        const { sizes, steps: [min, max] } = HASHI_LEVELS[config.level - 1];
        assert.ok(sizes.includes(config.size), date);
        const islands = dailyIslands(date);
        assert.equal(countSolutions(islands, 200000), 1, date);
        const grade = gradePuzzle(islands);
        assert.ok(grade.solved && grade.advanced >= min && grade.advanced <= max, `${date}: level ${config.level}, ${grade.advanced} steps`);
        seen[config.level]++;
    }
    assert.ok(seen[1] && seen[2] && seen[3]);
});
