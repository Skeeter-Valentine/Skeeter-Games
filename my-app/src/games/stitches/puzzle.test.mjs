import assert from 'node:assert/strict';
import test from 'node:test';
import { checkSolution, dailyPuzzle, generatePuzzle, getCounts, getEdges, seededRandom, solvePuzzle } from './puzzle.js';
import { fallbackPuzzle } from './fallbacks.js';

function checkRegionShapes(regions) {
  const size = regions.length;
  const blocks = new Map();
  regions.forEach((row, r) => row.forEach((id, c) => {
    assert.ok(Number.isInteger(id) && id >= 0);
    if (!blocks.has(id)) blocks.set(id, []);
    blocks.get(id).push([r, c]);
  }));
  let irregular = 0;
  for (const [id, cells] of blocks) {
    assert.ok(cells.length >= 3, 'No isolated single cells or two-cell slivers');
    const seen = new Set();
    const pending = [cells[0]];
    while (pending.length) {
      const [r, c] = pending.pop();
      const key = r * size + c;
      if (seen.has(key)) continue;
      seen.add(key);
      for (const [rr, cc] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) {
        if (regions[rr]?.[cc] === id && !seen.has(rr * size + cc)) pending.push([rr, cc]);
      }
    }
    assert.equal(seen.size, cells.length, 'Every block must be orthogonally connected');
    const rows = cells.map(([r]) => r), cols = cells.map(([, c]) => c);
    const boundingArea = (Math.max(...rows) - Math.min(...rows) + 1) * (Math.max(...cols) - Math.min(...cols) + 1);
    if (boundingArea !== cells.length) irregular++;
  }
  assert.ok(irregular >= Math.ceil(blocks.size * 0.6), 'At least 60% of blocks must have irregular shapes');
}

test('only orthogonal cells across different blocks can form stitches', () => {
  assert.deepEqual(getEdges([[0, 0], [1, 1]]).map(edge => edge.id), ['0-2', '1-3']);
  assert.equal(new Set(getEdges([[0, 1], [2, 3]]).map(edge => edge.pair)).size, 4);
});

test('counts holes, including two in the same row or column', () => {
  assert.deepEqual(getCounts(3, [{ a: 0, b: 1 }, { a: 5, b: 8 }]), {
    rows: [2, 1, 1], cols: [1, 1, 2],
  });
});

test('win check rejects missing connections, repeated pairs, reused holes, and wrong clues', () => {
  const regions = [[0, 1, 2], [0, 1, 2], [0, 1, 2]];
  const puzzle = { regions, rows: [2, 2, 0], cols: [1, 2, 1] };
  assert.equal(checkSolution(puzzle, ['0-1', '4-5']), true);
  assert.equal(checkSolution(puzzle, ['0-1']), false);
  assert.equal(checkSolution(puzzle, ['0-1', '3-4']), false);
  assert.equal(checkSolution(puzzle, ['0-1', '0-1']), false);
  assert.equal(checkSolution(puzzle, ['0-1', '1-2']), false);
  assert.equal(checkSolution(puzzle, ['0-1', '7-8']), false);
  assert.equal(checkSolution(puzzle, ['0-2', '4-5']), false);
  // Even totals derived from illegal overlapping stitches must not be accepted.
  assert.equal(checkSolution({ regions, rows: [4, 0, 0], cols: [1, 2, 1] }, ['0-1', '1-2']), false);
});

test('distinguishes unique, ambiguous, impossible, and budget-limited searches', () => {
  const regions = [[0, 1, 2], [0, 1, 2], [0, 1, 2]];
  assert.equal(solvePuzzle({ regions, rows: [2, 2, 0], cols: [1, 2, 1] }).solutions.length, 2);
  assert.equal(solvePuzzle({ regions, rows: [4, 0, 0], cols: [1, 2, 1] }).solutions.length, 0);
  const unique = { regions: [[0, 1], [0, 1]], rows: [2, 0], cols: [1, 1] };
  assert.equal(solvePuzzle(unique).solutions.length, 1);
  assert.equal(solvePuzzle(unique, { maxNodes: 0 }).complete, false);
});

