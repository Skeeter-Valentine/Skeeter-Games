// Enumerate legal rectangles from the clues, then solve the resulting exact
// cover problem. Counts are capped at two; null means uniqueness is unproven
// because the search budget was reached.
export function countSolutions(clues, maxNodes = 2000) {
  const height = clues.length;
  const width = clues[0]?.length || 0;
  if (!height || !width || clues.some(row => row.length !== width)) return 0;
  const numbers = [];
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const area = clues[r][c];
      if (!Number.isInteger(area) || area < 0) return 0;
      if (area) numbers.push({ r, c, area });
    }
  }
  if (numbers.reduce((sum, clue) => sum + clue.area, 0) !== height * width) return 0;

  const bits = Array.from({ length: height * width }, (_, i) => 1n << BigInt(i));
  const byCell = bits.map(() => []);
  for (const clue of numbers) {
    for (let h = 1; h <= height; h++) {
      if (clue.area % h !== 0) continue;
      const w = clue.area / h;
      if (w > width) continue;
      for (let top = Math.max(0, clue.r - h + 1); top <= Math.min(clue.r, height - h); top++) {
        for (let left = Math.max(0, clue.c - w + 1); left <= Math.min(clue.c, width - w); left++) {
          if (numbers.some(other => other !== clue && other.r >= top && other.r < top + h
            && other.c >= left && other.c < left + w)) continue;
          let mask = 0n;
          const cells = [];
          for (let r = top; r < top + h; r++) {
            for (let c = left; c < left + w; c++) {
              const index = r * width + c;
              cells.push(index);
              mask |= bits[index];
            }
          }
          for (const cell of cells) byCell[cell].push(mask);
        }
      }
    }
  }

  const full = (1n << BigInt(bits.length)) - 1n;
  let solutions = 0;
  let nodes = 0;
  let exhausted = false;
  function search(covered) {
    if (solutions >= 2 || exhausted) return;
    if (++nodes > maxNodes) { exhausted = true; return; }
    if (covered === full) { solutions++; return; }
    let choices = null;
    // Branch on the uncovered cell with the fewest available rectangles.
    // This also forces cells that can only belong to one rectangle.
    for (let cell = 0; cell < bits.length; cell++) {
      if (covered & bits[cell]) continue;
      const available = byCell[cell].filter(mask => (mask & covered) === 0n);
      if (!available.length) return;
      if (choices === null || available.length < choices.length) choices = available;
      if (choices.length === 1) break;
    }
    for (const mask of choices) search(covered | mask);
  }
  search(0n);
  return exhausted ? null : solutions;
}
