import { countSolutions } from './solver.js';

export function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function getDailySeed(dateStr) {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash << 5) - hash + dateStr.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getDailyGridSize(dateStr) {
  const sizes = [5, 7, 10, 15, 20];
  const seed = getDailySeed(dateStr + '-size');
  return sizes[seed % sizes.length];
}

function partitionArea(r1, r2, c1, c2, rects, minArea = 2, maxAreaRatio = 0.15, rng = Math.random) {
  const height = r2 - r1 + 1;
  const width = c2 - c1 + 1;
  const area = height * width;

  const maxAllowedArea = Math.max(6, Math.floor((r2 + 1) * (c2 + 1) * maxAreaRatio));

  const validHorizontalCuts = [];
  for (let cut = r1; cut < r2; cut++) {
    const topArea = (cut - r1 + 1) * width;
    const botArea = (r2 - cut) * width;
    if (topArea >= minArea && botArea >= minArea) {
      validHorizontalCuts.push(cut);
    }
  }

  const validVerticalCuts = [];
  for (let cut = c1; cut < c2; cut++) {
    const leftArea = height * (cut - c1 + 1);
    const rightArea = height * (c2 - cut);
    if (leftArea >= minArea && rightArea >= minArea) {
      validVerticalCuts.push(cut);
    }
  }

  const canSplitH = validHorizontalCuts.length > 0;
  const canSplitV = validVerticalCuts.length > 0;
  const shouldSplit = (area > maxAllowedArea) || (area >= minArea * 2 && rng() < 0.70);

  if (!shouldSplit || (!canSplitH && !canSplitV)) {
    rects.push({ r1, r2, c1, c2, area });
    return;
  }

  let splitHorizontally;
  if (canSplitH && canSplitV) {
    if (height > width) splitHorizontally = rng() < 0.7;
    else if (width > height) splitHorizontally = rng() < 0.3;
    else splitHorizontally = rng() < 0.5;
  } else {
    splitHorizontally = canSplitH;
  }

  if (splitHorizontally) {
    const cut = validHorizontalCuts[Math.floor(rng() * validHorizontalCuts.length)];
    partitionArea(r1, cut, c1, c2, rects, minArea, maxAreaRatio, rng);
    partitionArea(cut + 1, r2, c1, c2, rects, minArea, maxAreaRatio, rng);
  } else {
    const cut = validVerticalCuts[Math.floor(rng() * validVerticalCuts.length)];
    partitionArea(r1, r2, c1, cut, rects, minArea, maxAreaRatio, rng);
    partitionArea(r1, r2, cut + 1, c2, rects, minArea, maxAreaRatio, rng);
  }
}

// Merge only neighbors whose union is still a rectangle. Target a minority
// of clues at area 4 or below, without swallowing the board into huge regions.
export function mergeSmallRectangles(rects, rng = Math.random) {
  const boardArea = rects.reduce((sum, rect) => sum + rect.area, 0);
  const maxMergedArea = Math.max(12, Math.floor(boardArea * 0.08));
  while (rects.length > 3) {
    const smallCount = rects.filter(rect => rect.area <= 4).length;
    if (smallCount / rects.length <= 0.20) break;
    const frequencies = new Map();
    for (const rect of rects) frequencies.set(rect.area, (frequencies.get(rect.area) || 0) + 1);
    let best = null;
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i], b = rects[j];
        if (a.area > 4 && b.area > 4) continue;
        const merged = {
          r1: Math.min(a.r1, b.r1), r2: Math.max(a.r2, b.r2),
          c1: Math.min(a.c1, b.c1), c2: Math.max(a.c2, b.c2),
          area: a.area + b.area,
        };
        // For disjoint input rectangles, equal bounding-box and combined areas
        // mean a shared full side: no gaps, overlaps, or L-shaped regions.
        if ((merged.r2 - merged.r1 + 1) * (merged.c2 - merged.c1 + 1) !== merged.area
          || merged.area > maxMergedArea) continue;
        const removedSmall = Number(a.area <= 4) + Number(b.area <= 4) - Number(merged.area <= 4);
        // Prefer removing small clues and creating less-common clue sizes.
        const score = removedSmall * 10 - (frequencies.get(merged.area) || 0) * 2 + rng();
        if (!best || score > best.score) best = { i, j, merged, score };
      }
    }
    if (!best) break;
    rects[best.i] = best.merged;
    rects.splice(best.j, 1);
  }
}

function generateFastPuzzle(n, rng = Math.random) {
  const rects = [];
  partitionArea(0, n - 1, 0, n - 1, rects, 2, 0.15, rng);
  mergeSmallRectangles(rects, rng);

  const clues = Array(n).fill(null).map(() => Array(n).fill(0));

  for (const rect of rects) {
    const randomR = rect.r1 + Math.floor(rng() * (rect.r2 - rect.r1 + 1));
    const randomC = rect.c1 + Math.floor(rng() * (rect.c2 - rect.c1 + 1));
    clues[randomR][randomC] = rect.area;
  }

  return { clues, rects };
}

export function generateUniquePuzzle(n, rng = Math.random) {
  let puzzle;
  for (let attempt = 0; attempt < 40; attempt++) {
    puzzle = generateFastPuzzle(n, rng);
    if (countSolutions(puzzle.clues) === 1) return puzzle;
  }
  // Keep the varied partition when random clue positions remain ambiguous.
  // Clues anchored to a common corner constrain their rectangles much more
  // strongly, but still require the same complete uniqueness check.
  const bottom = rng() < 0.5;
  const right = rng() < 0.5;
  puzzle.clues = Array.from({ length: n }, () => Array(n).fill(0));
  for (const rect of puzzle.rects) {
    puzzle.clues[bottom ? rect.r2 : rect.r1][right ? rect.c2 : rect.c1] = rect.area;
  }
  if (countSolutions(puzzle.clues) === 1) return puzzle;

  // Guaranteed unique fallback: all clues occupy the same edge. A rectangle
  // spanning multiple rows would contain multiple clues, forcing full rows.
  // Transposing gives the equivalent full-column puzzle.
  const transpose = rng() < 0.5;
  const clues = Array.from({ length: n }, () => Array(n).fill(0));
  const rects = [];
  for (let i = 0; i < n; i++) {
    if (transpose) {
      clues[0][i] = n;
      rects.push({ r1: 0, r2: n - 1, c1: i, c2: i, area: n });
    } else {
      clues[i][0] = n;
      rects.push({ r1: i, r2: i, c1: 0, c2: n - 1, area: n });
    }
  }
  return { clues, rects };
}

