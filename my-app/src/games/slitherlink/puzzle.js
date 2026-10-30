import { scheduledDifficulty } from '../../utils/dailySchedule.js';

// Slitherlink: draw one closed loop along the grid lines between the dots.
// A number in a square says how many of its four sides the loop uses. The
// loop never crosses or touches itself.
//
// A puzzle is { rows, cols, clues }: clues[r * cols + c] is 0-3, or -1 for
// a square without a number. Edges are numbered: first the horizontal ones,
// row by row ((rows + 1) * cols of them), then the vertical ones
// (rows * (cols + 1)). Dots are numbered r * (cols + 1) + c.

export const PRACTICE_SIZES = [5, 6, 7, 8, 10];
// Daily board side by spice level: Mild 6, Medium 8, Picante 10.
export const DAILY_SIZES = [6, 8, 10];
export const dailyLevel = date => scheduledDifficulty('slitherlink', date);
export const dailySize = date => DAILY_SIZES[dailyLevel(date) - 1];

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

// ----- Board geometry (cached per size) -----

const geometryCache = new Map();
export function geometry(rows, cols) {
  const key = `${rows}x${cols}`;
  if (geometryCache.has(key)) return geometryCache.get(key);
  const H = (rows + 1) * cols, E = H + rows * (cols + 1), V = (rows + 1) * (cols + 1);
  const ends = [], vertexEdges = Array.from({ length: V }, () => []), cellEdges = [], edgeCells = Array.from({ length: E }, () => []);
  for (let r = 0; r <= rows; r++) for (let c = 0; c < cols; c++) ends.push([r * (cols + 1) + c, r * (cols + 1) + c + 1]);
  for (let r = 0; r < rows; r++) for (let c = 0; c <= cols; c++) ends.push([r * (cols + 1) + c, (r + 1) * (cols + 1) + c]);
  ends.forEach(([a, b], e) => { vertexEdges[a].push(e); vertexEdges[b].push(e); });
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const edges = [r * cols + c, (r + 1) * cols + c, H + r * (cols + 1) + c, H + r * (cols + 1) + c + 1];
    cellEdges.push(edges);
    edges.forEach(e => edgeCells[e].push(r * cols + c));
  }
  const g = { rows, cols, H, E, V, ends, vertexEdges, cellEdges, edgeCells };
  geometryCache.set(key, g);
  return g;
}
export const hEdge = (cols, r, c) => r * cols + c;
export const vEdge = (rows, cols, r, c) => (rows + 1) * cols + r * (cols + 1) + c;

// ----- Checking a player's lines -----

// How the lines stand: each clue's state ('met', 'over' or ''), dots with
// three or four lines ('branch'), and whether it's solved: one loop, every
// clue met.
// `crosses` only affects how a 0 looks: it shows as done once all four of its
// sides are crossed off (rather than from the start).
export function evaluateBoard(puzzle, lines, crosses = null) {
  const g = geometry(puzzle.rows, puzzle.cols);
  const on = new Uint8Array(g.E);
  for (const e of lines) on[e] = 1;
  const crossed = crosses && new Set(crosses);
  const counts = puzzle.clues.map((clue, cell) => g.cellEdges[cell].reduce((sum, e) => sum + on[e], 0));
  const clueState = puzzle.clues.map((clue, cell) => {
    if (clue < 0) return '';
    const count = counts[cell];
    if (count > clue) return 'over';
    if (count < clue) return '';
    return clue === 0 && crossed && !g.cellEdges[cell].every(e => crossed.has(e)) ? '' : 'met';
  });
  const degree = new Uint8Array(g.V);
  for (const e of lines) { degree[g.ends[e][0]]++; degree[g.ends[e][1]]++; }
  const branches = [];
  for (let v = 0; v < g.V; v++) if (degree[v] > 2) branches.push(v);
  const cluesMet = puzzle.clues.every((clue, cell) => clue < 0 || counts[cell] === clue);
  const won = cluesMet && lines.length > 0 && !branches.length && isSingleLoop(g, lines, degree);
  return { clueState, branches, won };
}

function isSingleLoop(g, lines, degree) {
  for (const e of lines) for (const v of g.ends[e]) if (degree[v] !== 2) return false;
  // Walk from one line and count the lines visited.
  const on = new Set(lines);
  const start = lines[0];
  let [prev, v] = g.ends[start];
  let edge = start, steps = 1;
  while (v !== prev || steps === 1) {
    const next = g.vertexEdges[v].find(e => e !== edge && on.has(e));
    if (next === undefined) return false;
    if (next === start) break;
    edge = next;
    v = g.ends[next][0] === v ? g.ends[next][1] : g.ends[next][0];
    steps++;
    if (steps > lines.length) return false;
  }
  return steps === lines.length;
}

// ----- The solver: logic a person can follow -----

const UNKNOWN = 0, ON = 1, OFF = 2;

