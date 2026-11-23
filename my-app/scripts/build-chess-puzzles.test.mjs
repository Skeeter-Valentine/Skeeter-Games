import assert from 'node:assert/strict';
import test from 'node:test';
import BANK from '../src/games/chess/puzzleBank.js';
import { acceptable, assignDailies, bankSource, choose, parseRow, siteFiles } from './build-chess-puzzles.mjs';

const ROW = '00sHx,q3k1nr/1pp1nQpp/3p4/1P2p3/4P3/B1PP1b2/B5PP/5K2 b k - 0 17,e8d7 a2e6 d7d8 f7f8,1760,80,83,72,mate mateIn2 middlegame short,https://lichess.org/yyznGmXs/black#34,Italian_Game';

test('reads Lichess rows and keeps only well-tested, short puzzles', () => {
  const row = parseRow(ROW);
  assert.equal(row.id, '00sHx');
  assert.equal(row.moves, 'e8d7 a2e6 d7d8 f7f8');
  assert.equal(row.rating, 1760);
  assert.equal(parseRow('PuzzleId,FEN,Moves,Rating'), null);
  assert.equal(acceptable({ ...row, plays: 5000, popularity: 90 }), true);
  assert.equal(acceptable({ ...row, popularity: 90 }), false, 'too few plays');
  assert.equal(acceptable({ ...row, plays: 5000, popularity: 50 }), false);
  assert.equal(acceptable({ ...row, plays: 5000, popularity: 90, moves: 'a b c d e f g h i j' }, 4), false, 'too long');
});

test('choosing spreads picks across levels and themes, and writes a module', () => {
  const rows = [];
  for (let i = 0; i < 30; i++) rows.push({ id: `a${i}`, fen: 'f', moves: 'm n', rating: 900 + i * 50, themes: i % 2 ? 'fork short' : 'pin short' });
  const chosen = choose(rows, 4);
  assert.ok(chosen.length <= 12);
  const mild = chosen.filter(r => r.rating < 1400);
  assert.equal(mild.length, 4);
  assert.deepEqual(new Set(mild.map(r => r.themes)).size, 2, 'both themes appear');
  assert.match(bankSource(chosen.slice(0, 1)), /^\/\/ The chess puzzle bank[\s\S]*export default \[\n  \["a\d+"/);
});

test('a bigger bank keeps dailies already given out and fills later dates with new puzzles', () => {
  const first = assignDailies(BANK.slice(0, 900), { keepBefore: '2026-11-01', through: '2027-03-31' });
  const kept = Object.fromEntries(Object.entries(first).filter(([date]) => date < '2026-12-01'));
  const second = assignDailies(BANK, { kept, keepBefore: '2026-12-01', through: '2027-03-31' });
  for (const [date, id] of Object.entries(kept)) assert.equal(second[date], id, date);
  const used = new Set(Object.values(kept));
  for (const [date, id] of Object.entries(second)) if (date >= '2026-12-01') assert.ok(!used.has(id), `${date} reuses ${id}`);
  assert.ok(Object.values(second).some(id => !BANK.slice(0, 900).some(row => row[0] === id)), 'the new puzzles get used');
  const { files, info } = siteFiles(BANK, second);
  assert.equal(Object.keys(JSON.parse(files['daily/2027-02.json'])).length, 28);
  assert.ok(files['practice/1-0.json'].length < 12000, 'a practice batch is small');
  assert.match(info, /"dailyThrough": "2027-03-31"/);
});
