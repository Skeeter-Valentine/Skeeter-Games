// Daily and archive Skeedoku progress. Notes are stored as arrays because Sets
// do not survive JSON; the puzzle is stored as a fingerprint so progress can
// never be applied to a different board.
export const sudokuProgressKey = (date, archive) => `${archive ? 'archive:v1:' : ''}skeedoku-daily-progress-v1-${date}`;

export function saveSudoku({ puzzle, grid, notes, mistakes, elapsed, completed, hasStarted }) {
  return {
    puzzle: puzzle.join(''), grid: [...grid], notes: notes.map(set => [...set]),
    mistakes, elapsed, completed, hasStarted,
  };
}

const count = value => Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;

export function restoreSudoku(puzzle, solution, saved) {
  const size = puzzle.length;
  if (!saved || saved.puzzle !== puzzle.join('') || !Array.isArray(saved.grid) || saved.grid.length !== size) return null;
  const max = Math.round(Math.sqrt(size));
  const grid = saved.grid.map((value, i) => puzzle[i] ? puzzle[i]
    : Number.isInteger(value) && value >= 0 && value <= max ? value : 0);
  const notes = Array.from({ length: size }, (_, i) => new Set(Array.isArray(saved.notes?.[i]) && !grid[i]
    ? saved.notes[i].filter(n => Number.isInteger(n) && n >= 1 && n <= max) : []));
  const completed = grid.every((value, i) => value === solution[i]);
  return {
    grid, notes, completed, mistakes: count(saved.mistakes), elapsed: count(saved.elapsed),
    hasStarted: completed || !!saved.hasStarted,
  };
}
