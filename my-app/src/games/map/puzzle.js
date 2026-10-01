import { scheduledDifficulty } from '../../utils/dailySchedule.js';
const WIDTH = 720, HEIGHT = 500;
export function dailyConfig(date) {
  return { seed: Date.parse(`${date}T00:00:00Z`) / 86400000 + 73129, size: ['Small', 'Medium', 'Large'][scheduledDifficulty('map', date) - 1] };
}
function random(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function clip(poly, a, b, c) {
  const result = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const dp = a * p[0] + b * p[1] - c;
    const dq = a * q[0] + b * q[1] - c;
    if (dp <= 1e-7) result.push(p);
    if ((dp < 0) !== (dq < 0)) {
      const t = dp / (dp - dq);
      result.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
    }
  }
  return result;
}

// Build each shared border once, then reuse it in reverse for its neighbor.
// Bends stay inside the triangles from the original edge to each cell center,
// so neighboring borders cannot cross and the adjacency graph stays intact.
function shapeBorders(polygons, centers, seed) {
  const rand = random(seed ^ 0x51ed270b);
  const edges = Object.create(null);
  const pointKey = p => p.map(v => v.toFixed(5)).join(',');
  const edgeKey = (p, q) => [pointKey(p), pointKey(q)].sort().join('|');
  polygons.forEach((poly, owner) => poly.forEach((p, i) => {
    const q = poly[(i + 1) % poly.length], key = edgeKey(p, q);
    if (!edges[key]) edges[key] = { p, q, owners: [] };
    edges[key].owners.push(owner);
  }));
  Object.values(edges).forEach(edge => {
    const { p, q, owners } = edge;
    edge.points = [p];
    const length = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (owners.length === 2 && length > 16) {
      const count = length > 85 ? 3 : 2;
      for (let i = 1; i <= count; i++) {
        const t = (i + (rand() - .5) * .24) / (count + 1);
        const base = [p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])];
        const center = centers[owners[rand() < .5 ? 0 : 1]];
        const distance = Math.hypot(center[0] - base[0], center[1] - base[1]);
        const amount = Math.min(.09 + rand() * .09, length * .12 / distance);
        edge.points.push([base[0] + (center[0] - base[0]) * amount,
          base[1] + (center[1] - base[1]) * amount]);
      }
    }
    edge.points.push(q);
  });
  return polygons.map(poly => poly.flatMap((p, i) => {
    const edge = edges[edgeKey(p, poly[(i + 1) % poly.length])];
    const points = pointKey(p) === pointKey(edge.p) ? edge.points : [...edge.points].reverse();
    return points.slice(0, -1);
  }));
}

// MRV backtracking; stops after two solutions when testing uniqueness.
export function solutions(adj, clues, limit = 2) {
  const values = [...clues], found = [];
  function search() {
    let next = -1, choices = [];
    for (let i = 0; i < values.length; i++) {
      if (values[i] !== -1) continue;
      const options = [0, 1, 2, 3].filter(c => adj[i].every(j => values[j] !== c));
      if (!options.length) return;
      if (next === -1 || options.length < choices.length) { next = i; choices = options; }
    }
    if (next === -1) { found.push([...values]); return; }
    for (const c of choices) {
      values[next] = c; search(); values[next] = -1;
      if (found.length >= limit) return;
    }
  }
  search(); return found;
}

function polygonArea(poly) {
  return Math.abs(poly.reduce((sum, p, i) => {
    const q = poly[(i + 1) % poly.length];
    return sum + p[0] * q[1] - q[0] * p[1];
  }, 0)) / 2;
}

// Lengthen tiny borders consistently in all incident cells. Reject any
// layout where doing so would fold a cell or change the map boundary.
export const MIN_SHARED_EDGE = 18;
const vertexKey = p => p.map(v => v.toFixed(5)).join(',');
const borderKey = (a, b) => [vertexKey(a), vertexKey(b)].sort().join('|');
function sharedBorders(polygons) {
  const edges = new Map();
  polygons.forEach((poly, owner) => poly.forEach((p, i) => {
    const q = poly[(i + 1) % poly.length], key = borderKey(p, q);
    if (!edges.has(key)) edges.set(key, { p, q, owners: [] });
    edges.get(key).owners.push(owner);
  }));
  return [...edges.values()].filter(edge => edge.owners.length === 2);
}
function clarifyBorders(input) {
  let polygons = input;
  for (let step = 0; step < input.length * 4; step++) {
    const short = sharedBorders(polygons).find(({ p, q }) => Math.hypot(p[0] - q[0], p[1] - q[1]) < MIN_SHARED_EDGE);
    if (!short) return polygons;
    const { p, q } = short;
    const boundary = v => v[0] < 1e-5 || v[0] > WIDTH - 1e-5 || v[1] < 1e-5 || v[1] > HEIGHT - 1e-5;
    if (boundary(p) && boundary(q)) return null;
    const length = Math.hypot(p[0] - q[0], p[1] - q[1]);
    if (length < 1e-5) return null;
    const dx = (q[0] - p[0]) / length, dy = (q[1] - p[1]) / length;
    const extra = MIN_SHARED_EDGE + 1 - length;
    const shiftP = boundary(p) ? 0 : boundary(q) ? extra : extra / 2;
    const shiftQ = boundary(q) ? 0 : boundary(p) ? extra : extra / 2;
    const movedP = [p[0] - dx * shiftP, p[1] - dy * shiftP];
    const movedQ = [q[0] + dx * shiftQ, q[1] + dy * shiftQ];
    const next = polygons.map(poly => poly.map(v => vertexKey(v) === vertexKey(p) ? movedP : vertexKey(v) === vertexKey(q) ? movedQ : v));
    // Keep every cell convex and non-degenerate so adjustments cannot fold
    // borders across a region or create gaps in the rectangular map.
    if (next.some(poly => poly.length < 3 || polygonArea(poly) < 1 || poly.some((a, i) => {
      const b = poly[(i + 1) % poly.length], c = poly[(i + 2) % poly.length];
      return (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) < -1e-5;
    }))) return null;
    polygons = next;
  }
  return null;
}

