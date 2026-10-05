import { scheduledDifficulty } from '../../utils/dailySchedule.js';

// Skeedle Beadle: bead sort. Sticks hold CAPACITY beads, listed bottom to top.
export const CAPACITY = 4;
export const LEVELS = {
  1: { label: 'Mild', colors: 6, empty: 2, minMoves: 17 },
  2: { label: 'Medium', colors: 8, empty: 2, minMoves: 25 },
  3: { label: 'Picante', colors: 10, empty: 2, minMoves: 31 },
};
export const dailyLevel = date => scheduledDifficulty('skeedle-beadle', date);

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

const top = stick => stick[stick.length - 1];

// Length of the same-color run at the top of a stick.
export function topRun(stick) {
  if (!stick.length) return 0;
  let run = 1;
  while (run < stick.length && stick[stick.length - 1 - run] === top(stick)) run++;
  return run;
}

export const isSolvedStick = stick => stick.length === 0 || (stick.length === CAPACITY && stick.every(color => color === stick[0]));
export const isSolved = sticks => sticks.every(isSolvedStick);

// Why a slide is not allowed, or null when it is.
export function slideProblem(sticks, from, to) {
  const source = sticks[from], target = sticks[to];
  if (from === to) return 'same';
  if (!source?.length) return 'empty';
  if (!target || target.length >= CAPACITY) return 'full';
  if (target.length && top(target) !== top(source)) return 'color';
  return null;
}

// Pour as many matching beads from the top of `from` as fit into `to`.
export function slide(sticks, from, to) {
  if (slideProblem(sticks, from, to)) return null;
  const amount = Math.min(topRun(sticks[from]), CAPACITY - sticks[to].length);
  const next = sticks.map(stick => stick.slice());
  for (let i = 0; i < amount; i++) next[to].push(next[from].pop());
  return { sticks: next, amount };
}

// Moves worth considering. Leaves out moves that can never help: moving a
// finished stick, or emptying a single-color stick into an empty stick.
export function usefulMoves(sticks) {
  const moves = [];
  sticks.forEach((source, from) => {
    if (!source.length || isSolvedStick(source)) return;
    const uniform = topRun(source) === source.length;
    let emptyTried = false;
    sticks.forEach((target, to) => {
      if (slideProblem(sticks, from, to)) return;
      if (!target.length) {
        if (uniform || emptyTried) return; // empty sticks are interchangeable
        emptyTried = true;
      }
      moves.push([from, to]);
    });
  });
  return moves;
}

const keyOf = sticks => sticks.map(stick => stick.join(',')).sort().join('|');
// Lower bound-ish estimate: extra color runs plus colors not yet gathered.
function estimate(sticks) {
  let segments = 0;
  const colorsSeen = new Set();
  for (const stick of sticks) {
    for (let i = 0; i < stick.length; i++) if (i === 0 || stick[i] !== stick[i - 1]) segments++;
    stick.forEach(color => colorsSeen.add(color));
  }
  return segments - colorsSeen.size;
}

// Best-first search for a solution from any position. Returns the move list
// ([from, to] pairs) or null when no solution was found within the budget.
export function solve(sticks, { maxStates = 60000 } = {}) {
  if (isSolved(sticks)) return [];
  const start = sticks.map(stick => stick.slice());
  const seen = new Set([keyOf(start)]);
  // Small binary heap keyed on (estimate * 2 + moves so far).
  const heap = [];
  const push = node => {
    heap.push(node);
    for (let i = heap.length - 1; i > 0;) {
      const parent = (i - 1) >> 1;
      if (heap[parent].f <= heap[i].f) break;
      [heap[parent], heap[i]] = [heap[i], heap[parent]]; i = parent;
    }
  };
  const popMin = () => {
    const best = heap[0], last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      for (let i = 0; ;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < heap.length && heap[l].f < heap[m].f) m = l;
        if (r < heap.length && heap[r].f < heap[m].f) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]]; i = m;
      }
    }
    return best;
  };
  push({ sticks: start, path: [], f: estimate(start) * 2, order: 0 });
  let order = 0;
  while (heap.length && seen.size < maxStates) {
    const node = popMin();
    for (const [from, to] of usefulMoves(node.sticks)) {
      const next = slide(node.sticks, from, to).sticks;
      const key = keyOf(next);
      if (seen.has(key)) continue;
      seen.add(key);
      const path = [...node.path, [from, to]];
      if (isSolved(next)) return path;
      push({ sticks: next, path, f: estimate(next) * 2 + path.length, order: ++order });
    }
  }
  return null;
}

// Removes back-and-forth and other wasted steps the search may leave in, by
// replaying the moves and dropping any that return to an earlier position.
export function tidyPath(sticks, path) {
  const states = [keyOf(sticks)], kept = [];
  let current = sticks;
  for (const move of path) {
    current = slide(current, ...move).sticks;
    const key = keyOf(current), earlier = states.indexOf(key);
    if (earlier >= 0) { kept.length = earlier; states.length = earlier + 1; continue; }
    kept.push(move); states.push(key);
  }
  return kept;
}

function shuffled(items, rng) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// A start is rejected when it gives too much away: a finished stick, or a stick
// already holding three of one color on top of each other.
function fairStart(sticks) {
  return sticks.every(stick => !stick.length || (!isSolvedStick(stick) && topRun(stick) < 3
    && !stick.some((color, i) => i >= 2 && color === stick[i - 1] && color === stick[i - 2])));
}

export function generatePuzzle(level, seed) {
  const config = LEVELS[level];
  if (!config) throw new RangeError('Skeedle Beadle levels are 1 (Mild), 2 (Medium) and 3 (Picante).');
  const rng = seededRandom(seed);
  let fallback = null;
  for (let attempt = 0; attempt < 60; attempt++) {
    const beads = shuffled(Array.from({ length: config.colors * CAPACITY }, (_, i) => Math.floor(i / CAPACITY)), rng);
    const sticks = Array.from({ length: config.colors }, (_, i) => beads.slice(i * CAPACITY, (i + 1) * CAPACITY))
      .concat(Array.from({ length: config.empty }, () => []));
    if (!fairStart(sticks)) continue;
    const path = solve(sticks, { maxStates: 40000 });
    if (!path) continue;
    const par = tidyPath(sticks, path).length;
    const puzzle = { level, sticks, par };
    if (par >= config.minMoves) return puzzle;
    if (!fallback || par > fallback.par) fallback = puzzle;
  }
  if (fallback) return fallback;
  throw new Error('Could not generate a solvable Skeedle Beadle puzzle.');
}

export const dailyPuzzle = date => generatePuzzle(dailyLevel(date), `skeedle-beadle-v1:${date}`);
