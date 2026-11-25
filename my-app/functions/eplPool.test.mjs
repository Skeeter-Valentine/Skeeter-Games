import assert from 'node:assert/strict';
import test from 'node:test';
import { checkPicks, fixtureFromApi, isLocked, MAX_PER_TEAM, newInviteCode, shortfall, teamCounts } from './eplPool.js';

// A small league: 6 teams, 3 matches a week, `weeks` weeks, one day apart.
const TEAMS = ['ARS', 'CHE', 'LIV', 'MCI', 'MUN', 'TOT'].map((tla, i) => ({ id: i + 1, name: tla, tla, crest: '' }));
function league(weeks, start = Date.parse('2026-08-15T14:00:00Z')) {
  const fixtures = [];
  for (let w = 1; w <= weeks; w++) {
    const order = [...TEAMS.slice(w % 6), ...TEAMS.slice(0, w % 6)];
    for (let m = 0; m < 3; m++) {
      fixtures.push({ id: w * 10 + m, matchday: w, utcDate: new Date(start + (w - 1) * 7 * 86400000 + m * 3600000).toISOString(),
        status: 'TIMED', home: order[m * 2], away: order[m * 2 + 1], score: { home: null, away: null } });
    }
  }
  return fixtures;
}
const pick = (fixture, side = 'home') => ({ team: fixture[side].id, match: fixture.id });

test('fixtures come from football-data.org matches', () => {
  const fixture = fixtureFromApi({ id: 5, matchday: 13, utcDate: '2026-11-28T15:00:00Z', status: 'TIMED',
    homeTeam: { id: 57, name: 'Arsenal FC', shortName: 'Arsenal', tla: 'ARS', crest: 'a.png' }, awayTeam: { id: 61, name: 'Chelsea FC', tla: 'CHE' },
    score: { fullTime: { home: null, away: null } } });
  assert.equal(fixture.home.name, 'Arsenal');
  assert.equal(fixture.away.name, 'Chelsea FC');
  assert.equal(fixture.matchday, 13);
});

