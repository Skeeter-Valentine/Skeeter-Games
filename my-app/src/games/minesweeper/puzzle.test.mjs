import assert from 'node:assert/strict';
import test from 'node:test';
import { getDailyBoardConfig } from './dailyConfig.js';
import { dailyLayout, boardFromLayout, restoreMinesweeper, mulberry32, getDailySeed, neighborsOf } from './puzzle.js';

// The board generation that shipped before archives, kept to prove that
// moving it into puzzle.js did not change any live daily board.
function legacyMines(date) {
  const { rows, cols, mines } = getDailyBoardConfig(date);
  const rng = mulberry32(getDailySeed(date));
  const startR = Math.floor(rng() * rows), startC = Math.floor(rng() * cols);
  const safe = new Set();
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    const r = startR + dr, c = startC + dc;
    if (r >= 0 && r < rows && c >= 0 && c < cols) safe.add(`${r}-${c}`);
  }
  const set = new Set();
  while (set.size < mines) {
    const r = Math.floor(rng() * rows), c = Math.floor(rng() * cols);
    if (!safe.has(`${r}-${c}`)) set.add(`${r}-${c}`);
  }
  return { start: [startR, startC], set };
}

test('daily layouts match the pre-archive generator', () => {
  for (const date of ['2026-08-20', '2026-09-01', '2026-09-15', '2026-09-30']) {
    const layout = dailyLayout(date), legacy = legacyMines(date);
    assert.deepEqual(layout.start, legacy.start);
    assert.deepEqual(new Set(layout.mineCells.map(([r, c]) => `${r}-${c}`)), legacy.set);
  }
});

test('the starting area is safe and opened', () => {
  const layout = dailyLayout('2026-09-10');
  const board = boardFromLayout(layout);
  const [r, c] = layout.start;
  assert.equal(board[r][c].isRevealed, true);
  for (const [nr, nc] of neighborsOf(r, c, layout.rows, layout.cols)) assert.equal(board[nr][nc].isMine, false);
  assert.equal(board.flat().filter(cell => cell.isMine).length, layout.mines);
});

test('progress restores only onto the same mine layout', () => {
  const layout = dailyLayout('2026-09-10');
  const board = boardFromLayout(layout);
  const hidden = board.flat().find(cell => !cell.isRevealed);
  board[hidden.row][hidden.col].isFlagged = true;
  const restored = restoreMinesweeper(layout, { board, gameStatus: 'playing', timer: 42 });
  assert.equal(restored.timer, 42);
  assert.equal(restored.flagsLeft, layout.mines - 1);
  assert.equal(restoreMinesweeper(dailyLayout('2026-09-11'), { board, gameStatus: 'playing', timer: 1 }), null);
  assert.equal(restoreMinesweeper(layout, null), null);
});
