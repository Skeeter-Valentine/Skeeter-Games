// Creator accounts: invite-only accounts for people the owner films content
// with. A creator can open chosen gauntlets before they go live (or every
// upcoming one) and use the playing-area preview for filming.
//
// The owner makes an invite at /admin/creators (creatorInvites/{code});
// the creator opens /creator?invite={code}, signs in, and redeemInvite turns
// the invite into creators/{uid}. An invite works once.
export class CreatorError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

export const isInviteCode = code => typeof code === 'string' && /^[A-Za-z0-9]{16,40}$/.test(code);
const isDay = day => typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day);
export const MAX_DAYS = 120;

// The access an invite (or a creator record) grants, cleaned up.
export function cleanAccess(data) {
  const days = Array.isArray(data?.days) ? [...new Set(data.days.filter(isDay))].sort().slice(-MAX_DAYS) : [];
  return { allDays: data?.allDays === true, days };
}

// A creator invited twice keeps everything both invites give.
export function mergeAccess(existing, invite) {
  const a = cleanAccess(existing), b = cleanAccess(invite);
  return { allDays: a.allDays || b.allDays, days: cleanAccess({ days: [...a.days, ...b.days] }).days };
}

// What redeeming `invite` does for `uid`. Throws a CreatorError when it can't
// be used. Returns null when this account already redeemed it (nothing to do).
export function redeemInvite({ invite, creator, uid, email = null, name = null, now }) {
  if (!invite) throw new CreatorError('not-found', 'This invite link isn\'t valid. Ask for a new one.');
  if (invite.usedBy && invite.usedBy !== uid) throw new CreatorError('already-exists', 'This invite has already been used. Ask for a new one.');
  if (invite.usedBy === uid && creator) return null;
  const label = typeof invite.name === 'string' && invite.name.trim() ? invite.name.trim().slice(0, 60) : (name || email || 'Creator');
  return {
    creator: {
      ...mergeAccess(creator, invite),
      name: creator?.name || label,
      email: email || creator?.email || null,
      joinedAt: creator?.joinedAt ?? now,
      updatedAt: now,
    },
    inviteUpdate: { usedBy: uid, usedAt: now, usedEmail: email },
  };
}