test('three picks a week, each from a different match, locked at kickoff', () => {
  const fixtures = league(38);
  const week1 = fixtures.filter(f => f.matchday === 1);
  const before = Date.parse('2026-08-15T12:00:00Z');
  const saved = checkPicks({ fixtures, matchday: 1, picks: [pick(week1[0]), pick(week1[1]), pick(week1[2], 'away')], now: before });
  assert.equal(saved.length, 3);
  assert.throws(() => checkPicks({ fixtures, matchday: 1, picks: [pick(week1[0]), pick(week1[0], 'away')], now: before }), /different match/);
  assert.throws(() => checkPicks({ fixtures, matchday: 1, picks: [pick(week1[0]), pick(week1[1]), pick(week1[2]), pick(week1[2])], now: before }), /at most 3/);
  assert.throws(() => checkPicks({ fixtures, matchday: 1, picks: [pick(fixtures[5])], now: before }), /not a team playing/);
  // After the first match kicks off (14:00), it can't be added or changed...
  const during = Date.parse('2026-08-15T14:30:00Z');
  assert.throws(() => checkPicks({ fixtures, matchday: 1, picks: [pick(week1[0])], now: during }), /already kicked off/);
  const weeks = { 1: [pick(week1[0]), pick(week1[1])] };
  assert.throws(() => checkPicks({ fixtures, weeks, matchday: 1, picks: [pick(week1[1])], now: during }), /can't change/);
  // ...but later matches can.
  assert.equal(checkPicks({ fixtures, weeks, matchday: 1, picks: [pick(week1[0]), pick(week1[1], 'away'), pick(week1[2])], now: during }).length, 3);
  // An admin fixing picks isn't held to the locks.
  assert.equal(checkPicks({ fixtures, weeks, matchday: 1, picks: [pick(week1[2])], now: during, admin: true }).length, 1);
});

test(`no team more than ${MAX_PER_TEAM} times a season`, () => {
  const fixtures = league(38);
  const weeks = {};
  for (let w = 1; w <= MAX_PER_TEAM; w++) {
    const arsenal = fixtures.find(f => f.matchday === w && (f.home.id === 1 || f.away.id === 1));
    weeks[w] = [{ team: 1, match: arsenal.id }];
  }
  assert.equal(teamCounts(weeks).get(1), MAX_PER_TEAM);
  const next = fixtures.find(f => f.matchday === 8 && (f.home.id === 1 || f.away.id === 1));
  assert.throws(() => checkPicks({ fixtures, weeks, matchday: 8, picks: [{ team: 1, match: next.id }], now: 0 }), /already picked ARS 7 times/);
});

test('picks may not make picking every team 4 times impossible', () => {
  // Two weeks left = 6 slots, 6 teams x 4 = 24 needed: hopeless from the start,
  // so ordinary picks aren't blocked (they don't make it worse).
  const short = league(2);
  assert.ok(shortfall(short, {}, 0) > 0);
  assert.equal(checkPicks({ fixtures: short, matchday: 1, picks: [pick(short[0])], now: 0 }).length, 1);
  // A season with exactly enough room: 8 weeks x 3 = 24 slots for 24 needed
  // picks. Picking a team a 5th time would leave one slot short.
  const exact = league(8);
  assert.equal(shortfall(exact, {}, 0), 0);
  const weeks = {};
  for (let w = 1; w <= 4; w++) {
    const games = exact.filter(f => f.matchday === w && (f.home.id === 1 || f.away.id === 1));
    weeks[w] = [{ team: 1, match: games[0].id }];
  }
  const fifth = exact.find(f => f.matchday === 5 && (f.home.id === 1 || f.away.id === 1));
  assert.throws(() => checkPicks({ fixtures: exact, weeks, matchday: 5, picks: [{ team: 1, match: fifth.id }], now: 0 }), /every team at least 4 times/);
});

test('locks and invite codes', () => {
  const fixture = { utcDate: '2026-08-15T14:00:00Z', status: 'TIMED' };
  assert.equal(isLocked(fixture, Date.parse('2026-08-15T13:59:00Z')), false);
  assert.equal(isLocked(fixture, Date.parse('2026-08-15T14:00:00Z')), true);
  assert.equal(isLocked({ ...fixture, status: 'IN_PLAY' }, 0), true);
  assert.match(newInviteCode(), /^[A-Z2-9]{10}$/);
});

test('spreadsheet team names find their matches', async () => {
  const { resolveImport, teamKey } = await import('./eplPool.js');
  assert.equal(teamKey('Brighton & Hove Albion FC'), teamKey('Brighton & Hove Albion'));
  assert.equal(teamKey('AFC Bournemouth'), teamKey('Bournemouth'));
  assert.equal(teamKey('Tottenham Hotspur FC'), teamKey('Tottenham Hotspur'));
  const fixtures = [
    { id: 1, matchday: 1, home: { id: 57, name: 'Arsenal', fullName: 'Arsenal FC' }, away: { id: 397, name: 'Brighton Hove', fullName: 'Brighton & Hove Albion FC' } },
    { id: 2, matchday: 1, home: { id: 73, name: 'Tottenham', fullName: 'Tottenham Hotspur FC' }, away: { id: 1044, name: 'Bournemouth', fullName: 'AFC Bournemouth' } },
  ];
  const { weeks, problems } = resolveImport(fixtures, { 1: ['Brighton & Hove Albion', 'Tottenham Hotspur', 'Chelsea'] });
  assert.deepEqual(weeks[1], [{ team: 397, match: 1 }, { team: 73, match: 2 }]);
  assert.deepEqual(problems, ['Game week 1: no match found for "Chelsea"']);
  assert.match(resolveImport(fixtures, { 1: ['Arsenal', 'Brighton & Hove Albion'] }).problems[0], /already picked/);
});

test('the board scores picks and runs Survivor like the spreadsheet', async () => {
  const { buildBoard } = await import('./eplPool.js');
  // Six weeks, all played. Home teams always win except where noted.
  const fixtures = league(6).map(f => ({ ...f, status: 'FINISHED', score: { home: 1, away: 0 } }));
  const games = day => fixtures.filter(f => f.matchday === day);
  const tie = id => { const f = fixtures.find(x => x.id === id); f.score = { home: 1, away: 1 }; };
  const weeks = {};
  // Week 1: 3 wins = 9. Week 2: W, T, L = 4 (first 4-point week). Week 3: 4 again (second).
  // Week 4: 4 with none left = strike. Week 5: 2 losses + win = 3, strike. Week 6: L L L = strike 3, out.
  weeks[1] = games(1).map(f => pick(f, 'home'));
  tie(games(2)[1].id); weeks[2] = [pick(games(2)[0]), pick(games(2)[1]), pick(games(2)[2], 'away')];
  tie(games(3)[1].id); weeks[3] = [pick(games(3)[0]), pick(games(3)[1]), pick(games(3)[2], 'away')];
  tie(games(4)[1].id); weeks[4] = [pick(games(4)[0]), pick(games(4)[1]), pick(games(4)[2], 'away')];
  weeks[5] = [pick(games(5)[0]), pick(games(5)[1], 'away'), pick(games(5)[2], 'away')];
  weeks[6] = games(6).map(f => pick(f, 'away'));
  const board = buildBoard({ fixtures, players: [{ id: 'me', name: 'Me', weeks }], now: Date.parse('2027-01-01') });
  const me = board.players[0];
  assert.equal(me.total, 9 + 4 + 4 + 4 + 3 + 0);
  assert.deepEqual([me.wins, me.ties, me.losses], [3 + 1 + 1 + 1 + 1, 3, 8]);
  assert.deepEqual(me.survivor, { strikes: 3, fourLeft: 0, out: true, outAfter: 6 });
  assert.equal(me.weeks[2].usedFour, true);
  assert.equal(me.weeks[4].strike, true);
  assert.equal(board.lastDay, 6);
});

test('other players\' picks stay hidden until kickoff', async () => {
  const { buildBoard } = await import('./eplPool.js');
  const fixtures = league(2);
  const weeks = { 1: [pick(fixtures[0])] };
  const before = Date.parse('2026-08-15T12:00:00Z');
  const board = buildBoard({ fixtures, players: [{ id: 'a', name: 'A', weeks }, { id: 'b', name: 'B', weeks }], now: before, seeAll: ['a'] });
  assert.equal(board.players[0].weeks[1].picks[0].team, fixtures[0].home.id);
  assert.deepEqual(board.players[1].weeks[1].picks[0], { hidden: true });
});
