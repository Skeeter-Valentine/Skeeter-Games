// Pepper Placer: a Star Battle puzzle with peppers. Place the given number of
// peppers (1, 2 or 3) in every row, every column and every outlined patch,
// with no two peppers touching, not even diagonally.
//
// A puzzle is { size, peppers, regions } where regions[r][c] is the patch
// number of each cell. Every generated puzzle has exactly one solution.

// Spice levels. Every puzzle can be solved with the steps in solvesLogically,
// no guessing. Mild needs only the simplest step: every move is a square next
// to a pepper, or the last open square of a row, column or patch.
export const LEVELS = {
  1: { peppers: 1, size: 6, techniques: 'basic', label: 'Mild · 1 pepper · 6 × 6' },
  2: { peppers: 1, size: 8, techniques: 'full', label: 'Medium · 1 pepper · 8 × 8' },
  3: { peppers: 2, size: 9, techniques: 'full', label: 'Picante · 2 peppers · 9 × 9' },
};

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function seedFrom(text) {
  let hash = 2166136261;
  for (const char of String(text)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}
const shuffle = (items, rng) => {
  for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; }
  return items;
};

// Every way to put k peppers in a row of n cells with no two side by side.
const patternCache = new Map();
function rowPatterns(n, k) {
  const key = `${n}:${k}`;
  if (!patternCache.has(key)) {
    const list = [];
    const walk = (start, left, mask) => {
      if (!left) { list.push(mask); return; }
      for (let c = start; c < n; c++) walk(c + 2, left - 1, mask | (1 << c));
    };
    walk(0, k, 0);
    patternCache.set(key, list);
  }
  return patternCache.get(key);
}
const bits = mask => { const out = []; for (let c = 0; mask; c++, mask >>= 1) if (mask & 1) out.push(c); return out; };

// Counts solutions, stopping at `limit`. With a callback, reports each
// solution found (an array of rows, each a list of pepper columns).
// Cells are 0 unknown, 1 pepper, 2 empty. Each row, column and patch is a
// "unit" needing k peppers; placing a pepper empties its 8 neighbours, a full
// unit empties its other cells, and a unit with exactly as many open cells as
// peppers still needed fills them. Then it guesses in the tightest unit.
export function countSolutions({ size: n, peppers: k, regions }, limit = 2, onSolution, maxNodes = Infinity) {
  const cells = n * n;
  const regionCount = regions.flat().reduce((max, id) => Math.max(max, id + 1), 0);
  const units = [];
  for (let r = 0; r < n; r++) units.push(Array.from({ length: n }, (_, c) => r * n + c));
  for (let c = 0; c < n; c++) units.push(Array.from({ length: n }, (_, r) => r * n + c));
  const patches = Array.from({ length: regionCount }, () => []);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) patches[regions[r][c]].push(r * n + c);
  units.push(...patches);
  const unitsOf = Array.from({ length: cells }, () => []);
  units.forEach((unit, u) => unit.forEach(cell => unitsOf[cell].push(u)));
  const around = Array.from({ length: cells }, (_, cell) => {
    const r = Math.floor(cell / n), c = cell % n, out = [];
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const rr = r + dr, cc = c + dc;
      if ((dr || dc) && rr >= 0 && cc >= 0 && rr < n && cc < n) out.push(rr * n + cc);
    }
    return out;
  });
  // Most peppers that can still fit in a unit's open cells: open cells are
  // grouped by 2x2 block, and a block holds at most one pepper.
  const room = (unit, grid) => {
    const blocks = new Set();
    for (const cell of unit) if (grid[cell] === 0) blocks.add((Math.floor(cell / n) >> 1) * n + ((cell % n) >> 1));
    return blocks.size;
  };
  // Applies the forced moves; false on a contradiction.
  const settle = grid => {
    for (let changed = true; changed;) {
      changed = false;
      for (const unit of units) {
        let stars = 0, open = 0;
        for (const cell of unit) { if (grid[cell] === 1) stars++; else if (grid[cell] === 0) open++; }
        if (stars > k) return false;
        const need = k - stars;
        if (need === 0) { if (open) { for (const cell of unit) if (grid[cell] === 0) grid[cell] = 2; changed = true; } continue; }
        if (open < need || room(unit, grid) < need) return false;
        if (open === need) {
          for (const cell of unit) if (grid[cell] === 0) {
            grid[cell] = 1;
            for (const near of around[cell]) { if (grid[near] === 1) return false; grid[near] = 2; }
          }
          changed = true;
        }
      }
    }
    return true;
  };
  let found = 0, nodes = 0;
  const walk = grid => {
    if (++nodes > maxNodes || !settle(grid)) return;
    // Guess in the unit with the fewest open cells.
    let best = null, bestOpen = Infinity;
    for (const unit of units) {
      let open = 0;
      for (const cell of unit) if (grid[cell] === 0) open++;
      if (open && open < bestOpen) { bestOpen = open; best = unit; }
    }
    if (!best) {
      found++;
      if (onSolution) onSolution(Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => c).filter(c => grid[r * n + c] === 1)));
      return;
    }
    const cell = best.find(index => grid[index] === 0);
    const yes = grid.slice();
    yes[cell] = 1;
    let ok = true;
    for (const near of around[cell]) { if (yes[near] === 1) ok = false; yes[near] = 2; }
    if (ok) walk(yes);
    if (found >= limit) return;
    const no = grid.slice();
    no[cell] = 2;
    walk(no);
  };
  walk(new Int8Array(cells));
  // Gave up (search too big): unknown.
  return nodes > maxNodes ? -1 : found;
}

