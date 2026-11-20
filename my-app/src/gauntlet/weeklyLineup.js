// Which six games each Skeeter Gauntlet day uses. Shared, unchanged, by the
// site (src/gauntlet/gauntlet.js) and the Cloud Functions (copied into
// functions/shared by scripts/sync-functions-shared.mjs), so both always agree.
// No imports: it has to run in both places as-is.
//
// From LINEUP_RULES_FROM, games are planned a week at a time (Monday to
// Sunday, gauntlet days), at random within these rules:
// - Word games: two a day. The seven days use all six pairs of the four word
//   games plus one repeat (never on consecutive days), so each word game
//   plays 3 or 4 times a week.
// - Other puzzles: four a day, a different set every day, with plays shared
//   as evenly as possible: 28 slots over 10 puzzles is 3 plays each for eight
//   and 2 for the other two, which change from week to week.
// - From ONE_MILD_FROM, at most one single-pepper (Mild) game a day: a day
//   drawn with more has its extra Mild puzzles swapped for other puzzles that
//   aren't Mild that day (the ones with the fewest plays that week first).
// Games may play on consecutive days, so weeks don't fall into a pattern.
// Earlier days keep the original per-day draw (and its original 13 games),
// so past gauntlets, and any times recorded for them, never change.
//
// Its only import is the puzzle-difficulty code, which the sync script copies
// alongside it, so it still runs in both places as-is.
import { dailyDifficulty } from '../utils/dailyDifficulty.js';

// The games before Pepper Placer joined: the original per-day draw uses these.
const ORIGINAL_GAME_IDS = ['akari', 'skeedle-beadle', 'map', 'parshle', 'stitches', 'nonograms', 'skeedlemath',
  'pipes', 'shikaku', 'quordle', 'word500', 'minesweeper', 'hashi'];
export const WORD_GAMES = ['skeedlemath', 'quordle', 'parshle', 'word500'];
// The other puzzles in the weekly plan, from the Monday each list starts.
// Only add a list from a later Monday, so weeks already seen never change.
export const OTHER_GAME_POOLS = [
  { from: '2026-10-26', games: ['akari', 'skeedle-beadle', 'map', 'stitches', 'nonograms', 'pipes', 'shikaku', 'minesweeper', 'hashi', 'pepper-placer'] },
  // Add 'em Up (Kakurasu) takes Mineskeeter's place.
  { from: '2026-11-09', games: ['akari', 'skeedle-beadle', 'map', 'stitches', 'nonograms', 'pipes', 'shikaku', 'kakurasu', 'hashi', 'pepper-placer'] },
];
export const otherGamesFor = monday => OTHER_GAME_POOLS.filter(pool => pool.from <= monday).at(-1).games;
// The current list, and every game that has ever been in a gauntlet.
export const OTHER_GAMES = OTHER_GAME_POOLS.at(-1).games;
export const GAUNTLET_GAME_IDS = [...new Set([...ORIGINAL_GAME_IDS, ...OTHER_GAME_POOLS.flatMap(pool => pool.games)])];
export const GAUNTLET_SIZE = 6;
export const WORDS_PER_DAY = 2;
// A Monday. Change only to a later Monday, and only for days nobody has seen.
export const LINEUP_RULES_FROM = '2026-10-26';
// The first gauntlet day with at most MAX_MILD single-pepper games. Change
// only to a later day, and only for days nobody has seen.
export const ONE_MILD_FROM = '2026-11-19';
export const MAX_MILD = 1;
// Gauntlet puzzles come from the date this many days later (see gauntlet.js).
export const PUZZLE_DAY_OFFSET = 20000;

