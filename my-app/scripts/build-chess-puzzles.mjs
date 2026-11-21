// Fills the chess puzzle bank (src/games/chess/puzzleBank.js) from the free
// Lichess puzzle database (CC0: https://database.lichess.org/#puzzles).
//
// 1. Download lichess_db_puzzle.csv.zst from that page (about 250 MB).
// 2. From the my-app folder run:
//      node scripts/build-chess-puzzles.mjs path/to/lichess_db_puzzle.csv.zst
//    The .zst file is read directly (Node 22.15 or newer); an unpacked .csv
//    works too.
//
// Options:
//   --per-level N   puzzles kept for each pepper level (default 400, so
//                   1,200 in all: years of dailies, about 300 KB)
//   --max-moves N   longest solution, counting the player's moves (default 4)
//
// It keeps well-liked, well-tested puzzles (popularity, number of plays and a
// settled rating), checks each one plays through with the site's own chess
// rules and ends in mate or clearly won material (clearFinish in puzzles.js),
// and spreads the picks across the themes (forks, pins, mates...).
import { createReadStream, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { Readable } from 'node:stream';
import { createZstdDecompress, zstdDecompressSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { clearFinish, levelOf, puzzleProblems, toPuzzle } from '../src/games/chess/puzzles.js';

export const MIN_POPULARITY = 85, MIN_PLAYS = 1000, MAX_DEVIATION = 80;

// FNV hash, so the same database always gives the same picks.
const hash = text => { let h = 2166136261; for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };

export function parseRow(line) {
  const [id, fen, moves, rating, deviation, popularity, plays, themes] = line.split(',');
  if (!id || id === 'PuzzleId') return null;
  return { id, fen, moves, rating: Number(rating), deviation: Number(deviation), popularity: Number(popularity),
    plays: Number(plays), themes: themes || '' };
}

export function acceptable(row, maxMoves = 4) {
  if (!row || row.popularity < MIN_POPULARITY || row.plays < MIN_PLAYS || row.deviation > MAX_DEVIATION) return false;
  const count = row.moves.split(' ').length;
  return count >= 2 && count % 2 === 0 && count / 2 <= maxMoves;
}

// Picks `perLevel` per level, round-robin over each puzzle's main theme so no
// single motif takes over, in a stable hashed order.
export function choose(candidates, perLevel) {
  const chosen = [];
  for (const level of [1, 2, 3]) {
    const byTheme = new Map();
    for (const row of candidates.filter(r => levelOf(r.rating) === level)) {
      const theme = row.themes.split(' ').find(t => !/^(short|long|veryLong|oneMove|middlegame|endgame|opening|advantage|crushing|master|masterVsMaster|superGM)$/.test(t)) || 'other';
      if (!byTheme.has(theme)) byTheme.set(theme, []);
      byTheme.get(theme).push(row);
    }
    const queues = [...byTheme.values()].map(list => list.sort((a, b) => hash(a.id) - hash(b.id)));
    let picked = 0;
    for (let round = 0; picked < perLevel && queues.some(q => q.length > round); round++) {
      for (const queue of queues) if (queue[round] && picked < perLevel) { chosen.push(queue[round]); picked++; }
    }
  }
  return chosen;
}

export function bankSource(rows) {
  const lines = rows.map(r => `  ${JSON.stringify([r.id, r.fen, r.moves, r.rating, r.themes])},`);
  return `// The chess puzzle bank: [id, fen, moves, rating, themes]. Built by
// scripts/build-chess-puzzles.mjs from the Lichess puzzle database
// (lichess.org, CC0). \`fen\` is the position before the opponent's move;
// \`moves\` (UCI) starts with that move, then alternates player and opponent.
export default [
${lines.join('\n')}
];
`;
}

// The Lichess file is written in "pzstd" style: each compressed frame is
// preceded by a small "skippable" frame giving its size, which Node's zstd
// stream won't accept. Walk the frames ourselves: skip the skippable ones and
// decompress the rest one at a time.
export function* zstdFrames(buffer) {
  let at = 0;
  while (at + 8 <= buffer.length) {
    const magic = buffer.readUInt32LE(at);
    if ((magic & 0xfffffff0) === 0x184d2a50) {
      const size = buffer.readUInt32LE(at + 4);
      if (size === 4 && at + 12 <= buffer.length) {
        const frameSize = buffer.readUInt32LE(at + 8);
        const start = at + 12;
        yield zstdDecompressSync(buffer.subarray(start, start + frameSize));
        at = start + frameSize;
      } else {
        at += 8 + size;
      }
      continue;
    }
    // Ordinary frames from here on: decompress the rest in one go.
    yield zstdDecompressSync(buffer.subarray(at));
    return;
  }
}

function lineSource(file) {
  if (!file.endsWith('.zst')) return createReadStream(file);
  const buffer = readFileSync(file);
  const isSkippable = (buffer.readUInt32LE(0) & 0xfffffff0) === 0x184d2a50;
  if (!isSkippable) return createReadStream(file).pipe(createZstdDecompress());
  return Readable.from(zstdFrames(buffer));
}

async function main() {
  const args = process.argv.slice(2);
  const file = args.find(a => !a.startsWith('--'));
  const option = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? Number(args[i + 1]) : fallback; };
  if (!file) { console.error('Usage: node scripts/build-chess-puzzles.mjs lichess_db_puzzle.csv.zst [--per-level 400] [--max-moves 4]'); process.exit(1); }
  const perLevel = option('--per-level', 400), maxMoves = option('--max-moves', 4);
  const input = lineSource(file);
  // Stop on a read error, leaving the bank as it was.
  input.on('error', error => { console.error(`Couldn't read ${file}: ${error.message}`); process.exit(1); });
  // Keep a bounded, evenly hashed sample per level while reading (the full
  // file has millions of rows).
  const keep = new Map([[1, []], [2, []], [3, []]]);
  const cap = perLevel * 25;
  let read = 0;
  for await (const line of createInterface({ input, crlfDelay: Infinity })) {
    read++;
    if (read % 500000 === 0) console.log(`  read ${read.toLocaleString()} rows...`);
    const row = parseRow(line);
    if (!acceptable(row, maxMoves)) continue;
    const list = keep.get(levelOf(row.rating));
    list.push(row);
    if (list.length > cap * 2) { list.sort((a, b) => hash(a.id) - hash(b.id)); list.length = cap; }
  }
  // Only puzzles that play through and end in mate or clearly won material.
  const candidates = [...keep.values()].flat().filter(row => {
    const puzzle = toPuzzle([row.id, row.fen, row.moves, row.rating, row.themes]);
    return !puzzleProblems(puzzle).length && clearFinish(puzzle);
  });
  const chosen = choose(candidates, perLevel);
  if (!chosen.length) {
    console.error(`No puzzles found in ${file} (read ${read.toLocaleString()} rows), so the bank was left as it was.`);
    process.exit(1);
  }
  const out = fileURLToPath(new URL('../src/games/chess/puzzleBank.js', import.meta.url));
  writeFileSync(out, bankSource(chosen));
  const counts = [1, 2, 3].map(level => chosen.filter(r => levelOf(r.rating) === level).length);
  console.log(`Read ${read.toLocaleString()} rows; wrote ${chosen.length} puzzles (Mild ${counts[0]}, Medium ${counts[1]}, Picante ${counts[2]}) to src/games/chess/puzzleBank.js`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
