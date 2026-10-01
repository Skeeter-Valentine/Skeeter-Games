import assert from 'node:assert/strict';
import test from 'node:test';
import { makePuzzle, dailyConfig, solutions, MIN_SHARED_EDGE, makeCandidate } from './puzzle.js';
import { restoreMapProgress } from './progress.js';

test('daily maps are deterministic, valid, and cover all three sizes', () => {
  const sizes = new Set();
  for (let day = 20; day < 27; day++) {
    const config = dailyConfig(`2026-09-${day}`);
    const puzzle = makePuzzle(config.seed, config.size);
    sizes.add(config.size);
    assert.deepEqual(puzzle, makePuzzle(config.seed, config.size));
    assert.equal(puzzle.clues.length, { Small: 12, Medium: 24, Large: 35 }[config.size]);
    assert.ok(puzzle.clues.filter(c => c >= 0).length <= Math.floor(puzzle.clues.length / 3));
    assert.equal(solutions(puzzle.adj, puzzle.clues).length, 1);
    assert.ok(puzzle.sharedEdgeLengths.every(length => length >= MIN_SHARED_EDGE - 1e-5));
    const area = puzzle.polygons.reduce((sum, poly) => sum + Math.abs(poly.reduce((a, p, i) => {
      const q = poly[(i + 1) % poly.length];
      return a + p[0] * q[1] - q[0] * p[1];
    }, 0)) / 2, 0);
    assert.ok(Math.abs(area - 720 * 500) < 0.01, 'regions must still cover the full board without gaps');
    puzzle.adj.forEach((neighbors, i) => {
      neighbors.forEach(j => assert.notEqual(puzzle.solution[i], puzzle.solution[j]));
      if (puzzle.clues[i] !== -1) assert.equal(puzzle.clues[i], puzzle.solution[i]);
    });
  }
  assert.equal(sizes.size, 3);
});

test('progress restores undo history and rejects stale or corrupted clues', () => {
  const puzzle = makePuzzle(17429, 'Small');
  const empty = restoreMapProgress(puzzle, null);
  const next = { colors: [...puzzle.solution], notes: puzzle.clues.map(() => 0) };
  const saved = { fingerprint: JSON.stringify(puzzle), history: [...empty.history, next], cursor: 1 };
  assert.equal(restoreMapProgress(puzzle, saved).cursor, 1);
  assert.deepEqual(restoreMapProgress(puzzle, { ...saved, cursor: 99 }), empty);
  assert.deepEqual(restoreMapProgress(puzzle, { ...saved, fingerprint: 'old' }), empty);
  const fixed = puzzle.clues.findIndex(c => c >= 0);
  next.colors[fixed] = -1;
  assert.deepEqual(restoreMapProgress(puzzle, saved), empty);
});

test('bounded-search fallbacks retain clear edges, sparse clues, and unique solutions', () => {
  for (const [size, seed] of [['Small', 104], ['Medium', 16], ['Large', 12]]) {
    const p = makeCandidate(seed, size);
    assert.ok(p.clues.filter(c => c >= 0).length <= Math.floor(p.clues.length / 3));
    assert.ok(p.sharedEdgeLengths.every(length => length >= MIN_SHARED_EDGE - 1e-5));
    assert.equal(solutions(p.adj, p.clues).length, 1);
  }
});

test('successive practice requests produce different boards', () => {
  for (const size of ['Small', 'Medium', 'Large']) {
    let previous = makePuzzle(93900, size);
    for (let i = 1; i <= 2; i++) {
      const next = makePuzzle(93900 + i * 7919, size, previous.sourceSeed);
      assert.notEqual(next.sourceSeed, previous.sourceSeed);
      assert.notDeepEqual(next.polygons, previous.polygons);
      assert.ok(next.clues.filter(c => c >= 0).length <= Math.floor(next.clues.length / 3));
      assert.equal(solutions(next.adj, next.clues).length, 1);
      previous = next;
    }
  }
});