// Applies the basic rules until nothing changes: a clue with all its lines
// (or all its crosses) fills in the rest; a dot has 0 or 2 lines; a line
// that would close a loop early is crossed off. Returns false on a
// contradiction. `state` is changed in place.
function propagate(puzzle, g, state) {
  for (let changed = true; changed;) {
    changed = false;
    for (let cell = 0; cell < puzzle.clues.length; cell++) {
      const clue = puzzle.clues[cell];
      if (clue < 0) continue;
      const edges = g.cellEdges[cell];
      let on = 0, unknown = 0;
      for (const e of edges) { if (state[e] === ON) on++; else if (state[e] === UNKNOWN) unknown++; }
      if (on > clue || on + unknown < clue) return false;
      if (!unknown) continue;
      if (on === clue) { for (const e of edges) if (state[e] === UNKNOWN) state[e] = OFF; changed = true; }
      else if (on + unknown === clue) { for (const e of edges) if (state[e] === UNKNOWN) state[e] = ON; changed = true; }
    }
    for (let v = 0; v < g.V; v++) {
      const edges = g.vertexEdges[v];
      let on = 0, unknown = 0, last = -1;
      for (const e of edges) { if (state[e] === ON) on++; else if (state[e] === UNKNOWN) { unknown++; last = e; } }
      if (on > 2 || (on === 1 && !unknown)) return false;
      if (!unknown) continue;
      if (on === 2 || (on === 0 && unknown === 1)) { for (const e of edges) if (state[e] === UNKNOWN) state[e] = OFF; changed = true; }
      else if (on === 1 && unknown === 1) { state[last] = ON; changed = true; }
    }
    const loop = loopCheck(puzzle, g, state);
    if (loop === false) return false;
    if (loop) changed = true;
  }
  return true;
}

// Paths of lines so far: a line joining a path's two ends closes a loop,
// which is only allowed if it finishes the puzzle. Returns false on a
// contradiction, true if it crossed something off, null otherwise.
function loopCheck(puzzle, g, state) {
  const parent = Int32Array.from({ length: g.V }, (_, i) => i);
  const find = x => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const size = new Int32Array(g.V);
  let total = 0;
  for (let e = 0; e < g.E; e++) {
    if (state[e] !== ON) continue;
    total++;
    const [a, b] = g.ends[e];
    const ra = find(a), rb = find(b);
    if (ra === rb) {
      // A closed loop: fine only if it's the only lines and every clue is met.
      return closedLoopOk(puzzle, g, state, ra, find) ? null : false;
    }
    parent[ra] = rb;
  }
  for (let e = 0; e < g.E; e++) if (state[e] === ON) size[find(g.ends[e][0])]++;
  let crossed = false;
  for (let e = 0; e < g.E; e++) {
    if (state[e] !== UNKNOWN) continue;
    const [a, b] = g.ends[e];
    const root = find(a);
    if (root !== find(b) || !size[root]) continue;
    // Closing this path: allowed only if it holds every line and meets every clue.
    if (size[root] === total) {
      state[e] = ON;
      const done = puzzle.clues.every((clue, cell) => clue < 0 || g.cellEdges[cell].reduce((n, x) => n + (state[x] === ON), 0) === clue);
      state[e] = UNKNOWN;
      if (done) continue;
    }
    state[e] = OFF; crossed = true;
  }
  return crossed || null;
}

function closedLoopOk(puzzle, g, state, root, find) {
  for (let e = 0; e < g.E; e++) if (state[e] === ON && find(g.ends[e][0]) !== root) return false;
  return puzzle.clues.every((clue, cell) => clue < 0 || g.cellEdges[cell].reduce((n, x) => n + (state[x] === ON), 0) === clue);
}

// Solves with the basic rules, then (if allowed) "what if" trials: try a line
// one way, and if the basic rules hit a contradiction, it must go the other
// way. Returns { state, solved, trials } (trials = how many were needed).
export function solve(puzzle, { maxTrials = Infinity } = {}) {
  const g = geometry(puzzle.rows, puzzle.cols);
  const state = new Uint8Array(g.E);
  if (!propagate(puzzle, g, state)) return { state, solved: false, broken: true, trials: 0 };
  let trials = 0;
  while (state.includes(UNKNOWN) && trials < maxTrials) {
    let progress = false;
    for (let e = 0; e < g.E && !progress; e++) {
      if (state[e] !== UNKNOWN || !worthTrying(g, state, e)) continue;
      for (const guess of [ON, OFF]) {
        const copy = state.slice();
        copy[e] = guess;
        if (!propagate(puzzle, g, copy)) {
          state[e] = guess === ON ? OFF : ON;
          trials++;
          if (!propagate(puzzle, g, state)) return { state, solved: false, broken: true, trials };
          progress = true;
          break;
        }
      }
    }
    if (!progress) break;
  }
  const solved = !state.includes(UNKNOWN) && evaluateBoard(puzzle, linesOf(state)).won;
  return { state, solved, trials };
}
// Trials near what's already known are the ones a person would try.
function worthTrying(g, state, e) {
  for (const v of g.ends[e]) for (const x of g.vertexEdges[v]) if (x !== e && state[x] === ON) return true;
  return g.edgeCells[e].length > 0;
}
export const linesOf = state => { const out = []; state.forEach((s, e) => { if (s === ON) out.push(e); }); return out; };

