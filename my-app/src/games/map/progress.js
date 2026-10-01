// Reject stale or malformed saves without changing the puzzle's fixed clues.
export function restoreMapProgress(puzzle, saved) {
  const empty = { history: [{ colors: [...puzzle.clues], notes: puzzle.clues.map(() => 0) }], cursor: 0 };
  const validBoard = board => Array.isArray(board?.colors) && Array.isArray(board?.notes)
    && board.colors.length === puzzle.clues.length && board.notes.length === puzzle.clues.length
    && board.colors.every((color, i) => Number.isInteger(color) && color >= -1 && color <= 3
      && (puzzle.clues[i] === -1 || color === puzzle.clues[i]))
    && board.notes.every((note, i) => Number.isInteger(note) && note >= 0 && note <= 15
      && (board.colors[i] === -1 || note === 0));
  if (saved?.fingerprint !== JSON.stringify(puzzle) || !Array.isArray(saved.history)
    || !saved.history.length || !saved.history.every(validBoard)
    || !Number.isInteger(saved.cursor) || saved.cursor < 0 || saved.cursor >= saved.history.length) return empty;
  return { history: saved.history, cursor: saved.cursor };
}
