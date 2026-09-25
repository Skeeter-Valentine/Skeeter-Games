import { fallbackPuzzle } from './fallbacks.js';

export function seededRandom(seed) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function getEdges(regions) {
  const n = regions.length;
  const edges = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      for (const [rr, cc] of [[r, c + 1], [r + 1, c]]) {
        if (rr >= n || cc >= n || regions[r][c] === regions[rr][cc]) continue;
        const a = r * n + c, b = rr * n + cc;
        const blocks = [regions[r][c], regions[rr][cc]].sort((x, y) => x - y);
        edges.push({ id: `${a}-${b}`, a, b, pair: blocks.join('-') });
      }
    }
  }
  return edges;
}

export function getCounts(size, edges) {
  const rows = Array(size).fill(0), cols = Array(size).fill(0);
  for (const edge of edges) {
    for (const cell of [edge.a, edge.b]) {
      rows[Math.floor(cell / size)]++;
      cols[cell % size]++;
    }
  }
  return { rows, cols };
}

export function checkSolution(puzzle, selected) {
  const edges = getEdges(puzzle.regions);
  const chosen = selected.map(id => edges.find(edge => edge.id === id));
  if (chosen.some(edge => !edge) || new Set(selected).size !== selected.length) return false;
  const pairs = new Set(edges.map(edge => edge.pair));
  if (chosen.length !== pairs.size || new Set(chosen.map(edge => edge.pair)).size !== pairs.size) return false;
  if (new Set(chosen.flatMap(edge => [edge.a, edge.b])).size !== chosen.length * 2) return false;
  const counts = getCounts(puzzle.regions.length, chosen);
  return counts.rows.every((count, i) => count === puzzle.rows[i])
    && counts.cols.every((count, i) => count === puzzle.cols[i]);
}

// Exact search: one edge for each neighboring block pair, disjoint endpoints,
// and (when supplied) exact row/column totals. Never certify a truncated search.
export function solvePuzzle(puzzle, { limit = 2, maxNodes = 15000, rng } = {}) {
  const n = puzzle.regions.length;
  const grouped = new Map();
  for (const edge of getEdges(puzzle.regions)) {
    if (!grouped.has(edge.pair)) grouped.set(edge.pair, []);
    grouped.get(edge.pair).push(edge);
  }
  const groups = [...grouped.values()];
  if (rng) {
    for (const group of groups) {
      for (let i = group.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [group[i], group[j]] = [group[j], group[i]];
      }
    }
  }
  const occupied = new Set();
  const rows = Array(n).fill(0), cols = Array(n).fill(0);
  const solutions = [];
  let nodes = 0, complete = true;
  function visit(remaining, selected) {
    if (solutions.length >= limit || !complete) return;
    if (++nodes > maxNodes) { complete = false; return; }
    if (!remaining.length) {
      if (!puzzle.rows || (rows.every((v, i) => v === puzzle.rows[i]) && cols.every((v, i) => v === puzzle.cols[i]))) {
        solutions.push(selected.map(edge => edge.id));
      }
      return;
    }
    const available = remaining.map(group => group.filter(edge => {
      if (occupied.has(edge.a) || occupied.has(edge.b)) return false;
      if (!puzzle.rows) return true;
      const ar = Math.floor(edge.a / n), br = Math.floor(edge.b / n);
      const ac = edge.a % n, bc = edge.b % n;
      return rows[ar] + 1 + Number(ar === br) <= puzzle.rows[ar]
        && rows[br] + 1 + Number(ar === br) <= puzzle.rows[br]
        && cols[ac] + 1 + Number(ac === bc) <= puzzle.cols[ac]
        && cols[bc] + 1 + Number(ac === bc) <= puzzle.cols[bc];
    }));
    if (available.some(group => !group.length)) return;
    if (puzzle.rows) {
      for (let i = 0; i < n; i++) {
        // Bounds for the holes the remaining block pairs could contribute.
        for (const [counts, targets, coordinate] of [
          [rows, puzzle.rows, cell => Math.floor(cell / n)],
          [cols, puzzle.cols, cell => cell % n],
        ]) {
          let min = 0, max = 0;
          for (const group of available) {
            const amounts = group.map(edge => Number(coordinate(edge.a) === i) + Number(coordinate(edge.b) === i));
            min += Math.min(...amounts);
            max += Math.max(...amounts);
          }
          if (counts[i] + min > targets[i] || counts[i] + max < targets[i]) return;
        }
      }
    }
    let next = 0;
    for (let i = 1; i < available.length; i++) if (available[i].length < available[next].length) next = i;
    for (const edge of available[next]) {
      for (const cell of [edge.a, edge.b]) { occupied.add(cell); rows[Math.floor(cell / n)]++; cols[cell % n]++; }
      visit(available.filter((_, i) => i !== next), [...selected, edge]);
      for (const cell of [edge.a, edge.b]) { occupied.delete(cell); rows[Math.floor(cell / n)]--; cols[cell % n]--; }
    }
  }
  visit(groups, []);
  return { solutions, complete };
}

