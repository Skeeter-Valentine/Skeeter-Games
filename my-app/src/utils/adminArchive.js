import { ARCHIVE_START } from './archive.js';
import { combineRates, rankPuzzles } from './difficulty.js';
import { dailyDifficulty } from './dailyDifficulty.js';

export const GAME_TITLES = {
  map: 'Cartograskeet', akari: 'Skeeluminate', stitches: 'Skitches', parshle: 'Parshle', word500: 'Skeedle500',
  quordle: 'Ske4dle', shikaku: 'Shikaku', minesweeper: 'Mineskeeter', sudoku: 'Skeedoku', pipes: 'Skeeter Piper',
  hashi: 'Hashi', nonograms: 'Skeedograms', skeedlemath: 'Skeedle+', 'skeedle-marathon': 'Skeedle Marathon', 2048: '2048', 'skeedle-beadle': 'Skeedle Beadle',
};

export function puzzleDates(today) {
  const dates = [];
  for (let day = Date.parse(`${ARCHIVE_START}T00:00:00Z`); day <= Date.parse(`${today}T00:00:00Z`); day += 86400000) {
    dates.push(new Date(day).toISOString().slice(0, 10));
  }
  return dates;
}

export function buildRows(game, docs, today) {
  const byDate = new Map();
  for (const doc of docs) {
    if (!doc?.date) continue;
    if (!byDate.has(doc.date)) byDate.set(doc.date, []);
    byDate.get(doc.date).push(doc);
  }
  return rankPuzzles(puzzleDates(today).map(date => ({
    date, chili: dailyDifficulty(game, date), rates: byDate.has(date) ? combineRates(byDate.get(date)) : null,
  })));
}