const DAY_MS = 86400000;
export const addDays = (day, days) => new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
// The Monday that starts the week containing `day`.
export const weekStart = day => addDays(day, -((new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7));

export function seeded(seedText) {
  let state = 2166136261;
  for (const char of seedText) state = Math.imul(state ^ char.charCodeAt(0), 16777619);
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const shuffler = rng => list => {
  const items = [...list];
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
};
const sameSet = (a, b) => a.length === b.length && a.every(id => b.includes(id));
// A game's pepper level on a gauntlet day (1 = Mild, one pepper).
export const gauntletLevel = (id, day) => dailyDifficulty(id, addDays(day, PUZZLE_DAY_OFFSET));

// ----- Custom spice levels -----
// A custom gauntlet can set a game's spice level (customGauntlets/{day}.levels,
// { gameId: 1 | 2 | 3 }). The game then uses a puzzle from a date that has
// that level: one of LEVEL_SLOTS dates set aside for each gauntlet day, far
// past every daily and normal gauntlet puzzle (and never shared between days),
// so it's a puzzle nobody has seen. Shared with the server, which needs the
// same levels for peppers.
const LEVEL_SLOTS = 32;
const LEVELS_FROM = '2200-01-01';
export const LEVELS = [1, 2, 3];
export function gamePuzzleDate(day, id, level = null) {
  const usual = addDays(day, PUZZLE_DAY_OFFSET);
  if (!LEVELS.includes(level) || dailyDifficulty(id, usual) === level) return usual;
  const first = addDays(LEVELS_FROM, Math.round(Date.parse(`${day}T00:00:00Z`) / DAY_MS) * LEVEL_SLOTS);
  for (let slot = 0; slot < LEVEL_SLOTS; slot++) {
    const date = addDays(first, slot);
    if (dailyDifficulty(id, date) === level) return date;
  }
  return usual; // No puzzle at that level: the day's own.
}
// The levels a game can be set to on `day` (word games other than Parshle
// only come at one).
export const levelChoices = (day, id) => LEVELS.filter(level => dailyDifficulty(id, gamePuzzleDate(day, id, level)) === level);
// Each game's { id, puzzleDate, level } for a day, given its custom levels.
export const gamePuzzles = (day, ids, levels = null) => ids.map(id => {
  const puzzleDate = gamePuzzleDate(day, id, levels?.[id]);
  return { id, puzzleDate, level: dailyDifficulty(id, puzzleDate) };
});

// The original rule (one independent draw per day), kept for earlier days.
function dailyDraw(day) {
  const shuffle = shuffler(seeded(`skeeter-gauntlet-v2:${day}`));
  const words = ORIGINAL_GAME_IDS.filter(id => WORD_GAMES.includes(id));
  const others = ORIGINAL_GAME_IDS.filter(id => !WORD_GAMES.includes(id));
  return shuffle([...shuffle(words).slice(0, WORDS_PER_DAY), ...shuffle(others).slice(0, GAUNTLET_SIZE - WORDS_PER_DAY)]);
}

// Seven word pairs: all six pairs plus one repeat, in a random order with
// the same pair never on two days running.
function planWords(rng) {
  const shuffle = shuffler(rng);
  const pairs = [];
  WORD_GAMES.forEach((a, i) => WORD_GAMES.slice(i + 1).forEach(b => pairs.push([a, b])));
  for (;;) {
    const order = shuffle([...pairs, pairs[Math.floor(rng() * pairs.length)]]);
    if (order.every((pair, d) => !d || !sameSet(pair, order[d - 1]))) return order;
  }
}

// Seven different sets of puzzles for the week, each puzzle playing its
// share of the slots (as even as possible), otherwise at random.
function planOthers(rng, games) {
  const shuffle = shuffler(rng);
  const perDay = GAUNTLET_SIZE - WORDS_PER_DAY;
  const slots = perDay * 7, base = Math.floor(slots / games.length), extra = slots % games.length;
  for (;;) {
    const left = Object.fromEntries(shuffle(games).map((id, i) => [id, base + (i < extra ? 1 : 0)]));
    const days = [];
    for (let d = 0; d < 7; d++) {
      const remainingDays = 7 - d;
      // A puzzle with a play left for every remaining day must play today;
      // the rest are picked at random from those with plays left.
      const open = shuffle(Object.keys(left).filter(id => left[id] > 0));
      const must = open.filter(id => left[id] >= remainingDays);
      const pick = [...must, ...open.filter(id => !must.includes(id))].slice(0, perDay);
      if (pick.length < perDay || must.length > perDay || days.some(set => sameSet(set, pick))) break;
      pick.forEach(id => { left[id] -= 1; });
      days.push(pick);
    }
    if (days.length === 7) return days;
  }
}

// Keeps a day to MAX_MILD Mild games (from ONE_MILD_FROM). The word games
// stay; extra Mild puzzles are swapped, in place, for puzzles that aren't Mild
// that day and aren't already playing, fewest plays that week first, never
// making the day's set the same as another day's.
function limitMild(plan, d, monday, games, rng) {
  const day = addDays(monday, d);
  if (day < ONE_MILD_FROM) return;
  const mild = id => gauntletLevel(id, day) === 1;
  const { words } = plan[d];
  const others = [...plan[d].others];
  const plays = id => plan.filter(entry => entry.others.includes(id)).length;
  const swaps = shuffler(rng)(games).filter(id => !mild(id)).sort((a, b) => plays(a) - plays(b));
  let allowed = MAX_MILD - words.filter(mild).length;
  for (let i = 0; i < others.length; i++) {
    if (!mild(others[i])) continue;
    if (allowed > 0) { allowed -= 1; continue; }
    const swap = swaps.find(id => !others.includes(id)
      && !plan.some((entry, j) => j !== d && sameSet(entry.others, others.map((old, k) => (k === i ? id : old)))));
    if (swap) others[i] = swap;
  }
  plan[d] = { words, others };
}

// A week's plan: seven days of { words, others }, worked out once per week.
const plans = new Map();
export function weekPlan(monday) {
  if (!plans.has(monday)) {
    const rng = seeded(`skeeter-gauntlet-week-v4:${monday}`);
    const words = planWords(rng);
    const games = otherGamesFor(monday);
    const others = planOthers(rng, games);
    const plan = words.map((pair, d) => ({ words: pair, others: others[d] }));
    // Its own random draw, so weeks before the rule never change.
    const swapRng = seeded(`skeeter-gauntlet-mild-v1:${monday}`);
    for (let d = 0; d < 7; d++) limitMild(plan, d, monday, games, swapRng);
    plans.set(monday, plan);
  }
  return plans.get(monday);
}

// The six game ids for a gauntlet day, in play order.
export function lineupFor(day) {
  // Days before the weekly plan, and the replayable test days in 2099.
  if (day < LINEUP_RULES_FROM || day.startsWith('2099-')) return dailyDraw(day);
  const monday = weekStart(day);
  const { words, others } = weekPlan(monday)[Math.round((Date.parse(day) - Date.parse(monday)) / DAY_MS)];
  // Play order: shuffled for the day, so word games aren't always first.
  return shuffler(seeded(`skeeter-gauntlet-order-v4:${day}`))([...words, ...others]);
}
