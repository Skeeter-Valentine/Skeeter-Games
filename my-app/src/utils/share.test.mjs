import assert from 'node:assert/strict';
import test from 'node:test';
import { dailyShareText, emojiRow, shareResult } from './share.js';

test('logic puzzles share their time and pepper rating', () => {
  assert.equal(dailyShareText({ title: 'Skeedograms', date: '2026-10-28', won: true, seconds: 222, level: 2, url: 'https://skeetergames.org/nonograms' }),
    'Skeedograms · Oct 28 · 🌶️🌶️\n✅ Solved in 3:42\nskeetergames.org/nonograms');
  assert.match(dailyShareText({ title: 'Akari', date: '2026-10-28', won: false, url: 'https://x.org/akari' }), /❌ Not solved/);
});

test('word games share guesses used and their grid', () => {
  const text = dailyShareText({ title: 'Skeedle+', date: '2026-10-28', won: true, seconds: 75, guesses: 3, maxGuesses: 6,
    grid: [emojiRow(['default', 'yellow', 'green']), emojiRow(['green', 'green', 'green'])], url: 'https://skeetergames.org/skeedlemath' });
  assert.equal(text, 'Skeedle+ · Oct 28\n✅ 3/6 · 1:15\n⬜🟨🟩\n🟩🟩🟩\nskeetergames.org/skeedlemath');
  assert.match(dailyShareText({ title: 'Parshle', date: '2026-10-28', won: false, guesses: 6, maxGuesses: 6, url: 'x' }), /❌ X\/6/);
  assert.match(dailyShareText({ title: 'Old', date: '2026-10-01', archive: true, won: true, url: 'x' }), /Archive · Oct 1/);
});

test('share sheet on phones, clipboard elsewhere', async () => {
  const copied = [];
  const nav = { share: async () => {}, clipboard: { writeText: async text => copied.push(text) } };
  assert.equal(await shareResult('a', nav, { matchMedia: () => ({ matches: false }) }), 'copied');
  assert.equal(await shareResult('b', nav, { matchMedia: () => ({ matches: true }) }), 'shared');
  const cancel = { share: async () => { throw Object.assign(new Error('x'), { name: 'AbortError' }); }, clipboard: nav.clipboard };
  assert.equal(await shareResult('c', cancel, { matchMedia: () => ({ matches: true }) }), 'cancelled');
  assert.equal(await shareResult('d', { clipboard: { writeText: async () => { throw new Error('no'); } } }, {}), 'failed');
  assert.deepEqual(copied, ['a']);
});

test('Ske4dle shares which guess solved each word', async () => {
  const { quordleShareGrid } = await import('./share.js');
  assert.deepEqual(quordleShareGrid(['A', 'B', 'C', 'D'], ['X', 'B', 'A', 'Y', 'C']), ['3️⃣2️⃣', '5️⃣🟥']);
});
