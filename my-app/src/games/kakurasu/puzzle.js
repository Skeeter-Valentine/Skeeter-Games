import { scheduledDifficulty } from '../../utils/dailySchedule.js';

// Kakurasu: shade squares so each row's shaded squares add up to its clue
// (counting a square by its column number, 1 to n) and each column's add up
// to its clue (counting by row number). A puzzle is { size, rows, cols }:
// rows[r] is the clue for row r, cols[c] the clue for column c. Squares are
// numbered r * size + c.

export const PRACTICE_SIZES = [4, 5, 6, 7, 8, 9];
// Daily board side by spice level: Mild 5, Medium 6, Picante 8.
export const dailySize = date => [5, 6, 8][scheduledDifficulty('kakurasu', date) - 1];

export function seededRandom(seed) {
  let state = 2166136261;
  for (const char of String(seed)) state = Math.imul(state ^ char.charCodeAt(0), 16777619);
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The clues for a set of shaded squares.
export function cluesFor(size, shaded) {
  const rows = Array(size).fill(0), cols = Array(size).fill(0);
  for (const id of shaded) {
    const r = Math.floor(id / size), c = id % size;
    rows[r] += c + 1;
    cols[c] += r + 1;
  }
  return { rows, cols };
}

// How each row and column stands against its clue: 'met', 'over' or ''.
export function evaluateBoard(puzzle, shaded) {
  const sums = cluesFor(puzzle.size, shaded);
  const state = (have, want) => have === want ? 'met' : have > want ? 'over' : '';
  const rows = sums.rows.map((sum, r) => state(sum, puzzle.rows[r]));
  const cols = sums.cols.map((sum, c) => state(sum, puzzle.cols[c]));
  return { sums, rows, cols, won: [...rows, ...cols].every(value => value === 'met') };
}

// Every way to pick positions (bit i = position i + 1) adding up to `sum`.
const optionCache = new Map();
export function lineOptions(size, sum) {
  const key = `${size}:${sum}`;
  if (!optionCache.has(key)) {
    const list = [];
    for (let mask = 0; mask < 1 << size; mask++) {
      let total = 0;
      for (let i = 0; i < size; i++) if (mask >> i & 1) total += i + 1;
      if (total === sum) list.push(mask);
    }
    optionCache.set(key, list);
  }
  return optionCache.get(key);
}

const lineCells = (size, kind, index) => Array.from({ length: size }, (_, i) => kind === 'row' ? index * size + i : i * size + index);

// Line logic, as a person would do it: for one row or column at a time,
// find every way to make its clue that fits what's known, and keep what they
// all agree on. Returns { grid, steps, rounds, solved }: grid holds 1
// (shaded), 2 (empty) or 0 (unknown); each step is { kind, index, shade,
// clear } for one line that taught something new; rounds counts passes over
// the whole board (more passes, harder puzzle).
export function solveByLines(puzzle, { maxSteps = Infinity } = {}) {
  const { size } = puzzle;
  const grid = Array(size * size).fill(0);
  const steps = [];
  let rounds = 0;
  for (let changed = true; changed && steps.length < maxSteps;) {
    changed = false;
    rounds++;
    for (const kind of ['row', 'col']) {
      for (let index = 0; index < size && steps.length < maxSteps; index++) {
        const cells = lineCells(size, kind, index);
        const clue = (kind === 'row' ? puzzle.rows : puzzle.cols)[index];
        const fits = lineOptions(size, clue).filter(mask => cells.every((id, i) =>
          !grid[id] || (grid[id] === 1) === !!(mask >> i & 1)));
        if (!fits.length) return { grid, steps, rounds, solved: false, broken: true };
        const all = fits.reduce((acc, mask) => acc & mask, (1 << size) - 1);
        const any = fits.reduce((acc, mask) => acc | mask, 0);
        const shade = cells.filter((id, i) => !grid[id] && all >> i & 1);
        const clear = cells.filter((id, i) => !grid[id] && !(any >> i & 1));
        if (!shade.length && !clear.length) continue;
        shade.forEach(id => { grid[id] = 1; });
        clear.forEach(id => { grid[id] = 2; });
        steps.push({ kind, index, clue, shade, clear });
        changed = true;
      }
    }
  }
  return { grid, steps, rounds, solved: grid.every(Boolean) };
}

// Exact count of solutions (stopping at `limit`), for tests and checks.
export function countSolutions(puzzle, limit = 2) {
  const { size, rows, cols } = puzzle;
  const left = [...cols];
  let count = 0;
  // Sums the rows from r on can still add to a column: reach[r] bit s = sum s.
  const reach = Array.from({ length: size + 1 }, () => 0n);
  reach[size] = 1n;
  for (let r = size - 1; r >= 0; r--) reach[r] = reach[r + 1] | (reach[r + 1] << BigInt(r + 1));
  const search = r => {
    if (count >= limit) return;
    if (r === size) { if (left.every(value => value === 0)) count++; return; }
    for (const mask of lineOptions(size, rows[r])) {
      let ok = true;
      for (let c = 0; c < size; c++) if (mask >> c & 1) left[c] -= r + 1;
      for (let c = 0; c < size && ok; c++) if (left[c] < 0 || !(reach[r + 1] >> BigInt(left[c]) & 1n)) ok = false;
      if (ok) search(r + 1);
      for (let c = 0; c < size; c++) if (mask >> c & 1) left[c] += r + 1;
      if (count >= limit) return;
    }
  };
  search(0);
  return count;
}

// A puzzle with one answer that line logic alone solves. Every row and
// column has at least one shaded square (no 0 clues). With `pick` > 1 it
// draws that many and keeps the one needing the most passes.
export function generatePuzzle(size, seed, pick = 1) {
  const rng = seededRandom(seed);
  let best = null, bestRounds = -1;
  for (let attempt = 0, found = 0; attempt < 3000 && found < pick; attempt++) {
    const density = 0.42 + rng() * 0.16;
    const shaded = [];
    for (let id = 0; id < size * size; id++) if (rng() < density) shaded.push(id);
    const puzzle = { size, ...cluesFor(size, shaded) };
    if ([...puzzle.rows, ...puzzle.cols].includes(0)) continue;
    const result = solveByLines(puzzle);
    if (!result.solved) continue;
    found++;
    if (result.rounds > bestRounds) { best = puzzle; bestRounds = result.rounds; }
  }
  if (best) return best;
  // Bounded fallback (practically unreachable): a staircase, which line
  // logic always solves.
  const shaded = Array.from({ length: size }, (_, i) => i * size + i);
  return { size, ...cluesFor(size, shaded) };
}

// Harder days also pick the trickiest of several boards.
const DAILY_PICK = [1, 6, 20];
export const dailyPuzzle = date => generatePuzzle(dailySize(date), `kakurasu-v1:${date}`, DAILY_PICK[scheduledDifficulty('kakurasu', date) - 1]);