// A random valid placement of peppers (rows, columns, no touching).
function randomSolution(n, k, rng) {
  const patterns = rowPatterns(n, k);
  const cols = new Array(n).fill(0), rows = [];
  let steps = 0;
  const walk = (r, prev) => {
    if (r === n) return cols.every(count => count === k);
    if (++steps > 200000) return false;
    const blocked = prev | (prev << 1) | (prev >> 1);
    for (const mask of shuffle(patterns.slice(), rng)) {
      if (mask & blocked) continue;
      const cells = bits(mask);
      if (cells.some(c => cols[c] >= k)) continue;
      cells.forEach(c => cols[c]++);
      const left = n - 1 - r;
      if (cols.every(count => k - count <= (left + 1) >> 1)) { rows.push(mask); if (walk(r + 1, mask)) return true; rows.pop(); }
      cells.forEach(c => cols[c]--);
    }
    return false;
  };
  return walk(0, 0) ? rows : null;
}

const NEIGHBORS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// Builds n patches over the grid, each holding exactly k of the solution's
// peppers: groups of k nearby peppers are joined by short paths, then the
// patches grow at random until they fill the grid.
function growRegions(n, k, solution, rng) {
  const star = (r, c) => (solution[r] >> c) & 1;
  const regions = Array.from({ length: n }, () => new Array(n).fill(-1));
  const loose = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (star(r, c)) loose.push([r, c]);
  shuffle(loose, rng);
  const distance = ([a, b], [c, d]) => Math.abs(a - c) + Math.abs(b - d);
  // Shortest path from a patch to a target cell through free, pepper-free cells.
  const connect = (id, target) => {
    const prev = new Map(), queue = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (regions[r][c] === id) { queue.push([r, c]); prev.set(`${r},${c}`, null); }
    while (queue.length) {
      const [r, c] = queue.shift();
      for (const [dr, dc] of shuffle(NEIGHBORS.slice(), rng)) {
        const nr = r + dr, nc = c + dc, key = `${nr},${nc}`;
        if (nr < 0 || nc < 0 || nr >= n || nc >= n || prev.has(key)) continue;
        if (nr === target[0] && nc === target[1]) {
          let step = `${r},${c}`;
          while (step) { const [sr, sc] = step.split(',').map(Number); if (regions[sr][sc] === -1) regions[sr][sc] = id; step = prev.get(step); }
          regions[nr][nc] = id;
          return true;
        }
        if (regions[nr][nc] !== -1 || star(nr, nc)) continue;
        prev.set(key, `${r},${c}`); queue.push([nr, nc]);
      }
    }
    return false;
  };
  for (let id = 0; id < n; id++) {
    const first = loose.shift();
    regions[first[0]][first[1]] = id;
    for (let more = 1; more < k; more++) {
      loose.sort((a, b) => distance(a, first) - distance(b, first));
      const index = loose.findIndex(cell => connect(id, cell));
      if (index === -1) return null;
      loose.splice(index, 1);
    }
  }
  let open = regions.flat().filter(id => id === -1).length;
  while (open > 0) {
    const frontier = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      if (regions[r][c] !== -1) continue;
      for (const [dr, dc] of NEIGHBORS) { const id = regions[r + dr]?.[c + dc]; if (id !== undefined && id !== -1) frontier.push([r, c, id]); }
    }
    if (!frontier.length) return null;
    const [r, c, id] = frontier[Math.floor(rng() * frontier.length)];
    regions[r][c] = id;
    open--;
  }
  return regions;
}

