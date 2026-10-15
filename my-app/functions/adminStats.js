// Owner-only player and game statistics (the /admin/stats page). Pure
// functions over the stored records, so they can be tested without Firestore.
//
// players:  [{ uid, nickname }]                 (players/{uid})
// attempts: [{ uid, game, date, mode, status }]  (puzzleAttempts/*/players/{uid})
// runs:     [{ uid, day, finished }]            (gauntletRuns/{day}_{uid})
// rates:    [{ game, date, mode, starts, wins }] (puzzleRates/*, every player)
const DAY = 86400000;
const addDays = (date, days) => new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
// Weeks start on Monday.
export const weekOf = date => {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return addDays(date, -((day + 6) % 7));
};

export function buildStats({ players = [], attempts = [], runs = [], rates = [], today, weeks = 8, days = 30 }) {
  const nicknames = new Map(players.filter(player => player.nickname).map(player => [player.uid, player.nickname]));

  // ----- Each player's games -----
  const people = new Map();
  const person = uid => {
    if (!people.has(uid)) people.set(uid, { uid, nickname: nicknames.get(uid) ?? null, plays: 0, wins: 0, games: {}, lastPlayed: null, firstPlayed: null, gauntlets: 0, gauntletsFinished: 0 });
    return people.get(uid);
  };
  for (const attempt of attempts) {
    const entry = person(attempt.uid);
    entry.plays++;
    if (attempt.status === 'won') entry.wins++;
    const game = entry.games[attempt.game] ??= { plays: 0, wins: 0 };
    game.plays++;
    if (attempt.status === 'won') game.wins++;
    if (!entry.lastPlayed || attempt.date > entry.lastPlayed) entry.lastPlayed = attempt.date;
    if (!entry.firstPlayed || attempt.date < entry.firstPlayed) entry.firstPlayed = attempt.date;
  }
  for (const run of runs) {
    const entry = person(run.uid);
    entry.gauntlets++;
    if (run.finished) entry.gauntletsFinished++;
    if (!entry.lastPlayed || run.day > entry.lastPlayed) entry.lastPlayed = run.day;
  }
  for (const uid of nicknames.keys()) person(uid);
  const users = [...people.values()].map(entry => {
    const ranked = Object.entries(entry.games).sort((a, b) => b[1].plays - a[1].plays || b[1].wins - a[1].wins);
    return { ...entry, favorite: ranked[0]?.[0] ?? null, games: ranked.map(([game, counts]) => ({ game, ...counts })) };
  }).sort((a, b) => (!!b.nickname - !!a.nickname) || b.plays - a.plays || (b.lastPlayed ?? '').localeCompare(a.lastPlayed ?? ''));

  // ----- Game popularity and trends (every player, from puzzleRates) -----
  const weekStarts = Array.from({ length: weeks }, (_, i) => addDays(weekOf(today), -7 * (weeks - 1 - i)));
  const dayList = Array.from({ length: days }, (_, i) => addDays(today, i - days + 1));
  const games = new Map();
  const perDay = new Map(dayList.map(date => [date, 0]));
  for (const rate of rates) {
    const starts = rate.starts || 0;
    const game = games.get(rate.game) ?? { game: rate.game, plays: 0, wins: 0, weekly: new Array(weeks).fill(0), last7: 0, prev7: 0, daily: 0, archive: 0 };
    games.set(rate.game, game);
    game.plays += starts;
    game.wins += rate.wins || 0;
    game[rate.mode === 'archive' ? 'archive' : 'daily'] += starts;
    const index = weekStarts.indexOf(weekOf(rate.date));
    if (index >= 0) game.weekly[index] += starts;
    if (rate.date > addDays(today, -7) && rate.date <= today) game.last7 += starts;
    else if (rate.date > addDays(today, -14) && rate.date <= addDays(today, -7)) game.prev7 += starts;
    if (perDay.has(rate.date)) perDay.set(rate.date, perDay.get(rate.date) + starts);
  }
  const gameList = [...games.values()].map(game => ({
    ...game,
    winRate: game.plays ? game.wins / game.plays : null,
    change: game.prev7 ? (game.last7 - game.prev7) / game.prev7 : game.last7 ? null : 0,
  })).sort((a, b) => b.last7 - a.last7 || b.plays - a.plays);

  const active = (since) => users.filter(user => user.lastPlayed && user.lastPlayed > addDays(today, -since)).length;
  return {
    today,
    summary: {
      nicknamed: nicknames.size,
      recordedPlayers: users.filter(user => user.plays || user.gauntlets).length,
      activeNicknamed7: users.filter(user => user.nickname && user.lastPlayed && user.lastPlayed > addDays(today, -7)).length,
      active7: active(7),
      active30: active(30),
      plays: gameList.reduce((sum, game) => sum + game.plays, 0),
      plays7: gameList.reduce((sum, game) => sum + game.last7, 0),
      gauntlets: runs.length,
    },
    users,
    games: gameList,
    weekStarts,
    daily: dayList.map(date => ({ date, plays: perDay.get(date) })),
  };
}

// puzzleAttempts/{version}_{game}_{date}_{mode}: game ids may contain "_"? No
// (they use letters, digits and "-"), so the id splits cleanly.
export function parseAttemptId(id) {
  const match = /^(v\d+)_(.+)_(\d{4}-\d{2}-\d{2})_(daily|archive)$/.exec(id);
  return match ? { game: match[2], date: match[3], mode: match[4] } : null;
}
