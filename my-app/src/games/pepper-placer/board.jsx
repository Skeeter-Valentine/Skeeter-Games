// Shared pieces of the Pepper Placer board (game and walkthrough).

// Patch colours: neighbouring patches never share one.
// Nine light tints, one per patch on every board size (up to 9 patches), so
// colours only repeat on bigger practice boards, and never side by side.
export const PATCH_COLORS = ['#f6e3bf', '#c6e0f7', '#cdeed6', '#f6cfd9', '#ddd2f6', '#f5ec9f', '#fbd2b3', '#b9e8ea', '#dfe8bc'];
export function colourPatches({ size: n, regions }) {
  const neighbours = new Map();
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const id = regions[r][c];
    if (!neighbours.has(id)) neighbours.set(id, new Set());
    for (const [dr, dc] of [[1, 0], [0, 1]]) {
      const other = regions[r + dr]?.[c + dc];
      if (other !== undefined && other !== id) {
        neighbours.get(id).add(other);
        if (!neighbours.has(other)) neighbours.set(other, new Set());
        neighbours.get(other).add(id);
      }
    }
  }
  const colour = new Map();
  for (const id of [...neighbours.keys()].sort((a, b) => neighbours.get(b).size - neighbours.get(a).size)) {
    const used = new Set([...neighbours.get(id)].map(other => colour.get(other)));
    // Of the colours no neighbour has, take the least used so far.
    const counts = PATCH_COLORS.map((_, index) => [...colour.values()].filter(value => value === index).length);
    const free = PATCH_COLORS.map((_, index) => index).filter(index => !used.has(index));
    colour.set(id, free.sort((a, b) => counts[a] - counts[b] || a - b)[0] ?? 0);
  }
  return colour;
}

export function Pepper({ className = 'pp-pepper' }) {
  return <svg className={className} viewBox="0 0 32 40" aria-hidden="true" focusable="false">
    <path d="M19 11C25 9 29 13 28 20C26 30 17 36 4 37C13 32 14 27 14 20C14 16 15 12 19 11Z" fill="#e8343c" stroke="#251722" strokeWidth="2.2" strokeLinejoin="round" />
    <path d="M17 13L20 9C19 5 21 2 25 2L26 6C23 6 23 8 24 10L27 13L22 12L20 15Z" fill="#4d9e45" stroke="#251722" strokeWidth="2.2" strokeLinejoin="round" />
    <path d="M18 16C17 21 16 25 12 29" fill="none" stroke="#ff9a8f" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
  </svg>;
}


// Classes for the heavy patch outlines around a cell: t, r, b, l.
export function cellEdges(regions, r, c) {
  const n = regions.length, patch = regions[r][c];
  return [r === 0 || regions[r - 1][c] !== patch ? ' t' : '', c === n - 1 || regions[r][c + 1] !== patch ? ' r' : '',
    r === n - 1 || regions[r + 1][c] !== patch ? ' b' : '', c === 0 || regions[r][c - 1] !== patch ? ' l' : ''].join('');
}