function connected(regions, id, n) {
  let start = null, total = 0;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (regions[r][c] === id) { total++; start ??= [r, c]; }
  if (!start) return false;
  const seen = new Set([start.join()]), queue = [start];
  while (queue.length) {
    const [r, c] = queue.pop();
    for (const [dr, dc] of NEIGHBORS) {
      const key = `${r + dr},${c + dc}`;
      if (regions[r + dr]?.[c + dc] === id && !seen.has(key)) { seen.add(key); queue.push([r + dr, c + dc]); }
    }
  }
  return seen.size === total;
}

// Nudges patch borders (never moving a pepper's cell) until only one
// solution remains: while another solution exists, a cell where it has a
// pepper and ours doesn't joins a neighbouring patch, which breaks that
// solution (its old patch is now a pepper short) and keeps ours intact.
function makeUnique(puzzle, solution, rng, budget) {
  const { size: n } = puzzle;
  const ours = solution.map(mask => bits(mask).join()).join('|');
  const star = (r, c) => (solution[r] >> c) & 1;
  for (let step = 0; step < budget; step++) {
    let other = null;
    const count = countSolutions(puzzle, 2, found => { if (found.map(row => row.join()).join('|') !== ours) other = found; }, 1500);
    if (count === 1) return puzzle;
    if (count < 0 || !other) return null;
    const cells = [];
    other.forEach((row, r) => row.forEach(c => { if (!star(r, c)) cells.push([r, c]); }));
    let moved = false;
    for (const [r, c] of shuffle(cells, rng)) {
      const from = puzzle.regions[r][c];
      const options = shuffle(NEIGHBORS.map(([dr, dc]) => puzzle.regions[r + dr]?.[c + dc]).filter(id => id !== undefined && id !== from), rng);
      for (const to of options) {
        puzzle.regions[r][c] = to;
        if (connected(puzzle.regions, from, n)) { moved = true; break; }
        puzzle.regions[r][c] = from;
      }
      if (moved) break;
    }
    // No cell of the other solution can move: shift any border cell instead.
    for (let tries = 0; !moved && tries < 200; tries++) {
      const r = Math.floor(rng() * n), c = Math.floor(rng() * n);
      if (star(r, c)) continue;
      const from = puzzle.regions[r][c];
      const to = NEIGHBORS.map(([dr, dc]) => puzzle.regions[r + dr]?.[c + dc]).find(id => id !== undefined && id !== from);
      if (to === undefined) continue;
      puzzle.regions[r][c] = to;
      if (connected(puzzle.regions, from, n)) moved = true; else puzzle.regions[r][c] = from;
    }
    if (!moved) return null;
  }
  return null;
}

export function generatePuzzle(level, rng = Math.random, { peppers, size, techniques = 'full' } = LEVELS[level]) {
  for (let attempt = 0; attempt < 1000; attempt++) {
    const solution = randomSolution(size, peppers, rng);
    if (!solution) continue;
    const regions = growRegions(size, peppers, solution, rng);
    if (!regions) continue;
    const puzzle = makeUnique({ size, peppers, regions }, solution, rng, 80);
    if (puzzle && solvesLogically(puzzle, techniques)) return { ...puzzle, solution: solution.map(mask => bits(mask)) };
  }
  throw new Error('Could not build a Pepper Placer puzzle');
}

