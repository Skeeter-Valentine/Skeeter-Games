import { scheduledDifficulty } from '../../utils/dailySchedule.js';

// Daily board side by spice level: Mild 5, Medium 7, Picante 11. Picante was
// 9 × 9 before PICANTE_11_FROM; earlier dates keep 9 × 9 so archive puzzles and
// their community results never change.
export const PICANTE_11_FROM = '2026-10-11';
export const dailySize = date => {
  const level = scheduledDifficulty('akari', date);
  return level === 3 ? (date >= PICANTE_11_FROM ? 11 : 9) : [5, 7][level - 1];
};

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

export function neighbors(size, id) {
  const r = Math.floor(id / size), c = id % size;
  return [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]
    .filter(([rr, cc]) => rr >= 0 && cc >= 0 && rr < size && cc < size)
    .map(([rr, cc]) => rr * size + cc);
}

export function visibleCells({ size, cells }, id) {
  if (cells[id] !== null) return [];
  const visible = [id], row = Math.floor(id / size), col = id % size;
  for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    for (let r = row + dr, c = col + dc; r >= 0 && c >= 0 && r < size && c < size; r += dr, c += dc) {
      const next = r * size + c;
      if (cells[next] !== null) break;
      visible.push(next);
    }
  }
  return visible;
}

export function evaluateBoard(puzzle, bulbs) {
  const selected = new Set(bulbs), lit = new Set(), conflicts = new Set();
  const valid = bulbs.length === selected.size && bulbs.every(id => Number.isInteger(id) && id >= 0 && id < puzzle.cells.length && puzzle.cells[id] === null);
  for (const id of selected) {
    for (const cell of visibleCells(puzzle, id)) {
      lit.add(cell);
      if (cell !== id && selected.has(cell)) { conflicts.add(id); conflicts.add(cell); }
    }
  }
  const clues = {};
  puzzle.cells.forEach((cell, id) => {
    if (cell !== null && cell >= 0) {
      const count = neighbors(puzzle.size, id).filter(next => selected.has(next)).length;
      clues[id] = count === cell ? 'met' : count > cell ? 'over' : 'incomplete';
    }
  });
  const whiteCount = puzzle.cells.filter(cell => cell === null).length;
  return { lit, conflicts, clues, whiteCount,
    won: valid && whiteCount > 0 && lit.size === whiteCount && !conflicts.size && Object.values(clues).every(value => value === 'met') };
}

// Boolean constraint solver: white cells must see a bulb, row/column runs
// allow at most one bulb, and numbered walls require exact adjacent counts.
export function solvePuzzle(puzzle, { limit = 2, maxNodes = 20000 } = {}) {
  const { size, cells } = puzzle;
  const whites = cells.flatMap((cell, id) => cell === null ? [id] : []);
  const constraints = [];
  const add = (ids, min, max) => constraints.push({ ids, min, max });
  whites.forEach(id => add(visibleCells(puzzle, id), 1, size * 2));
  for (let line = 0; line < size; line++) for (const vertical of [false, true]) {
    let run = [];
    for (let offset = 0; offset <= size; offset++) {
      const id = vertical ? offset * size + line : line * size + offset;
      if (offset < size && cells[id] === null) run.push(id);
      else { if (run.length) add(run, 0, 1); run = []; }
    }
  }
  cells.forEach((cell, id) => {
    if (cell !== null && cell >= 0) add(neighbors(size, id).filter(next => cells[next] === null), cell, cell);
  });
  const solutions = [];
  let nodes = 0, complete = true;
  function search(state) {
    if (solutions.length >= limit) return;
    if (++nodes > maxNodes) { complete = false; return; }
    let changed = true;
    while (changed) {
      changed = false;
      for (const { ids, min, max } of constraints) {
        const chosen = ids.filter(id => state[id] === 1).length;
        const unknown = ids.filter(id => state[id] === -1);
        if (chosen > max || chosen + unknown.length < min) return;
        if (unknown.length && (chosen === max || chosen + unknown.length === min)) {
          const value = chosen === max ? 0 : 1;
          unknown.forEach(id => { state[id] = value; });
          changed = true;
        }
      }
    }
    const unresolved = whites.filter(id => state[id] === -1);
    if (!unresolved.length) { solutions.push(whites.filter(id => state[id] === 1)); return; }
    // Branch on a cell in the tightest still-unsatisfied constraint.
    let candidates = unresolved;
    for (const { ids, min } of constraints) {
      if (ids.filter(id => state[id] === 1).length >= min) continue;
      const unknown = ids.filter(id => state[id] === -1);
      if (unknown.length && unknown.length < candidates.length) candidates = unknown;
    }
    const id = candidates[0];
    for (const value of [1, 0]) {
      const next = state.slice(); next[id] = value; search(next);
      if (!complete || solutions.length >= limit) break;
    }
  }
  search(cells.map(cell => cell === null ? -1 : 0));
  return { solutions, complete, nodes };
}

function shuffled(items, rng) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Board sides offered in practice. Daily sizes are set by dailySize above.
export const PRACTICE_SIZES = [5, 7, 9, 11, 13];

export function generatePuzzle(size, seed) {
  if (!PRACTICE_SIZES.includes(size)) throw new RangeError(`Akari supports ${PRACTICE_SIZES.join(', ')} cell sides.`);
  const rng = seededRandom(seed);
  for (let attempt = 0; attempt < 100; attempt++) {
    const cells = Array.from({ length: size * size }, () => rng() < 0.28 ? -1 : null);
    const puzzle = { size, cells };
    const whites = cells.flatMap((cell, id) => cell === null ? [id] : []);
    if (whites.length < size * size * 0.55) continue;
    const bulbs = new Set(), lit = new Set();
    for (const id of shuffled(whites, rng)) {
      if (lit.has(id)) continue;
      bulbs.add(id);
      visibleCells(puzzle, id).forEach(cell => lit.add(cell));
    }
    cells.forEach((cell, id) => {
      if (cell !== null) cells[id] = neighbors(size, id).filter(next => bulbs.has(next)).length;
    });
    const result = solvePuzzle(puzzle, { maxNodes: 5000 });
    if (!result.complete || result.solutions.length !== 1) continue;
    // Remove redundant wall numbers while retaining a provably unique answer.
    for (const id of shuffled(cells.flatMap((cell, id) => cell !== null ? [id] : []), rng)) {
      const clue = cells[id]; cells[id] = -1;
      const reduced = solvePuzzle(puzzle, { maxNodes: 3000 });
      if (!reduced.complete || reduced.solutions.length !== 1) cells[id] = clue;
    }
    return puzzle;
  }
  // Bounded fallback: isolated white cells, each forced by adjacent numbers.
  const cells = Array.from({ length: size * size }, (_, id) =>
    Math.floor(id / size) % 2 === 0 && id % size % 2 === 0 ? null : -1);
  cells.forEach((cell, id) => {
    if (cell !== null) cells[id] = neighbors(size, id).filter(next => cells[next] === null).length;
  });
  return { size, cells };
}

export const dailyPuzzle = date => generatePuzzle(dailySize(date), `akari-v1:${date}`);
