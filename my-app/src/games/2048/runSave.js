const integer = value => Number.isSafeInteger(value) && value >= 0;
function board(tiles) {
  if (!Array.isArray(tiles) || !tiles.length || tiles.length > 16) throw new Error('Invalid saved board.');
  const positions = new Set(), ids = new Set();
  return tiles.map(({ id, r, c, value }) => {
    if (!integer(id) || !integer(r) || r > 3 || !integer(c) || c > 3 || !integer(value) || value < 2 || !Number.isInteger(Math.log2(value)) || positions.has(`${r}:${c}`) || ids.has(id)) throw new Error('Invalid saved tile.');
    positions.add(`${r}:${c}`); ids.add(id);
    return { id, r, c, value, isMerged: false, distance: 0 };
  });
}
export function validateRun(run) {
  if (!run || run.version !== 1 || !['daily', 'classic', 'unlimited'].includes(run.gameMode)
    || !/^\d{4}-\d{2}-\d{2}$/.test(run.date) || !integer(run.score) || !integer(run.undoCount)
    || !integer(run.elapsedTime) || !integer(run.unlimitedSeed) || typeof run.gameWon !== 'boolean'
    || typeof run.completionTimeKnown !== 'boolean' || !Array.isArray(run.history)) throw new Error('This save is invalid or uses an unsupported format.');
  return {
    version: 1, gameMode: run.gameMode, date: run.date, unlimitedSeed: run.unlimitedSeed,
    tiles: board(run.tiles), score: run.score, undoCount: run.undoCount, elapsedTime: run.elapsedTime,
    gameWon: run.gameWon, completionTimeKnown: run.completionTimeKnown,
    history: run.history.map(step => {
      if (!integer(step.score)) throw new Error('Invalid saved undo history.');
      return { tiles: board(step.tiles), score: step.score };
    }),
  };
}
export function encodeRun(run) {
  const payload = JSON.stringify(validateRun(run));
  if (new TextEncoder().encode(payload).length > 800000) throw new Error('This run has too much undo history to save. Your current game is unchanged.');
  return payload;
}