function makeLayout(seed, count) {
  const rand = random(seed ^ 0x2c9277b5);
  for (let attempt = 0; attempt < 4096; attempt++) {
    // Free placement creates sparse areas and clusters instead of equal grid cells.
    const points = Array.from({ length: count }, () => [
      (0.025 + rand() * .95) * WIDTH, (0.025 + rand() * .95) * HEIGHT,
    ]);
    const rawPolygons = points.map((p, i) => {
    let poly = [[0, 0], [WIDTH, 0], [WIDTH, HEIGHT], [0, HEIGHT]];
    points.forEach((q, j) => {
      if (i !== j) poly = clip(poly, q[0] - p[0], q[1] - p[1],
        (q[0] ** 2 + q[1] ** 2 - p[0] ** 2 - p[1] ** 2) / 2);
    });
    return poly;
    });
    const polygons = clarifyBorders(rawPolygons);
    if (!polygons) continue;
    const centers = polygons.map(poly => [
      poly.reduce((s, p) => s + p[0], 0) / poly.length,
      poly.reduce((s, p) => s + p[1], 0) / poly.length,
    ]);
    const shaped = shapeBorders(polygons, centers, seed);
    const areas = shaped.map(polygonArea).sort((a, b) => a - b);
    const ratio = areas[count - 1] / areas[0];
    // Measure the actual rendered regions, including their irregular borders.
    // Require a broad middle spread as well as a 10–12× largest/smallest ratio.
    if (ratio >= 10 && ratio <= 12 && areas[0] >= WIDTH * HEIGHT / count * .15 &&
        areas[Math.floor(count * .75)] / areas[Math.floor(count * .25)] >= 2.2) {
      return { points, polygons, centers, shaped };
    }
  }
  // The outer puzzle search can try another deterministic seed.
  throw new Error('Could not generate a clear map layout');
}

export function makeCandidate(seed, size) {
  const rand = random(seed), count = size === 'Small' ? 12 : size === 'Large' ? 35 : 24;
  const { points, polygons, centers, shaped } = makeLayout(seed, count);
  const adj = points.map(() => []);
  const borders = sharedBorders(polygons);
  borders.forEach(({ owners: [i, j] }) => { adj[i].push(j); adj[j].push(i); });
  const solution = solutions(adj, points.map(() => -1), 1)[0];
  // A three-colorable map needs a fourth-color seed to allow deductions.
  if (!solution.includes(3)) {
    const candidate = adj.findIndex(ns => ns.length >= 3);
    solution[candidate < 0 ? 0 : candidate] = 3;
  }
  const clues = [...solution];
  const order = points.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]];
  }
  for (const i of order) {
    const saved = clues[i];
    clues[i] = -1;
    if (solutions(adj, clues).length !== 1) clues[i] = saved;
  }
  if (!clues.includes(-1)) return makeCandidate((seed + 1) >>> 0, size);
  return { sourceSeed: seed, polygons: shaped, centers, adj, clues, solution, sharedEdgeLengths: borders.map(({ p, q }) => Math.hypot(p[0] - q[0], p[1] - q[1])) };
}


// Reject dense candidates instead of removing clues that are needed for uniqueness.
export function makePuzzle(seed, size, excludeSeed) {
  // Independent candidate streams avoid adjacent practice requests searching
  // the same sequence and stopping at the same acceptable puzzle.
  const nextSeed = random(seed ^ 0x719ab253);
  for (let attempt = 0; attempt < 128; attempt++) {
    const candidateSeed = Math.floor(nextSeed() * 4294967296);
    if (candidateSeed === excludeSeed) continue;
    let puzzle;
    try { puzzle = makeCandidate(candidateSeed, size); }
    catch { continue; }
    if (puzzle.clues.filter(color => color >= 0).length <= Math.floor(puzzle.clues.length / 3)) return puzzle;
  }
  // Verified sparse, uniquely solvable fallbacks bound generation time.
  const fallbacks = size === 'Small' ? [104, 345] : size === 'Large' ? [12, 44] : [16, 49];
  return makeCandidate(fallbacks.find(candidate => candidate !== excludeSeed), size);
}
