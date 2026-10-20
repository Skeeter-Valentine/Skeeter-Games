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
// Games may play on consecutive days, so weeks don't fall into a pattern.
// Earlier days keep the original per-day draw (and its original 13 games),
// so past gauntlets, and any times recorded for them, never change.

// The games before Pepper Placer joined: the original draw uses these.
const ORIGINAL_GAME_IDS = ['akari', 'skeedle-beadle', 'map', 'parshle', 'stitches', 'nonograms', 'skeedlemath',
  'pipes', 'shikaku', 'quordle', 'word500', 'minesweeper', 'hashi'];
export const GAUNTLET_GAME_IDS = [...ORIGINAL_GAME_IDS, 'pepper-placer'];
export const WORD_GAMES = ['skeedlemath', 'quordle', 'parshle', 'word500'];
export const OTHER_GAMES = GAUNTLET_GAME_IDS.filter(id => !WORD_GAMES.includes(id));
export const GAUNTLET_SIZE = 6;
export const WORDS_PER_DAY = 2;
// A Monday. Change only to a later Monday, and only for days nobody has seen.
export const LINEUP_RULES_FROM = '2026-10-26';

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
function planOthers(rng) {
  const shuffle = shuffler(rng);
  const perDay = GAUNTLET_SIZE - WORDS_PER_DAY;
  const slots = perDay * 7, base = Math.floor(slots / OTHER_GAMES.length), extra = slots % OTHER_GAMES.length;
  for (;;) {
    const left = Object.fromEntries(shuffle(OTHER_GAMES).map((id, i) => [id, base + (i < extra ? 1 : 0)]));
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

// A week's plan: seven days of { words, others }, worked out once per week.
const plans = new Map();
export function weekPlan(monday) {
  if (!plans.has(monday)) {
    const rng = seeded(`skeeter-gauntlet-week-v4:${monday}`);
    const words = planWords(rng);
    const others = planOthers(rng);
    plans.set(monday, words.map((pair, d) => ({ words: pair, others: others[d] })));
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
