export function restoreProgress(clues, saved) {
  const empty = { placedRects: [], seconds: 0, isWin: false };
  const size = clues.length;
  if (!saved || (saved.fingerprint && saved.fingerprint !== JSON.stringify(clues)) || !Array.isArray(saved.placedRects)) return empty;
  const occupied = new Set();
  let allValid = true;
  for (const rect of saved.placedRects) {
    if (!rect || !['r1', 'r2', 'c1', 'c2'].every(key => Number.isInteger(rect[key]) && rect[key] >= 0 && rect[key] < size)
      || rect.r1 > rect.r2 || rect.c1 > rect.c2) return empty;
    const numbers = [];
    for (let r = rect.r1; r <= rect.r2; r++) for (let c = rect.c1; c <= rect.c2; c++) {
      const cell = r * size + c;
      if (occupied.has(cell)) return empty;
      occupied.add(cell);
      if (clues[r][c] > 0) numbers.push(clues[r][c]);
    }
    if (numbers.length !== 1 || numbers[0] !== (rect.r2 - rect.r1 + 1) * (rect.c2 - rect.c1 + 1)) allValid = false;
  }
  return { placedRects: saved.placedRects, seconds: Number.isInteger(saved.seconds) && saved.seconds >= 0 ? saved.seconds : 0,
    isWin: allValid && occupied.size === size * size };
}