export const dailyPuzzle = (date, level) => generatePuzzle(level, mulberry32(seedFrom(`pepper-placer:v2:${date}:${level}`)));

// The player's board: peppers is a Set of cell indexes (row * size + col).
// Returns touching peppers, each row/column/patch as 'over', 'done' or '',
// and whether the puzzle is solved.
export function checkBoard({ size: n, peppers: k, regions }, peppers) {
  const conflicts = new Set();
  const rowCount = new Array(n).fill(0), colCount = new Array(n).fill(0), patchCount = new Array(n).fill(0);
  for (const cell of peppers) {
    const r = Math.floor(cell / n), c = cell % n;
    rowCount[r]++; colCount[c]++; patchCount[regions[r][c]]++;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const rr = r + dr, cc = c + dc;
      if ((dr || dc) && rr >= 0 && cc >= 0 && rr < n && cc < n && peppers.has(rr * n + cc)) conflicts.add(cell);
    }
  }
  const state = count => count > k ? 'over' : count === k ? 'done' : '';
  const rows = rowCount.map(state), cols = colCount.map(state), patches = patchCount.map(state);
  const won = !conflicts.size && [...rows, ...cols, ...patches].every(value => value === 'done');
  return { conflicts, rows, cols, patches, won, placed: peppers.size, total: n * k };
}

// ----- Human-style solving -----
// Solves a puzzle the way a person would, using only these steps, and
// reports whether they are enough:
//  1. Squares around a pepper are empty. A row, column or patch that has all
//     its peppers is otherwise empty; one with exactly as many open squares
//     as peppers still needed is filled.
//  2. Bands: if some patches fit entirely inside a band of 1 or 2 neighbouring
//     rows (or columns) and there are as many of them as rows in the band,
//     the rest of the band is empty. Likewise, if a band's open squares all
//     lie in as many patches as it has rows, those patches are empty
//     elsewhere.
//  3. One step ahead: a square is empty if a pepper there would leave some
//     row, column or patch next to it without room for its peppers.
// Techniques a level may need: 'basic' is step 1 only, 'band1' adds single
// row/column bands, 'full' adds two-row bands and looking one step ahead.
export function solvesLogically({ size: n, peppers: k, regions }, techniques = 'full') {
  const MAX_BAND = techniques === 'full' ? 2 : techniques === 'band1' ? 1 : 0;
  const lookAhead = techniques === 'full';
  const cells = n * n;
  const regionCount = n;
  const rows = Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => r * n + c));
  const cols = Array.from({ length: n }, (_, c) => Array.from({ length: n }, (_, r) => r * n + c));
  const patches = Array.from({ length: regionCount }, () => []);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) patches[regions[r][c]].push(r * n + c);
  const units = [...rows, ...cols, ...patches];
  const around = Array.from({ length: cells }, (_, cell) => {
    const r = Math.floor(cell / n), c = cell % n, out = [];
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const rr = r + dr, cc = c + dc;
      if ((dr || dc) && rr >= 0 && cc >= 0 && rr < n && cc < n) out.push(rr * n + cc);
    }
    return out;
  });
  const patchOf = cell => regions[Math.floor(cell / n)][cell % n];
  const grid = new Int8Array(cells);
  // Most peppers that still fit in a unit's open squares (one per 2x2 block).
  const room = (unit, g) => {
    const blocks = new Set();
    for (const cell of unit) if (g[cell] === 0) blocks.add((Math.floor(cell / n) >> 1) * n + ((cell % n) >> 1));
    return blocks.size;
  };
  const need = (unit, g) => k - unit.reduce((sum, cell) => sum + (g[cell] === 1), 0);
  const place = (g, cell) => { g[cell] = 1; for (const near of around[cell]) if (g[near] === 0) g[near] = 2; };

  const basic = () => {
    let progress = false;
    for (const unit of units) {
      const left = need(unit, grid);
      const open = unit.filter(cell => grid[cell] === 0);
      if (!open.length) continue;
      if (left === 0) { open.forEach(cell => { grid[cell] = 2; }); progress = true; }
      else if (open.length === left) { open.forEach(cell => { if (grid[cell] === 0) place(grid, cell); }); progress = true; }
    }
    return progress;
  };
  const bands = () => {
    let progress = false;
    for (const lines of [rows, cols]) for (let size = 1; size <= MAX_BAND; size++) for (let start = 0; start + size <= n; start++) {
      const band = new Set(lines.slice(start, start + size).flat());
      const live = cell => grid[cell] !== 2;
      // Patches lying wholly inside the band.
      const inside = patches.filter(patch => patch.some(live) && patch.filter(live).every(cell => band.has(cell)));
      if (inside.length === size) {
        const mine = new Set(inside.flat());
        for (const cell of band) if (grid[cell] === 0 && !mine.has(cell)) { grid[cell] = 2; progress = true; }
      }
      // Patches touched by the band's open squares.
      const touched = new Set([...band].filter(live).map(patchOf));
      if (touched.size === size) {
        for (const id of touched) for (const cell of patches[id]) if (grid[cell] === 0 && !band.has(cell)) { grid[cell] = 2; progress = true; }
      }
    }
    return progress;
  };
  const ahead = () => {
    let progress = false;
    for (let cell = 0; cell < cells; cell++) {
      if (grid[cell] !== 0) continue;
      const trial = grid.slice();
      place(trial, cell);
      if (units.some(unit => { const left = need(unit, trial); return left < 0 || room(unit, trial) < left; })) { grid[cell] = 2; progress = true; }
    }
    return progress;
  };
  for (let guard = 0; guard < cells * 4; guard++) {
    if (basic() || bands() || (lookAhead && ahead())) continue;
    break;
  }
  return grid.every(value => value !== 0) && units.every(unit => need(unit, grid) === 0);
}

