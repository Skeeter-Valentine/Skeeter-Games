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
