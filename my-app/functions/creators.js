import { gauntletGamePeppers } from './peppers.js';

// Creator accounts: the owner turns an existing player account into a creator
// account at /admin/creators, then invites it to play chosen gauntlets before
// they go live. The owner writes creators/{uid} directly (the Firestore rules
// allow only the owner); finding the account runs here (findPlayers), where
// nicknames and sign-in emails can be looked up.

// What the owner typed: a sign-in email, or the start of a nickname (matched
// the way nicknames are claimed: lower case, letters and digits only).
export function playerSearch(query) {
  const text = String(query ?? '').trim();
  if (text.includes('@')) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) ? { email: text.toLowerCase() } : null;
  const prefix = text.toLowerCase().replace(/[^a-z0-9]/g, '');
  return prefix.length >= 2 ? { prefix } : null;
}

// One search result, from the account's records.
export function playerSummary(uid, { nickname = null, email = null, name = null, creator = false } = {}) {
  return { uid, nickname: nickname || null, email: email || null, name: name || null, creator: !!creator };
}

// A creator invited to `day`: their record says all days, or lists it.
export const creatorInvited = (creator, day) => !!creator && (creator.allDays === true || (Array.isArray(creator.days) && creator.days.includes(day)));

// The featured creator of a custom gauntlet (customGauntlets/{day}.creator),
// if `uid` is them. Their finished run is published as gauntletGuest/{day},
// shown under the owner's time to beat.
export const featuredCreator = (custom, uid) => (custom?.creator?.uid && custom.creator.uid === uid ? custom.creator : null);
// `custom` (the day's customGauntlets record) gives the spice levels played,
// which the site checks before showing the time.
export function guestRecord(day, run, { uid, name }, custom = null) {
  const results = run.results.map(({ game, status, total }) => ({ game, status, total: Number(total) || 0 }));
  return { day, uid, name: String(name || 'Guest').slice(0, 60), total: results.reduce((sum, result) => sum + result.total, 0),
    solved: results.filter(result => result.status === 'won').length, games: [...run.lineup],
    levels: run.lineup.map(game => gauntletGamePeppers(day, game, custom)), results };
}

// The guest time for `day` from the featured creator's run, when they finished
// it before being featured (the owner publishes it with publishGuest).
// { guest } or { reason }: 'no-creator', 'not-finished' or 'different-games'.
export function guestFromRun(day, custom, run) {
  const creator = custom?.creator?.uid ? custom.creator : null;
  if (!creator) return { reason: 'no-creator' };
  if (!run?.finishedAt || !Array.isArray(run.results)) return { reason: 'not-finished' };
  if (!Array.isArray(run.lineup) || !Array.isArray(custom.games) || run.lineup.join() !== custom.games.join()) return { reason: 'different-games' };
  return { guest: guestRecord(day, run, creator, custom) };
}