function makeRegions(n, rng) {
  const regions = Array.from({ length: n }, () => Array(n).fill(-1));
  const cells = Array.from({ length: n * n }, (_, cell) => cell);
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  const sizes = Array(n).fill(1);
  cells.slice(0, n).forEach((cell, id) => { regions[Math.floor(cell / n)][cell % n] = id; });
  // Grow each block through orthogonal neighbors. Every addition is attached
  // to its block, so bends and branches never create disconnected fragments.
  for (let filled = n; filled < n * n; filled++) {
    const frontiers = Array.from({ length: n }, () => new Set());
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const id = regions[r][c];
        if (id < 0) continue;
        for (const [rr, cc] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) {
          if (rr >= 0 && rr < n && cc >= 0 && cc < n && regions[rr][cc] === -1) frontiers[id].add(rr * n + cc);
        }
      }
    }
    const growing = frontiers.map((frontier, id) => ({ id, frontier: [...frontier] })).filter(block => block.frontier.length);
    const smallest = Math.min(...growing.map(block => sizes[block.id]));
    // Give smaller blocks priority while allowing a varied mix of sizes.
    const candidates = growing.filter(block => sizes[block.id] <= smallest + 2);
    const block = candidates[Math.floor(rng() * candidates.length)];
    const cell = block.frontier[Math.floor(rng() * block.frontier.length)];
    regions[Math.floor(cell / n)][cell % n] = block.id;
    sizes[block.id]++;
  }
  return regions;
}

function hasIrregularBlocks(regions) {
  const blocks = new Map();
  regions.forEach((row, r) => row.forEach((id, c) => {
    if (!blocks.has(id)) blocks.set(id, []);
    blocks.get(id).push([r, c]);
  }));
  let irregular = 0;
  for (const cells of blocks.values()) {
    if (cells.length < 3) return false;
    const rows = cells.map(([r]) => r), cols = cells.map(([, c]) => c);
    const boundingArea = (Math.max(...rows) - Math.min(...rows) + 1) * (Math.max(...cols) - Math.min(...cols) + 1);
    if (boundingArea > cells.length) irregular++;
  }
  return irregular >= Math.ceil(blocks.size * 0.6);
}

export function generatePuzzle(size, rng = Math.random) {
  if (![5, 7, 9].includes(size)) throw new RangeError('Supported Stitches sizes are 5, 7, and 9.');
  for (let attempt = 0; attempt < 300; attempt++) {
    const regions = makeRegions(size, rng);
    if (!hasIrregularBlocks(regions)) continue;
    const initial = solvePuzzle({ regions }, { limit: 1, maxNodes: 3000, rng });
    if (!initial.solutions.length) continue;
    const selected = new Set(initial.solutions[0]);
    const counts = getCounts(size, getEdges(regions).filter(edge => selected.has(edge.id)));
    const puzzle = { regions, ...counts };
    const result = solvePuzzle(puzzle);
    if (result.complete && result.solutions.length === 1) return puzzle;
  }
  return fallbackPuzzle(size, rng);
}

export function dailyPuzzle(date) {
  let seed = 0;
  for (const char of `stitches-v2-${date}`) seed = (Math.imul(seed, 31) + char.charCodeAt(0)) | 0;
  return generatePuzzle(7, seededRandom(seed));
}