// ----- Making puzzles -----

// A random loop: the outline of a blob of squares grown one at a time. The
// blob stays in one piece, never wraps around a hole, and never touches
// itself at a corner, so its outline is one simple loop.
function randomLoopCells(rows, cols, rng) {
  const inside = new Uint8Array(rows * cols);
  const at = (r, c) => r >= 0 && r < rows && c >= 0 && c < cols && inside[r * cols + c] === 1;
  const start = Math.floor(rng() * rows) * cols + Math.floor(rng() * cols);
  inside[start] = 1;
  let count = 1;
  const target = Math.floor(rows * cols * (0.45 + rng() * 0.15));
  for (let attempts = 0; count < target && attempts < rows * cols * 60; attempts++) {
    const cell = Math.floor(rng() * rows * cols);
    if (inside[cell]) continue;
    const r = Math.floor(cell / cols), c = cell % cols;
    const n = [at(r - 1, c), at(r, c + 1), at(r + 1, c), at(r, c - 1)];
    if (!n.some(Boolean)) continue;
    // Going round the 8 neighbours, the inside squares must form one run
    // (no holes, no pinches), with corners only counting next to a side.
    const ring = [at(r - 1, c), at(r - 1, c + 1), at(r, c + 1), at(r + 1, c + 1), at(r + 1, c), at(r + 1, c - 1), at(r, c - 1), at(r - 1, c - 1)];
    for (const k of [1, 3, 5, 7]) if (ring[k] && !ring[k - 1] && !ring[(k + 1) % 8]) ring[k] = 'pinch';
    if (ring.includes('pinch')) continue;
    let runs = 0;
    for (let k = 0; k < 8; k++) if (ring[k] && !ring[(k + 7) % 8]) runs++;
    if (runs !== 1) continue;
    inside[cell] = 1; count++;
  }
  return inside;
}

export function loopFromCells(rows, cols, inside) {
  const g = geometry(rows, cols);
  const lines = [];
  for (let e = 0; e < g.E; e++) {
    const cells = g.edgeCells[e];
    const insideCount = cells.reduce((n, cell) => n + inside[cell], 0);
    if ((cells.length === 1 && insideCount === 1) || (cells.length === 2 && insideCount === 1)) lines.push(e);
  }
  return lines;
}

export function cluesFor(rows, cols, lines) {
  const g = geometry(rows, cols);
  const on = new Uint8Array(g.E);
  for (const e of lines) on[e] = 1;
  return g.cellEdges.map(edges => edges.reduce((n, e) => n + on[e], 0));
}

// Levels: 1 (Mild) basic rules only, a fair number of clues; 2 (Medium)
// basic rules, fewer clues; 3 (Picante) needs some "what if" trials.
const PICANTE_TRIALS = 12;
export function generatePuzzle(rows, cols, seed, level = 2) {
  const rng = seededRandom(seed);
  for (let attempt = 0; attempt < 40; attempt++) {
    const solution = loopFromCells(rows, cols, randomLoopCells(rows, cols, rng));
    const full = cluesFor(rows, cols, solution);
    const clues = [...full];
    const allowTrials = level === 3;
    // Picante allows a limited number of trials, so it stays fair.
    const ok = puzzle => solve(puzzle, { maxTrials: allowTrials ? PICANTE_TRIALS : 0 }).solved;
    // Take numbers away in random order while it still solves by logic.
    const order = clues.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    // Mild keeps about a third of the numbers it could drop.
    const keepChance = level === 1 ? 0.3 : 0;
    for (const cell of order) {
      if (rng() < keepChance) continue;
      const before = clues[cell];
      clues[cell] = -1;
      if (!ok({ rows, cols, clues })) clues[cell] = before;
    }
    const puzzle = { rows, cols, clues };
    if (!ok(puzzle)) continue;
    if (level === 3 && solve(puzzle, { maxTrials: 0 }).solved && attempt < 39) continue;
    return { ...puzzle, solution };
  }
  // Practically unreachable: every number shown.
  const solution = loopFromCells(rows, cols, randomLoopCells(rows, cols, rng));
  return { rows, cols, clues: cluesFor(rows, cols, solution), solution };
}

export const dailyPuzzle = date => {
  const size = dailySize(date);
  return generatePuzzle(size, size, `slitherlink-v1:${date}`, dailyLevel(date));
};
