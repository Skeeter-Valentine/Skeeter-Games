import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

test('Parshle and Word500 have distinct, repeatable daily answers across ten years', async () => {
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  try {
    const { getDailyTargetWord, getParshleDailyTargetWord, isValidWord } = await server.ssrLoadModule('/src/games/word500/constants/wordBank.js');
    const answers = new Set();
    for (let day = 0; day < 3653; day++) {
      const date = new Date(Date.UTC(2026, 0, 1) + day * 86400000).toISOString().slice(0, 10);
      const word = getParshleDailyTargetWord(date);
      assert.notEqual(word, getDailyTargetWord(date), date);
      assert.ok(isValidWord(word), date);
      assert.equal(word, getParshleDailyTargetWord(date), date);
      answers.add(word);
    }
    assert.ok(answers.size > 1000);
  } finally {
    await server.close();
  }
});
