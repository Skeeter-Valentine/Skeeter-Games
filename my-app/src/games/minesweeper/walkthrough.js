// Steps for the Mineskeeter "Learn to play" walkthrough: the two basic
// Minesweeper moves, one number at a time. Cells are numbered row * size +
// column. mineWalkthrough(size, mines, start) opens `start` (a 0) and
// returns [{ action: 'flag' | 'dig', focus: [cell], targets: [cells] }]
// or null if these moves don't clear the board:
//  flag  a number with exactly as many hidden squares as mines left: all mines
//  dig   a number with all its mines flagged: its other squares are safe
export function neighbors(size, id) {
  const r = Math.floor(id / size), c = id % size, list = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    const nr = r + dr, nc = c + dc;
    if ((dr || dc) && nr >= 0 && nc >= 0 && nr < size && nc < size) list.push(nr * size + nc);
  }
  return list;
}

export const counts = (size, mines) => Array.from({ length: size * size }, (_, id) =>
  mines.includes(id) ? -1 : neighbors(size, id).filter(other => mines.includes(other)).length);

// Opening a square: a 0 opens everything around it, like the game.
export function open(size, numbers, revealed, id) {
  const stack = [id];
  while (stack.length) {
    const at = stack.pop();
    if (revealed.has(at)) continue;
    revealed.add(at);
    if (numbers[at] === 0) stack.push(...neighbors(size, at));
  }
}

export function mineWalkthrough(size, mines, start) {
  const numbers = counts(size, mines);
  const revealed = new Set(), flagged = new Set();
  open(size, numbers, revealed, start);
  const steps = [];
  const safe = size * size - mines.length;
  for (let guard = 0; guard < size * size && revealed.size < safe; guard++) {
    let move = null;
    for (const id of [...revealed].sort((a, b) => a - b)) {
      const hidden = neighbors(size, id).filter(other => !revealed.has(other) && !flagged.has(other));
      const flags = neighbors(size, id).filter(other => flagged.has(other)).length;
      if (!hidden.length) continue;
      if (flags === numbers[id]) { move = { action: 'dig', focus: [id], targets: hidden }; break; }
      if (flags + hidden.length === numbers[id]) { move = { action: 'flag', focus: [id], targets: hidden }; break; }
    }
    if (!move) return null;
    if (move.action === 'flag') move.targets.forEach(id => flagged.add(id));
    else move.targets.forEach(id => open(size, numbers, revealed, id));
    move.number = numbers[move.focus[0]];
    steps.push(move);
  }
  return revealed.size === safe ? steps : null;
}

// The walkthrough board: 5 x 5 with five mines, opened from the top-left
// corner. TUTORIAL_WORDS follow the walkthrough's order (the test checks it).
export const TUTORIAL_SIZE = 5;
export const TUTORIAL_MINES = [13, 17, 18, 23, 24];
export const TUTORIAL_START = 0;
export const TUTORIAL_WORDS = [
  { title: 'A 1 with one hidden neighbor',
    text: 'Each number counts the mines touching it, corners included. This 1 has only one hidden square next to it, so that square must be the mine. Tap it to flag it.' },
  { title: 'Its mine is found',
    text: 'This 1 already touches its mine: the flag. So every other hidden square around it is safe. Tap it to dig it up.' },
  { title: 'Spot another mine',
    text: 'This 1 also has just one hidden neighbor. Flag it.' },
  { title: 'Count the flags',
    text: 'This 3 touches two flags and one hidden square. It needs three mines, so that square is one too. Flag it.' },
  { title: 'Safe to dig',
    text: 'This 2 now touches two flags, so its last hidden neighbor is safe. Dig it.' },
  { title: 'Clear the board',
    text: 'This 1 has its mine, so its last hidden neighbor is safe. Dig it, and every safe square is open.' },
];
