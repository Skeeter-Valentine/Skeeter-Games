// The EPL pool (skeetergames.org/eplpool): an invite-only Premier League pick
// pool. Each game week every player picks PICKS_PER_WEEK teams, each from a
// different match, and each pick locks when its match kicks off. Over the
// season a player must pick every team at least MIN_PER_TEAM times and at
// most MAX_PER_TEAM times.
//
// Firestore (written only by the functions; see firestore.rules):
//   eplSeasons/{season}  { fixtures: [fixture], syncedAt }   one doc, ~380 matches
//   eplMembers/{uid}     { name, email, admin, joinedAt }
//   eplPicks/{uid}       { weeks: { [matchday]: [{ team, match }] }, updatedAt }
//   eplInvites/{code}    { name, createdBy, createdAt, usedBy, usedAt }
//   eplPrivate/settings  { footballDataKey }                  never readable by clients
export const SEASON = 2026; // 2026/27, as football-data.org numbers seasons
export const PICKS_PER_WEEK = 3;
export const MIN_PER_TEAM = 4;
export const MAX_PER_TEAM = 7;

export class EplError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

// ----- Fixtures (from football-data.org's v4 API) -----
const team = side => ({ id: side?.id ?? null, name: side?.shortName || side?.name || 'TBD', fullName: side?.name || '', tla: side?.tla || '', crest: side?.crest || '' });
export function fixtureFromApi(match) {
  return {
    id: match.id, matchday: match.matchday, utcDate: match.utcDate, status: match.status,
    home: team(match.homeTeam), away: team(match.awayTeam),
    score: { home: match.score?.fullTime?.home ?? null, away: match.score?.fullTime?.away ?? null },
  };
}
export const FOOTBALL_DATA_URL = `https://api.football-data.org/v4/competitions/PL/matches?season=${SEASON}`;

// A match is locked once it kicks off (or has been played, or is underway).
const OPEN_STATUSES = ['SCHEDULED', 'TIMED', 'POSTPONED'];
export const isLocked = (fixture, now) => !OPEN_STATUSES.includes(fixture.status) || Date.parse(fixture.utcDate) <= now;

// ----- Picks -----
// How many times each team (by id) has been picked across `weeks`.
export function teamCounts(weeks) {
  const counts = new Map();
  for (const picks of Object.values(weeks ?? {})) for (const pick of picks) counts.set(pick.team, (counts.get(pick.team) ?? 0) + 1);
  return counts;
}

// How far short of MIN_PER_TEAM the player is bound to fall: the teams' missing
// picks that can't fit into the open slots still to come, at best. Worked out
// as a maximum matching of missing picks to the weeks where that team still
// has a match that hasn't started (and isn't already picked that week).
export function shortfall(fixtures, weeks, now) {
  const counts = teamCounts(weeks);
  const teams = new Map();
  for (const fixture of fixtures) for (const side of [fixture.home, fixture.away]) if (side.id) teams.set(side.id, side);
  const need = new Map([...teams.keys()].map(id => [id, Math.max(0, MIN_PER_TEAM - (counts.get(id) ?? 0))]).filter(([, n]) => n > 0));
  const totalNeed = [...need.values()].reduce((sum, n) => sum + n, 0);
  if (!totalNeed) return 0;
  // Open slots per week, and which needy teams could fill them.
  const byWeek = new Map();
  for (const fixture of fixtures) {
    if (isLocked(fixture, now)) continue;
    const week = byWeek.get(fixture.matchday) ?? { teams: new Set() };
    for (const side of [fixture.home, fixture.away]) if (need.has(side.id)) week.teams.add(side.id);
    byWeek.set(fixture.matchday, week);
  }
  const slots = [];
  for (const [matchday, week] of byWeek) {
    const picked = weeks?.[matchday] ?? [];
    const open = PICKS_PER_WEEK - picked.length;
    const teamsOpen = [...week.teams].filter(id => !picked.some(pick => pick.team === id));
    for (let i = 0; i < open; i++) slots.push(teamsOpen);
  }
  // Each needy team as `need` units; match units to slots (augmenting paths).
  const units = [...need].flatMap(([id, n]) => Array(n).fill(id));
  const slotOwner = new Array(slots.length).fill(-1);
  const tryUnit = (unit, seen) => {
    for (let s = 0; s < slots.length; s++) {
      if (seen[s] || !slots[s].includes(units[unit])) continue;
      seen[s] = true;
      if (slotOwner[s] === -1 || tryUnit(slotOwner[s], seen)) { slotOwner[s] = unit; return true; }
    }
    return false;
  };
  let matched = 0;
  for (let unit = 0; unit < units.length; unit++) if (tryUnit(unit, new Array(slots.length).fill(false))) matched++;
  return totalNeed - matched;
}

