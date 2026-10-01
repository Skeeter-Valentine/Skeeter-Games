// Daily and archive Skeedograms progress, tied to the exact solution grid.
export const nonogramProgressKey = (date, archive) => `${archive ? 'archive:v1:' : ''}nonograms-daily-progress-v1-${date}`;

const fingerprint = solution => solution.map(row => row.join('')).join('/');
const emptyGrid = solution => solution.map(row => row.map(() => 0));
const solved = (solution, grid) => solution.every((row, r) => row.every((cell, c) => (cell === 1) === (grid[r][c] === 1)));

export const saveNonogram = (solution, grid, hasStarted, isWon) => ({ fingerprint: fingerprint(solution), grid, hasStarted, isWon });

export function restoreNonogram(solution, saved) {
  const fresh = { grid: emptyGrid(solution), hasStarted: false, isWon: false };
  if (!saved || saved.fingerprint !== fingerprint(solution) || !Array.isArray(saved.grid)
    || saved.grid.length !== solution.length) return fresh;
  const grid = solution.map((row, r) => row.map((_, c) => [0, 1, 2].includes(saved.grid[r]?.[c]) ? saved.grid[r][c] : 0));
  const isWon = solved(solution, grid);
  return { grid, hasStarted: isWon || !!saved.hasStarted, isWon };
}
