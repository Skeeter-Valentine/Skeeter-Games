import test from 'node:test';
import assert from 'node:assert/strict';
import { PICANTE_11_FROM, dailyPuzzle, dailySize, evaluateBoard, generatePuzzle, seededRandom, solvePuzzle, visibleCells } from './puzzle.js';
import { dailyDifficulty } from '../../utils/dailyDifficulty.js';

test('walls block light and bulbs illuminate only their row and column', () => {
  const puzzle = { size: 3, cells: [null, -1, null, null, null, null, null, null, null] };
  assert.deepEqual(new Set(visibleCells(puzzle, 0)), new Set([0, 3, 6]));
  assert.ok(!evaluateBoard(puzzle, [0]).lit.has(4));
  assert.deepEqual([...evaluateBoard(puzzle, [0, 6]).conflicts].sort(), [0, 6]);
  assert.equal(evaluateBoard(puzzle, [0, 2]).conflicts.size, 0);
});

test('winning requires all light, no conflicts, and exact numbered-wall counts', () => {
  const cells = [null, 2, null, -1, -1, -1, null, 2, null];
  const puzzle = { size: 3, cells };
  assert.equal(evaluateBoard(puzzle, [0, 2, 6, 8]).won, true);
  assert.equal(evaluateBoard(puzzle, [0, 2, 6]).won, false);
  assert.equal(evaluateBoard({ size: 3, cells: cells.map(cell => cell === 2 ? 0 : cell) }, [0, 2, 6, 8]).won, false);
  assert.equal(evaluateBoard(puzzle, [0, 2, 6, 8, 8]).won, false);
  assert.equal(evaluateBoard(puzzle, [0, 2, 6, 8, 1]).won, false);
  assert.equal(evaluateBoard(puzzle, [-1]).won, false);
  assert.equal(evaluateBoard({ size: 2, cells: [null, null, null, null] }, [0, 1, 2, 3]).won, false);
});

// Independent brute-force rule check to catch solver/model errors.
function bruteSolutions({ size, cells }) {
  const white = cells.flatMap((cell, id) => cell === null ? [id] : []);
  const answers = [];
  for (let mask = 0; mask < 2 ** white.length; mask++) {
    const bulbs = white.filter((_, index) => mask & (1 << index));
    const lit = new Set(bulbs);
    let valid = true;
    for (const bulb of bulbs) {
      const r = Math.floor(bulb / size), c = bulb % size;
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        for (let rr = r + dr, cc = c + dc; rr >= 0 && cc >= 0 && rr < size && cc < size; rr += dr, cc += dc) {
          const id = rr * size + cc;
          if (cells[id] !== null) break;
          lit.add(id);
          if (bulbs.includes(id)) valid = false;
        }
      }
    }
    cells.forEach((clue, id) => {
      if (clue === null || clue === -1) return;
      const count = bulbs.filter(bulb => Math.abs(Math.floor(bulb / size) - Math.floor(id / size)) + Math.abs(bulb % size - id % size) === 1).length;
      if (count !== clue) valid = false;
    });
    if (valid && lit.size === white.length) answers.push(bulbs.join(','));
  }
  return answers.sort();
}

test('solver matches exhaustive enumeration for 150 small boards', () => {
  const rng = seededRandom('independent-check');
  for (let i = 0; i < 150; i++) {
    const puzzle = { size: 3, cells: Array.from({ length: 9 }, () => rng() < 0.7 ? null : Math.floor(rng() * 4) - 1) };
    const actual = solvePuzzle(puzzle, { limit: 1000 });
    assert.equal(actual.complete, true);
    assert.deepEqual(actual.solutions.map(solution => solution.join(',')).sort(), bruteSolutions(puzzle));
  }
});

test('generated puzzles are unique, valid, and repeatable at every size', () => {
  for (const size of [5, 7, 9, 11, 13]) {
    for (let seed = 0; seed < (size > 9 ? 25 : 60); seed++) {
      const puzzle = generatePuzzle(size, `sample:${seed}`);
      assert.equal(puzzle.cells.length, size * size);
      const result = solvePuzzle(puzzle);
      assert.equal(result.complete, true);
      assert.equal(result.solutions.length, 1);
      assert.equal(evaluateBoard(puzzle, result.solutions[0]).won, true);
      if (seed < 3) assert.deepEqual(generatePuzzle(size, `sample:${seed}`), puzzle);
    }
  }
});

test('daily puzzles follow the shared spice schedule and remain deterministic', () => {
  const sizes = new Set();
  for (let day = 1; day <= 7; day++) {
    const date = `2026-10-0${day}`;
    const puzzle = dailyPuzzle(date);
    assert.equal(puzzle.size, [5, 7, 9][dailyDifficulty('akari', date) - 1]);
    assert.equal(puzzle.size, dailySize(date));
    assert.deepEqual(dailyPuzzle(date), puzzle);
    sizes.add(puzzle.size);
  }
  assert.equal(sizes.size, 3);
  // Picante moves to 11 x 11 from PICANTE_11_FROM; earlier Picante days stay 9 x 9.
  assert.equal(PICANTE_11_FROM, '2026-10-11');
  assert.equal(dailyDifficulty('akari', '2026-10-09'), 3);
  assert.equal(dailyPuzzle('2026-10-09').size, 9);
  for (const date of ['2026-10-11', '2026-10-16']) {
    assert.equal(dailyDifficulty('akari', date), 3);
    const puzzle = dailyPuzzle(date);
    assert.equal(puzzle.size, 11);
    assert.equal(solvePuzzle(puzzle).solutions.length, 1);
  }
  assert.equal(dailyPuzzle('2026-10-12').size, 7);
  assert.equal(dailyPuzzle('2026-10-15').size, 5);
  assert.equal(solvePuzzle({ size: 2, cells: [null, null, null, null] }, { maxNodes: 0 }).complete, false);
});