// ----- Walkthrough -----
// The steps a person takes to solve a 1-pepper board with the simplest logic,
// for the "Learn to play" walkthrough. Each step is either
//   { kind: 'pepper', cell, unit, reason: 'last' }  the unit's last open square
//   { kind: 'mark', cells, from, reason: 'clear' }  squares a new pepper rules out
// where unit is { type: 'row' | 'col' | 'patch', index, cells }.
// Returns null if the board needs more than these steps.
export function walkthrough({ size: n, peppers: k, regions }) {
  if (k !== 1) return null;
  const units = [];
  for (let r = 0; r < n; r++) units.push({ type: 'row', index: r, cells: Array.from({ length: n }, (_, c) => r * n + c) });
  for (let c = 0; c < n; c++) units.push({ type: 'col', index: c, cells: Array.from({ length: n }, (_, r) => r * n + c) });
  const patches = new Map();
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const id = regions[r][c];
    if (!patches.has(id)) patches.set(id, { type: 'patch', index: id, cells: [] });
    patches.get(id).cells.push(r * n + c);
  }
  // Patches first: they are the easiest to read.
  units.unshift(...[...patches.values()].sort((a, b) => a.cells.length - b.cells.length));
  const grid = new Int8Array(n * n); // 0 open, 1 pepper, 2 empty
  const steps = [];
  const ruledOut = cell => {
    const r = Math.floor(cell / n), c = cell % n, out = new Set();
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const rr = r + dr, cc = c + dc;
      if ((dr || dc) && rr >= 0 && cc >= 0 && rr < n && cc < n) out.add(rr * n + cc);
    }
    for (const unit of units) if (unit.cells.includes(cell)) unit.cells.forEach(other => { if (other !== cell) out.add(other); });
    return [...out].filter(other => grid[other] === 0).sort((a, b) => a - b);
  };
  for (let guard = 0; guard < n * n; guard++) {
    const unit = units.find(u => !u.cells.some(cell => grid[cell] === 1) && u.cells.filter(cell => grid[cell] === 0).length === 1);
    if (!unit) break;
    const cell = unit.cells.find(c => grid[c] === 0);
    grid[cell] = 1;
    steps.push({ kind: 'pepper', cell, unit, reason: 'last' });
    const cells = ruledOut(cell);
    if (cells.length) { cells.forEach(c => { grid[c] = 2; }); steps.push({ kind: 'mark', cells, from: cell, reason: 'clear' }); }
  }
  return grid.every(value => value !== 0) ? steps : null;
}
