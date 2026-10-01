import { getDailyBoardConfig } from './dailyConfig.js';

export function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function getDailySeed(dateStr) {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash << 5) - hash + dateStr.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export const neighborsOf = (r, c, rows, cols) => {
  const neighbors = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (dr === 0 && dc === 0) continue;
    const nr = r + dr, nc = c + dc;
    if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) neighbors.push([nr, nc]);
  }
  return neighbors;
};

// The complete daily layout: archive snapshots store this so a past board
// survives later changes to the size schedule or generator.
export function dailyLayout(dateStr) {
  const { rows, cols, mines } = getDailyBoardConfig(dateStr);
  const rng = mulberry32(getDailySeed(dateStr));
  const startR = Math.floor(rng() * rows);
  const startC = Math.floor(rng() * cols);
  const safeZone = new Set(neighborsOf(startR, startC, rows, cols).map(([r, c]) => `${r}-${c}`));
  safeZone.add(`${startR}-${startC}`);
  const mineCells = [], placed = new Set();
  while (mineCells.length < mines) {
    const r = Math.floor(rng() * rows);
    const c = Math.floor(rng() * cols);
    const key = `${r}-${c}`;
    if (!safeZone.has(key) && !placed.has(key)) { placed.add(key); mineCells.push([r, c]); }
  }
  return { rows, cols, mines, start: [startR, startC], mineCells };
}

export function validLayout(layout) {
  return !!layout && Number.isInteger(layout.rows) && Number.isInteger(layout.cols)
    && Number.isInteger(layout.mines) && Array.isArray(layout.mineCells)
    && layout.mineCells.length === layout.mines && Array.isArray(layout.start);
}

export function revealFrom(board, r, c) {
  const rows = board.length, cols = board[0].length, stack = [[r, c]];
  while (stack.length) {
    const [cr, cc] = stack.pop();
    const cell = board[cr][cc];
    if (cell.isRevealed || cell.isFlagged) continue;
    cell.isRevealed = true;
    if (cell.neighborMines === 0 && !cell.isMine) stack.push(...neighborsOf(cr, cc, rows, cols));
  }
  return board;
}

export function boardFromLayout({ rows, cols, start, mineCells }) {
  const board = Array.from({ length: rows }, (_, row) => Array.from({ length: cols }, (_, col) => ({
    row, col, isMine: false, isRevealed: false, isFlagged: false, neighborMines: 0,
  })));
  for (const [r, c] of mineCells) board[r][c].isMine = true;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (!board[r][c].isMine) board[r][c].neighborMines = neighborsOf(r, c, rows, cols).filter(([nr, nc]) => board[nr][nc].isMine).length;
  }
  return revealFrom(board, start[0], start[1]);
}

// Saved progress is accepted only for the exact same mine layout.
export function restoreMinesweeper(layout, saved) {
  const board = saved?.board;
  if (!Array.isArray(board) || board.length !== layout.rows
    || !board.every(row => Array.isArray(row) && row.length === layout.cols)) return null;
  const mines = new Set(layout.mineCells.map(([r, c]) => `${r}-${c}`));
  for (let r = 0; r < layout.rows; r++) for (let c = 0; c < layout.cols; c++) {
    if (!!board[r][c]?.isMine !== mines.has(`${r}-${c}`)) return null;
  }
  const status = ['playing', 'won', 'lost'].includes(saved.gameStatus) ? saved.gameStatus : 'playing';
  const timer = Number.isFinite(saved.timer) && saved.timer >= 0 ? Math.floor(saved.timer) : 0;
  const flags = board.flat().filter(cell => cell.isFlagged).length;
  return { board, gameStatus: status, timer, flagsLeft: layout.mines - flags };
}