// Checks a player's new picks for one week and returns them cleaned. `weeks`
// is everything they have saved. Throws EplError with a message for the player.
// `admin` (fixing picks) skips the kickoff locks and the season limits.
export function checkPicks({ fixtures, weeks = {}, matchday, picks, now, admin = false }) {
  if (!Number.isInteger(matchday) || !Array.isArray(picks)) throw new EplError('invalid-argument', 'Those picks could not be read.');
  const week = fixtures.filter(fixture => fixture.matchday === matchday);
  if (!week.length) throw new EplError('invalid-argument', `There's no game week ${matchday}.`);
  if (picks.length > PICKS_PER_WEEK) throw new EplError('invalid-argument', `Pick at most ${PICKS_PER_WEEK} teams a week.`);
  const name = id => week.flatMap(f => [f.home, f.away]).find(side => side.id === id)?.name ?? 'That team';
  const cleaned = picks.map(pick => {
    const fixture = week.find(f => f.id === pick?.match);
    if (!fixture || ![fixture.home.id, fixture.away.id].includes(pick.team)) throw new EplError('invalid-argument', 'One of those picks is not a team playing this week.');
    return { team: pick.team, match: fixture.id };
  });
  if (new Set(cleaned.map(pick => pick.match)).size !== cleaned.length) throw new EplError('invalid-argument', 'Pick each team from a different match.');
  const before = weeks[matchday] ?? [];
  if (!admin) {
    const locked = id => isLocked(week.find(f => f.id === id), now);
    const same = (a, b) => a.team === b.team && a.match === b.match;
    for (const old of before) {
      if (locked(old.match) && !cleaned.some(pick => same(pick, old))) throw new EplError('failed-precondition', `${name(old.team)}'s match has kicked off, so that pick can't change.`);
    }
    for (const pick of cleaned) {
      if (locked(pick.match) && !before.some(old => same(pick, old))) throw new EplError('failed-precondition', `${name(pick.team)}'s match has already kicked off.`);
    }
    const after = { ...weeks, [matchday]: cleaned };
    const counts = teamCounts(after);
    for (const pick of cleaned) {
      if (counts.get(pick.team) > MAX_PER_TEAM) throw new EplError('failed-precondition', `You've already picked ${name(pick.team)} ${MAX_PER_TEAM} times this season.`);
    }
    // Never leave fewer chances to pick every team MIN_PER_TEAM times than before.
    const gap = shortfall(fixtures, after, now);
    if (gap > 0 && gap > shortfall(fixtures, weeks, now)) {
      throw new EplError('failed-precondition', `Those picks would leave no way to pick every team at least ${MIN_PER_TEAM} times this season. Try other teams.`);
    }
  }
  return cleaned;
}

// ----- Importing picks made before the site (the pool's spreadsheet) -----
// A name as the spreadsheet or football-data.org writes it, reduced to compare:
// "Brighton & Hove Albion FC", "Brighton & Hove" and "Brighton Hove" all match.
export const teamKey = name => String(name ?? '').toLowerCase()
  .replace(/\b(a?fc|albion|hotspur|wanderers)\b/g, '').replace(/&|\band\b/g, '').replace(/[^a-z]/g, '');
// { weeks, problems }: each week's team names as picks ({ team, match }).
export function resolveImport(fixtures, named) {
  const weeks = {}, problems = [];
  for (const [matchday, names] of Object.entries(named ?? {})) {
    const week = fixtures.filter(fixture => fixture.matchday === Number(matchday));
    const picks = [];
    for (const name of names) {
      const key = teamKey(name);
      const fixture = week.find(f => [f.home, f.away].some(side => [side.fullName, side.name].some(n => n && teamKey(n) === key)));
      if (!fixture) { problems.push(`Game week ${matchday}: no match found for "${name}"`); continue; }
      const side = [fixture.home, fixture.away].find(s => [s.fullName, s.name].some(n => n && teamKey(n) === key));
      if (picks.some(pick => pick.match === fixture.id)) problems.push(`Game week ${matchday}: ${name} plays a team already picked that week`);
      picks.push({ team: side.id, match: fixture.id });
    }
    weeks[matchday] = picks;
  }
  return { weeks, problems };
}

// ----- Invites -----
const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function newInviteCode(random = Math.random) {
  return Array.from({ length: 10 }, () => CODE_LETTERS[Math.floor(random() * CODE_LETTERS.length)]).join('');
}
export const cleanName = name => String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
