// Builds Skeetmate's puzzles. The bank (src/games/chess/puzzleBank.js, from
// the free Lichess puzzle database, CC0: https://database.lichess.org/#puzzles)
// stays out of the site; this writes what the site downloads, to public/chess:
//   daily/YYYY-MM.json   each date's daily puzzle, one file per month
//   practice/L-N.json    batches of practice puzzles for spice level L
// and src/games/chess/bankInfo.js (the batch counts and a version, so
// browsers fetch new files after a rebuild).
//
// Rebuild the site's files from the bank (after changing the schedule, say):
//      node scripts/build-chess-puzzles.mjs
// Add puzzles from Lichess, then rebuild:
//   1. Download lichess_db_puzzle.csv.zst from that page (about 250 MB).
//   2. From the my-app folder run:
//      node scripts/build-chess-puzzles.mjs path/to/lichess_db_puzzle.csv.zst
//    The .zst file is read directly (Node 22.15 or newer); an unpacked .csv
//    works too. New puzzles are added after the ones already in the bank.
//
// Options:
//   --per-level N   new puzzles added for each pepper level (default 400)
//   --max-moves N   longest solution, counting the player's moves (default 4)
//   --years N       how far ahead dailies are written (default 3)
//
// Dailies already given out keep their puzzle: dates up to tomorrow (UTC) are
// kept as written; later dates get puzzles not used before, in a fixed
// shuffled order, so a bigger bank spreads into the future. Only puzzles that
// end in mate or clearly won material (clearFinish) are used.
//
// It keeps well-liked, well-tested puzzles (popularity, number of plays and a
// settled rating), checks each one plays through with the site's own chess
// rules, and spreads the picks across the themes (forks, pins, mates...).
import { createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { Readable } from 'node:stream';
import { createZstdDecompress, zstdDecompressSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { clearFinish, legacyDailyPuzzle } from '../src/games/chess/bankTools.js';
import { dailyLevel, levelOf, puzzleProblems, toPuzzle } from '../src/games/chess/puzzles.js';

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
  const lines = rows.map(r => `  ${JSON.stringify(Array.isArray(r) ? r : [r.id, r.fen, r.moves, r.rating, r.themes])},`);
  return `// The chess puzzle bank: [id, fen, moves, rating, themes]. Built by
// scripts/build-chess-puzzles.mjs from the Lichess puzzle database
// (lichess.org, CC0). \`fen\` is the position before the opponent's move;
// \`moves\` (UCI) starts with that move, then alternates player and opponent.
export default [
${lines.join('\n')}
];
`;
}

// ----- The site's files -----
export const FIRST_DAY = '2026-11-01'; // Skeetmate launched Nov 17, 2026
export const PRACTICE_BATCH = 50;
const DAY = 86400000;
export const addDays = (date, days) => new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
const order = (rows, seed) => [...rows].sort((a, b) => hash(`${seed}:${a[0]}`) - hash(`${seed}:${b[0]}`) || a[0].localeCompare(b[0]));

// Each date's puzzle id from FIRST_DAY through `through`. `kept` holds dates
// already given out ({ date: id }); dates before `keepBefore` keep theirs (or,
// with none yet, the puzzle the site used to pick). Later dates get each
// level's clear-finish puzzles not used yet, in a fixed shuffled order,
// starting over when a level runs out.
export function assignDailies(rows, { kept = {}, keepBefore, through, legacy = null }) {
  const byId = new Map(rows.map(row => [row[0], row]));
  const assigned = {};
  const used = new Set();
  for (let date = FIRST_DAY; date < keepBefore && date <= through; date = addDays(date, 1)) {
    const id = kept[date] ?? legacy?.(date);
    if (!id || !byId.has(id)) throw new Error(`No puzzle kept for ${date}`);
    assigned[date] = id;
    used.add(id);
  }
  const queues = new Map([1, 2, 3].map(level => {
    const clear = rows.filter(row => levelOf(row[3]) === level && clearFinish(toPuzzle(row)));
    return [level, { all: order(clear, 'chess-daily-v2'), next: 0 }];
  }));
  for (let date = keepBefore > FIRST_DAY ? keepBefore : FIRST_DAY; date <= through; date = addDays(date, 1)) {
    const queue = queues.get(dailyLevel(date));
    if (!queue.all.length) throw new Error(`No puzzles for level ${dailyLevel(date)}`);
    let id;
    for (let tries = 0; tries < queue.all.length && !id; tries++) {
      const candidate = queue.all[queue.next % queue.all.length][0];
      queue.next++;
      if (!used.has(candidate)) id = candidate;
    }
    if (!id) { // every puzzle of this level used: start over
      for (const row of queue.all) used.delete(row[0]);
      id = queue.all[queue.next++ % queue.all.length][0];
    }
    assigned[date] = id;
    used.add(id);
  }
  return assigned;
}

// The files under public/chess and bankInfo.js, as { path: text }.
export function siteFiles(rows, assigned) {
  const byId = new Map(rows.map(row => [row[0], row]));
  const files = {};
  const monthly = {};
  for (const [date, id] of Object.entries(assigned)) (monthly[date.slice(0, 7)] ??= {})[date] = byId.get(id);
  for (const [month, days] of Object.entries(monthly)) files[`daily/${month}.json`] = JSON.stringify(days);
  const batches = {};
  for (const level of [1, 2, 3]) {
    const clear = order(rows.filter(row => levelOf(row[3]) === level && clearFinish(toPuzzle(row))), 'chess-practice-v1');
    batches[level] = Math.max(1, Math.ceil(clear.length / PRACTICE_BATCH));
    for (let i = 0; i < batches[level]; i++) files[`practice/${level}-${i}.json`] = JSON.stringify(clear.slice(i * PRACTICE_BATCH, (i + 1) * PRACTICE_BATCH));
  }
  const version = hash(Object.entries(files).map(([path, text]) => path + text).join('\n')).toString(36);
  const dates = Object.keys(assigned).sort();
  const info = { version, practiceBatches: batches, dailyFrom: dates[0], dailyThrough: dates.at(-1) };
  return { files, info: `// Written by scripts/build-chess-puzzles.mjs: what's in public/chess.
export default ${JSON.stringify(info, null, 2)};
` };
}

// The dailies already written to public/chess/daily ({ date: id }).
export function readKept(folder) {
  const kept = {};
  if (!existsSync(folder)) return kept;
  for (const name of readdirSync(folder).filter(file => /^\d{4}-\d{2}\.json$/.test(file))) {
    for (const [date, row] of Object.entries(JSON.parse(readFileSync(`${folder}/${name}`, 'utf8')))) kept[date] = row[0];
  }
  return kept;
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
  const file = args.find(a => !a.startsWith('--') && !/^\d+$/.test(a));
  const option = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? Number(args[i + 1]) : fallback; };
  const perLevel = option('--per-level', 400), maxMoves = option('--max-moves', 4), years = option('--years', 3);
  const bankPath = fileURLToPath(new URL('../src/games/chess/puzzleBank.js', import.meta.url));
  let rows = (await import('../src/games/chess/puzzleBank.js')).default;

  if (file) {
    const have = new Set(rows.map(row => row[0]));
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
      if (!acceptable(row, maxMoves) || have.has(row.id)) continue;
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
      console.error(`No new puzzles found in ${file} (read ${read.toLocaleString()} rows), so the bank was left as it was.`);
      process.exit(1);
    }
    rows = [...rows, ...chosen.map(r => [r.id, r.fen, r.moves, r.rating, r.themes])];
    writeFileSync(bankPath, bankSource(rows));
    const counts = [1, 2, 3].map(level => chosen.filter(r => levelOf(r.rating) === level).length);
    console.log(`Read ${read.toLocaleString()} rows; added ${chosen.length} puzzles (Mild ${counts[0]}, Medium ${counts[1]}, Picante ${counts[2]}); the bank has ${rows.length}.`);
  }

  const publicDir = fileURLToPath(new URL('../public/chess', import.meta.url));
  const today = new Date().toISOString().slice(0, 10);
  const kept = readKept(`${publicDir}/daily`);
  const assigned = assignDailies(rows, { kept, keepBefore: addDays(today, 2), through: addDays(today, Math.round(years * 365)),
    legacy: Object.keys(kept).length ? null : date => legacyDailyPuzzle(date).id });
  const { files, info } = siteFiles(rows, assigned);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(`${publicDir}/${path.split('/')[0]}`, { recursive: true });
    writeFileSync(`${publicDir}/${path}`, text);
  }
  writeFileSync(fileURLToPath(new URL('../src/games/chess/bankInfo.js', import.meta.url)), info);
  const clear = rows.filter(row => clearFinish(toPuzzle(row))).length;
  console.log(`Wrote dailies through ${Object.keys(assigned).sort().at(-1)} and ${Object.keys(files).length} files to public/chess (${clear} of ${rows.length} puzzles have a clear finish).`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
