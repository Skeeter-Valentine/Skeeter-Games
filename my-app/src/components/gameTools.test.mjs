import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { gameInstructions } from './gameInstructions.js';

test('all 13 active games render accessible statistics and instructions icons', async () => {
  const oldStorage = globalThis.localStorage, oldWindow = globalThis.window;
  globalThis.localStorage = { getItem: () => null };
  globalThis.window = { innerWidth: 1024 };
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  try {
    const games = [
      ['2048/Game2048', '2048'], ['hashi/Hashi', 'hashi'], ['minesweeper/Minesweeper', 'minesweeper'],
      ['nerdle/Nerdle', 'nerdle'], ['nonograms/Nonograms', 'nonograms'], ['pipes/pipes', 'pipes'],
      ['quordle/Quordle', 'quordle'], ['shikaku/shikaku', 'shikaku'], ['skeedle-marathon/SkeedleMarathon', 'skeedle-marathon'],
      ['stitches/Stitches', 'stitches'], ['sudoku/Sudoku', 'sudoku'], ['word500/Word500', 'word500'], ['map/Map', 'map'],
    ];
    for (const [path, id] of games) {
      assert.ok(gameInstructions[id]?.length >= 4, `${id} needs complete game directions`);
      const { default: Game } = await server.ssrLoadModule(`/src/games/${path}.jsx`);
      const html = renderToString(React.createElement(MemoryRouter, null, React.createElement(Game)));
      assert.equal((html.match(/title="Statistics"/g) || []).length, 1, `${id} needs one stats icon`);
      assert.equal((html.match(/title="How to play"/g) || []).length, 1, `${id} needs one instructions icon`);
      assert.ok(html.includes('aria-haspopup="dialog"'));
    }
    const { default: DailyResults } = await server.ssrLoadModule('/src/components/DailyResults.jsx');
    for (const daily of [true, false]) {
      const html = renderToString(React.createElement(DailyResults, {
        gameId: 'stitches', title: 'Skitches', daily, finished: false,
      }));
      assert.ok(html.includes('aria-label="Skitches statistics"'));
      assert.ok(html.includes('aria-label="Skitches instructions"'));
    }
  } finally {
    await server.close();
    globalThis.localStorage = oldStorage;
    globalThis.window = oldWindow;
  }
});
