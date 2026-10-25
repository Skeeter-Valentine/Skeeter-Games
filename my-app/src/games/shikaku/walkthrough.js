// Steps for the Skeekaku "Learn to play" walkthrough: the basic Shikaku
// logic, one rectangle at a time. Returns [{ reason, clue: [r, c], rect:
// { r1, r2, c1, c2 }, cell? }] or null if these moves don't solve it.
//  onlyFit    the number has just one rectangle that still fits
//  onlyReach  a cell only one number can still reach, and only one of that
//             number's rectangles covers it
export const rectKey = rect => `${rect.r1},${rect.c1},${rect.r2},${rect.c2}`;

export function shikakuWalkthrough(clues) {
  const n = clues.length;
  const numbers = clues.flatMap((row, r) => row.flatMap((area, c) => area ? [{ r, c, area }] : []));
  const covered = clues.map(row => row.map(() => false));
  const done = new Set();
  // Rectangles of the right size around a number, inside the board, over
  // uncovered cells, holding no other number.
  const options = clue => {
    const list = [];
    for (let h = 1; h <= clue.area; h++) {
      if (clue.area % h) continue;
      const w = clue.area / h;
      for (let r1 = clue.r - h + 1; r1 <= clue.r; r1++) {
        for (let c1 = clue.c - w + 1; c1 <= clue.c; c1++) {
          const rect = { r1, c1, r2: r1 + h - 1, c2: c1 + w - 1 };
          if (r1 < 0 || c1 < 0 || rect.r2 >= n || rect.c2 >= n) continue;
          let ok = true;
          for (let r = r1; r <= rect.r2 && ok; r++) {
            for (let c = c1; c <= rect.c2 && ok; c++) {
              if (covered[r][c] || (clues[r][c] && (r !== clue.r || c !== clue.c))) ok = false;
            }
          }
          if (ok) list.push(rect);
        }
      }
    }
    return list;
  };
  const inside = (rect, r, c) => r >= rect.r1 && r <= rect.r2 && c >= rect.c1 && c <= rect.c2;
  const steps = [];
  const place = (clue, rect, reason, cell) => {
    for (let r = rect.r1; r <= rect.r2; r++) for (let c = rect.c1; c <= rect.c2; c++) covered[r][c] = true;
    done.add(clue);
    steps.push({ reason, clue: [clue.r, clue.c], area: clue.area, rect, cell });
  };
  for (let guard = 0; guard < numbers.length; guard++) {
    const open = numbers.filter(clue => !done.has(clue)).map(clue => ({ clue, rects: options(clue) }));
    if (!open.length) break;
    if (open.some(entry => !entry.rects.length)) return null;
    const single = open.find(entry => entry.rects.length === 1);
    if (single) { place(single.clue, single.rects[0], 'onlyFit'); continue; }
    let found = null;
    for (let r = 0; r < n && !found; r++) {
      for (let c = 0; c < n && !found; c++) {
        if (covered[r][c]) continue;
        const reach = open.map(entry => ({ ...entry, rects: entry.rects.filter(rect => inside(rect, r, c)) })).filter(entry => entry.rects.length);
        if (reach.length === 1 && reach[0].rects.length === 1) found = { ...reach[0], cell: [r, c] };
      }
    }
    if (!found) return null;
    place(found.clue, found.rects[0], 'onlyReach', found.cell);
  }
  return covered.every(row => row.every(Boolean)) ? steps : null;
}

// The walkthrough board (5 x 5) and what each step says, in walkthrough
// order (the test checks the order).
export const TUTORIAL_CLUES = [
  [0, 0, 0, 5, 0],
  [2, 0, 0, 0, 4],
  [0, 2, 0, 6, 0],
  [0, 6, 0, 0, 0],
  [0, 0, 0, 0, 0],
];
export const TUTORIAL_WORDS = [
  { title: 'A 5 is a straight line',
    text: 'Each number needs a rectangle with exactly that many squares, holding no other number. Five squares can only make a line. Going down, this one would swallow the 6, so it\'s the whole top row. Drag across it.' },
  { title: 'Who can reach this square?',
    text: 'Look at the shaded square on the left edge, beside the 6. The only number that can reach it is the 6, and only one 6-square rectangle covers it without touching another number: 2 rows by 3 columns.' },
  { title: 'Boxed in',
    text: 'This 6 has the bottom-right corner to itself. The only rectangle that fits is two squares wide and three tall.' },
  { title: 'Room for the 4',
    text: 'The 4 has just one way left: the four free squares in its row.' },
  { title: 'Only one way down',
    text: 'This 2 has one free neighbor left, the square below it.' },
  { title: 'The last piece',
    text: 'The final 2 takes the last two squares. That covers the whole board.' },
];