test('solver matches independent subset enumeration on small region layouts', () => {
  const layouts = [
    [[0, 1, 2], [0, 1, 2], [0, 1, 2]],
    [[0, 0, 1], [0, 0, 1], [2, 2, 2]],
    [[0, 0, 0], [1, 1, 2], [1, 1, 2]],
  ];
  for (const regions of layouts) {
    const edges = [];
    // Build adjacency independently from getEdges and exhaust all edge subsets.
    for (let a = 0; a < 9; a++) {
      for (let b = a + 1; b < 9; b++) {
        const ar = Math.floor(a / 3), ac = a % 3, br = Math.floor(b / 3), bc = b % 3;
        if (Math.abs(ar - br) + Math.abs(ac - bc) !== 1 || regions[ar][ac] === regions[br][bc]) continue;
        edges.push({ a, b, pair: [regions[ar][ac], regions[br][bc]].sort().join(',') });
      }
    }
    const pairs = new Set(edges.map(edge => edge.pair)).size;
    const expected = new Map();
    for (let mask = 0; mask < 2 ** edges.length; mask++) {
      const chosen = edges.filter((_, i) => mask & (1 << i));
      if (chosen.length !== pairs || new Set(chosen.map(edge => edge.pair)).size !== pairs) continue;
      const cells = chosen.flatMap(edge => [edge.a, edge.b]);
      if (new Set(cells).size !== cells.length) continue;
      const rows = [0, 0, 0], cols = [0, 0, 0];
      for (const cell of cells) { rows[Math.floor(cell / 3)]++; cols[cell % 3]++; }
      const key = JSON.stringify({ rows, cols });
      expected.set(key, (expected.get(key) || 0) + 1);
    }
    assert.ok(expected.size > 0);
    for (const [key, count] of expected) {
      const puzzle = { regions, ...JSON.parse(key) };
      const result = solvePuzzle(puzzle);
      assert.equal(result.complete, true);
      assert.equal(result.solutions.length, Math.min(2, count));
      for (const solution of result.solutions) assert.equal(checkSolution(puzzle, solution), true);
    }
  }
});

test('300 generated puzzles have exactly one solution and nontrivial block layouts', () => {
  for (const size of [5, 7, 9]) {
    for (let seed = 0; seed < 100; seed++) {
      const puzzle = generatePuzzle(size, seededRandom(seed));
      assert.equal(puzzle.regions.length, size);
      assert.ok(puzzle.regions.every(row => row.length === size));
      checkRegionShapes(puzzle.regions);
      const result = solvePuzzle(puzzle);
      assert.equal(result.complete, true);
      assert.equal(result.solutions.length, 1, `size=${size}, seed=${seed}`);
      assert.ok(result.solutions[0].length >= 4);
      assert.equal(checkSolution(puzzle, result.solutions[0]), true);
    }
  }
});

test('all fallback rotations and reflections remain unique', () => {
  for (const size of [5, 7, 9]) {
    for (let rotation = 0; rotation < 4; rotation++) {
      for (const flip of [0, 0.9]) {
        let call = 0;
        const puzzle = fallbackPuzzle(size, () => call++ === 0 ? rotation / 4 : flip);
        checkRegionShapes(puzzle.regions);
        const result = solvePuzzle(puzzle);
        assert.equal(result.complete, true);
        assert.equal(result.solutions.length, 1);
        assert.equal(checkSolution(puzzle, result.solutions[0]), true);
      }
    }
  }
});

test('daily puzzles repeat and constant RNGs terminate safely', () => {
  assert.deepEqual(dailyPuzzle('2026-09-24'), dailyPuzzle('2026-09-24'));
  for (const value of [0, 0.5, 0.999999]) {
    const puzzle = generatePuzzle(9, () => value);
    checkRegionShapes(puzzle.regions);
    const result = solvePuzzle(puzzle);
    assert.equal(result.complete, true);
    assert.equal(result.solutions.length, 1);
  }
  assert.throws(() => generatePuzzle(2), RangeError);
});
