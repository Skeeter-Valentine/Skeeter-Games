import assert from 'node:assert/strict';
import test from 'node:test';
import { generateClues, generateUniquePuzzleGrid, getDailyRng, isLogicallySolvable } from './puzzle.js';

test('clues preserve runs and empty lines', () => {
  assert.deepEqual(generateClues([[1, 0, 1], [0, 0, 0]]), {
    rowClues: [[1, 1], [0]], colClues: [[1], [0], [1]],
  });
});

test('rejects ambiguous clues and inconsistent clues', () => {
  assert.equal(isLogicallySolvable(generateClues([[1, 0], [0, 1]])), false);
  assert.equal(isLogicallySolvable({ rowClues: [[2], [2]], colClues: [[0], [0]] }), false);
});

test('every accepted 3x3 clue set has exactly one solution by exhaustive enumeration', () => {
  const counts = new Map();
  for (let mask = 0; mask < 512; mask++) {
    const grid = Array.from({ length: 3 }, (_, r) =>
      Array.from({ length: 3 }, (_, c) => (mask >> (r * 3 + c)) & 1));
    const key = JSON.stringify(generateClues(grid));
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  let accepted = 0;
  for (const [key, count] of counts) {
    if (isLogicallySolvable(JSON.parse(key))) {
      assert.equal(count, 1, key);
      accepted++;
    }
  }
  assert.ok(accepted > 0);
});

test('all supported sizes produce solvable puzzles across 100 seeds each', () => {
  for (const size of [5, 10, 15]) {
    for (let seed = 0; seed < 100; seed++) {
      const grid = generateUniquePuzzleGrid(size, size, getDailyRng(`sample-${seed}`));
      assert.equal(grid.length, size);
      assert.ok(grid.every(row => row.length === size));
      assert.ok(grid.some(row => row.includes(1)));
      assert.equal(isLogicallySolvable(generateClues(grid)), true);
    }
  }
});

test('daily puzzles are repeatable', () => {
  assert.deepEqual(
    generateUniquePuzzleGrid(10, 10, getDailyRng('2026-09-24')),
    generateUniquePuzzleGrid(10, 10, getDailyRng('2026-09-24')),
  );
});

test('bounded fallback remains unique when RNG only produces empty candidates', () => {
  const grid = generateUniquePuzzleGrid(5, 5, () => 0.999999);
  assert.equal(isLogicallySolvable(generateClues(grid)), true);
  // An RNG alternating a full run and an empty value always creates empty rows.
  let calls = 0;
  const fallback = generateUniquePuzzleGrid(5, 5, () => calls++ % 2 === 0 ? 0.999999 : 0);
  assert.ok(fallback.some(row => row.includes(1)));
  assert.equal(isLogicallySolvable(generateClues(fallback)), true);
  assert.ok(calls <= 1002);
});
