import assert from 'node:assert/strict';
import test from 'node:test';
import { countSolutions } from './solver.js';
import { generateUniquePuzzle, getDailyGridSize, getDailySeed, mulberry32, mergeSmallRectangles } from './puzzle.js';

test('small rectangles can merge with larger neighbors regardless of input order', () => {
  for (const reverse of [false, true]) {
    const neighbors = [
      { r1: 0, r2: 1, c1: 0, c2: 2, area: 6 },
      { r1: 0, r2: 1, c1: 3, c2: 3, area: 2 },
    ];
    if (reverse) neighbors.reverse();
    const rects = [...neighbors,
      { r1: 3, r2: 3, c1: 0, c2: 5, area: 6 },
      { r1: 5, r2: 5, c1: 0, c2: 5, area: 6 },
    ];
    mergeSmallRectangles(rects, () => 0);
    assert.equal(rects.length, 3);
    assert.ok(rects.some(rect => rect.area === 8));
    assert.equal(rects.reduce((sum, rect) => sum + rect.area, 0), 20);
  }
});

test('does not merge partial sides into L shapes or across gaps', () => {
  const rects = [
    { r1: 0, r2: 0, c1: 0, c2: 1, area: 2 },
    { r1: 1, r2: 1, c1: 0, c2: 2, area: 3 },
    { r1: 4, r2: 4, c1: 0, c2: 5, area: 6 },
    { r1: 6, r2: 6, c1: 0, c2: 5, area: 6 },
  ];
  const original = structuredClone(rects);
  mergeSmallRectangles(rects, () => 0);
  assert.deepEqual(rects, original);
});

test('merges beyond ten pairs while preserving coverage and limiting region sizes', () => {
  const rects = [];
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c += 2) rects.push({ r1: r, r2: r, c1: c, c2: c + 1, area: 2 });
  }
  mergeSmallRectangles(rects, mulberry32(42));
  assert.ok(rects.length < 40);
  assert.ok(rects.filter(rect => rect.area <= 4).length / rects.length <= 0.20);
  const covered = new Set();
  for (const rect of rects) {
    assert.ok(rect.area <= 12);
    for (let r = rect.r1; r <= rect.r2; r++) {
      for (let c = rect.c1; c <= rect.c2; c++) {
        const key = `${r},${c}`;
        assert.equal(covered.has(key), false);
        covered.add(key);
      }
    }
  }
  assert.equal(covered.size, 100);
});

// Independent tiny-board oracle: enumerate rectangles rooted at the first
// uncovered cell, rather than enumerating placements around each clue.
function bruteCount(clues) {
  const height = clues.length, width = clues[0].length;
  const occupied = Array(height * width).fill(false);
  function visit() {
    const first = occupied.indexOf(false);
    if (first === -1) return 1;
    const top = Math.floor(first / width), left = first % width;
    let count = 0;
    for (let bottom = top; bottom < height; bottom++) {
      for (let right = left; right < width; right++) {
        const cells = [], numbers = [];
        for (let r = top; r <= bottom; r++) {
          for (let c = left; c <= right; c++) {
            cells.push(r * width + c);
            if (clues[r][c]) numbers.push(clues[r][c]);
          }
        }
        if (numbers.length !== 1 || numbers[0] !== cells.length || cells.some(i => occupied[i])) continue;
        cells.forEach(i => { occupied[i] = true; });
        count += visit();
        cells.forEach(i => { occupied[i] = false; });
      }
    }
    return count;
  }
  return visit();
}

test('distinguishes unique, ambiguous, impossible, and incomplete searches', () => {
  assert.equal(countSolutions([[2, 0], [2, 0]]), 1);
  assert.equal(countSolutions([[2, 0], [0, 2]]), 2);
  assert.equal(countSolutions([[3, 0], [0, 1]]), 0);
  assert.equal(countSolutions([[4, 0], [0, 0]]), 1);
  assert.equal(countSolutions([[2, 0], [2, 0]], 0), null);
  assert.equal(countSolutions([[0, 0], [0, 0]]), 0);
});

test('matches exhaustive rectangle enumeration on all 462 area-balanced 2x3 clue grids', () => {
  let checked = 0;
  function assign(values, remaining) {
    if (values.length === 5) {
      const cells = [...values, remaining];
      const clues = [cells.slice(0, 3), cells.slice(3)];
      assert.equal(countSolutions(clues), Math.min(2, bruteCount(clues)), JSON.stringify(clues));
      checked++;
      return;
    }
    for (let value = 0; value <= remaining; value++) assign([...values, value], remaining - value);
  }
  assign([], 6);
  assert.equal(checked, 462);
});

function checkPuzzle({ clues, rects }, size) {
  assert.equal(clues.length, size);
  assert.ok(clues.every(row => row.length === size));
  const covered = Array(size * size).fill(false);
  for (const rect of rects) {
    assert.ok(rect.r1 >= 0 && rect.c1 >= 0 && rect.r2 < size && rect.c2 < size);
    const area = (rect.r2 - rect.r1 + 1) * (rect.c2 - rect.c1 + 1);
    assert.ok(area >= 2); // The UI does not place single-cell rectangles.
    const numbers = [];
    for (let r = rect.r1; r <= rect.r2; r++) {
      for (let c = rect.c1; c <= rect.c2; c++) {
        assert.equal(covered[r * size + c], false);
        covered[r * size + c] = true;
        if (clues[r][c]) numbers.push(clues[r][c]);
      }
    }
    assert.deepEqual(numbers, [area]);
  }
  assert.ok(covered.every(Boolean));
  assert.equal(countSolutions(clues), 1);
}

test('all five supported sizes produce unique puzzles across 100 seeds each', () => {
  for (const size of [5, 7, 10, 15, 20]) {
    for (let seed = 0; seed < 100; seed++) {
      checkPuzzle(generateUniquePuzzle(size, mulberry32(seed)), size);
    }
  }
});

test('daily size and puzzle remain repeatable', () => {
  const date = '2026-09-24';
  const size = getDailyGridSize(date);
  assert.ok([5, 7, 10, 15, 20].includes(size));
  assert.deepEqual(
    generateUniquePuzzle(size, mulberry32(getDailySeed(date))),
    generateUniquePuzzle(size, mulberry32(getDailySeed(date))),
  );
});

test('constant random sources still terminate with unique playable puzzles', () => {
  for (const value of [0, 0.5, 0.999999]) {
    checkPuzzle(generateUniquePuzzle(20, () => value), 20);
  }
});
