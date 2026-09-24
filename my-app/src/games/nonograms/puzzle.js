// --- Random Puzzle Generator Helpers ---

function randomFromRange(min, max, rng = Math.random) {

  return Math.floor(rng() * (max - min + 1) + min);

}



function generateRandomPuzzleGrid(rows, cols, rng = Math.random) {

  return Array.from({ length: rows }, () => {

    let cells = [];

    let num = randomFromRange(1, cols, rng);

    let value = randomFromRange(0, 1, rng);

    while (cells.length < cols) {

      cells.push(...new Array(Math.min(num, cols - cells.length)).fill(value));

      value = 1 - value;

      if (cells.length < cols) num = randomFromRange(1, cols - cells.length, rng);

    }

    return cells;

  });

}



// Simple seeded PRNG (LCG) for daily puzzles based on date string (YYYY-MM-DD)

export function getDailyRng(dateStr) {

  let hash = 0;

  for (let i = 0; i < dateStr.length; i++) {

    hash = (hash << 5) - hash + dateStr.charCodeAt(i);

    hash |= 0;

  }

  let seed = Math.abs(hash);

  return () => {

    seed = (seed * 9301 + 49297) % 233280;

    return seed / 233280;

  };

}



// Helper to generate row and column clues

export const generateClues = (grid) => {

  const height = grid.length;

  const width = grid[0].length;



  const rowClues = grid.map(row => {

    const clues = [];

    let count = 0;

    for (let cell of row) {

      if (cell === 1) count++;

      else if (count > 0) { clues.push(count); count = 0; }

    }

    if (count > 0) clues.push(count);

    return clues.length ? clues : [0];

  });



  const colClues = [];

  for (let c = 0; c < width; c++) {

    const clues = [];

    let count = 0;

    for (let r = 0; r < height; r++) {

      if (grid[r][c] === 1) count++;

      else if (count > 0) { clues.push(count); count = 0; }

    }

    if (count > 0) clues.push(count);

    colClues.push(clues.length ? clues : [0]);

  }



  return { rowClues, colClues };

};

// Enumerate every placement of a line's runs, including their required gaps.
function linePatterns(length, clues) {
  const runs = clues.filter(value => value > 0);
  const patterns = [];
  function place(index, start, line) {
    if (index === runs.length) {
      patterns.push(line);
      return;
    }
    const remaining = runs.slice(index).reduce((sum, run) => sum + run, 0)
      + runs.length - index - 1;
    for (let offset = start; offset <= length - remaining; offset++) {
      const next = line.slice();
      next.fill(1, offset, offset + runs[index]);
      place(index + 1, offset + runs[index] + 1, next);
    }
  }
  place(0, 0, Array(length).fill(0));
  return patterns;
}

// A fully resolved board proves uniqueness: each deduction is shared by all
// remaining placements. Unresolved boards are rejected, even if guessing might
// eventually establish that they have one solution.
export function isLogicallySolvable({ rowClues, colClues }) {
  const height = rowClues.length;
  const width = colClues.length;
  const board = Array.from({ length: height }, () => Array(width).fill(-1));
  const lines = [
    ...rowClues.map((clues, r) => ({
      patterns: linePatterns(width, clues),
      cells: Array.from({ length: width }, (_, c) => [r, c]),
    })),
    ...colClues.map((clues, c) => ({
      patterns: linePatterns(height, clues),
      cells: Array.from({ length: height }, (_, r) => [r, c]),
    })),
  ];
  let changed = true;
  while (changed) {
    changed = false;
    for (const line of lines) {
      line.patterns = line.patterns.filter(pattern => line.cells.every(
        ([r, c], i) => board[r][c] === -1 || board[r][c] === pattern[i],
      ));
      if (!line.patterns.length) return false;
      line.cells.forEach(([r, c], i) => {
        const value = line.patterns[0][i];
        if (board[r][c] === -1 && line.patterns.every(pattern => pattern[i] === value)) {
          board[r][c] = value;
          changed = true;
        }
      });
    }
  }
  return board.every(row => row.every(value => value !== -1));
}

export function generateUniquePuzzleGrid(rows, cols, rng = Math.random) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const grid = generateRandomPuzzleGrid(rows, cols, rng);
    if (grid.some(row => row.includes(1)) && isLogicallySolvable(generateClues(grid))) {
      return grid;
    }
  }
  // Bound generation time even with a pathological RNG. Identical rows make
  // every column full or empty, so this fallback is always uniquely solvable.
  const run = randomFromRange(1, Math.max(1, cols - 1), rng);
  const start = randomFromRange(0, cols - run, rng);
  const row = Array.from({ length: cols }, (_, c) => Number(c >= start && c < start + run));
  return Array.from({ length: rows }, () => row.slice());
}



