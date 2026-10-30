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
  if (run?.version === 2) return decodeCompact(run);
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
// Saved runs use a compact format (version 2): each board is 16 characters,
// one per square in reading order, holding the tile's power of two in base
// 36 ('0' for empty, '1' for 2, 'b' for 2048). A board plus its score takes
// about 25 bytes, against about 1 KB as plain JSON, so even very long runs
// fit. If a run still has more undo steps than MAX_SAVED_HISTORY, only the
// most recent ones are kept (the board and score are never cut).
export const MAX_SAVED_HISTORY = 20000;
const SIZE_LIMIT = 800000;

export function encodeBoard(tiles) {
  const cells = Array(16).fill('0');
  for (const { r, c, value } of tiles) cells[r * 4 + c] = Math.log2(value).toString(36);
  return cells.join('');
}

function decodeBoard(text, nextId) {
  if (typeof text !== 'string' || !/^[0-9a-z]{16}$/.test(text)) throw new Error('Invalid saved board.');
  const tiles = [];
  [...text].forEach((char, index) => {
    const power = parseInt(char, 36);
    if (power === 0) return;
    tiles.push({ id: nextId(), r: Math.floor(index / 4), c: index % 4, value: 2 ** power });
  });
  return board(tiles);
}

function decodeCompact(run) {
  if (!['daily', 'classic', 'unlimited'].includes(run.gameMode) || !/^\d{4}-\d{2}-\d{2}$/.test(run.date)
    || !integer(run.score) || !integer(run.undoCount) || !integer(run.elapsedTime) || !integer(run.unlimitedSeed)
    || typeof run.gameWon !== 'boolean' || typeof run.completionTimeKnown !== 'boolean'
    || !Array.isArray(run.history)) throw new Error('This save is invalid or uses an unsupported format.');
  let id = 0;
  const nextId = () => ++id;
  const history = run.history.map(step => {
    const [text, score] = typeof step === 'string' ? step.split(',') : [];
    const value = Number(score);
    if (!integer(value) || score === '') throw new Error('Invalid saved undo history.');
    return { tiles: decodeBoard(text, nextId), score: value };
  });
  return {
    version: 1, gameMode: run.gameMode, date: run.date, unlimitedSeed: run.unlimitedSeed,
    tiles: decodeBoard(run.board, nextId), score: run.score, undoCount: run.undoCount, elapsedTime: run.elapsedTime,
    gameWon: run.gameWon, completionTimeKnown: run.completionTimeKnown, history,
  };
}

// Returns { payload, kept, dropped }: the JSON to store, and how many undo
// steps were kept and left out.
export function encodeRun(run) {
  const valid = validateRun(run);
  const steps = valid.history.map(step => `${encodeBoard(step.tiles)},${step.score}`);
  let kept = steps.slice(-MAX_SAVED_HISTORY);
  const build = () => JSON.stringify({
    version: 2, gameMode: valid.gameMode, date: valid.date, unlimitedSeed: valid.unlimitedSeed,
    board: encodeBoard(valid.tiles), score: valid.score, undoCount: valid.undoCount, elapsedTime: valid.elapsedTime,
    gameWon: valid.gameWon, completionTimeKnown: valid.completionTimeKnown, history: kept,
  });
  let payload = build();
  // Scores grow long in huge runs; trim further if it's somehow still too big.
  while (new TextEncoder().encode(payload).length > SIZE_LIMIT && kept.length) {
    kept = kept.slice(Math.ceil(kept.length / 10));
    payload = build();
  }
  return { payload, kept: kept.length, dropped: steps.length - kept.length };
}
