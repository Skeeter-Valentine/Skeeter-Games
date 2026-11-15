import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanAccess, isInviteCode, mergeAccess, redeemInvite } from './creators.js';

test('invite codes are long letters and digits only', () => {
  assert.ok(isInviteCode('a1B2c3D4e5F6g7H8'));
  assert.ok(!isInviteCode('short1'));
  assert.ok(!isInviteCode('has/slash-and-more-text'));
  assert.ok(!isInviteCode(42));
});

test('access keeps real days only, sorted, without repeats', () => {
  assert.deepEqual(cleanAccess({ days: ['2026-12-02', 'nope', '2026-12-01', '2026-12-02'], allDays: 'yes' }),
    { allDays: false, days: ['2026-12-01', '2026-12-02'] });
  assert.deepEqual(mergeAccess({ days: ['2026-12-01'] }, { days: ['2026-12-03'], allDays: true }),
    { allDays: true, days: ['2026-12-01', '2026-12-03'] });
});

test('redeeming an invite makes a creator once', () => {
  const invite = { name: 'Sam (YouTube)', days: ['2026-12-01'], allDays: false };
  const done = redeemInvite({ invite, creator: null, uid: 'u1', email: 'sam@example.com', now: 5 });
  assert.deepEqual(done.creator, { allDays: false, days: ['2026-12-01'], name: 'Sam (YouTube)', email: 'sam@example.com', joinedAt: 5, updatedAt: 5 });
  assert.deepEqual(done.inviteUpdate, { usedBy: 'u1', usedAt: 5, usedEmail: 'sam@example.com' });
  const used = { ...invite, usedBy: 'u1' };
  assert.equal(redeemInvite({ invite: used, creator: done.creator, uid: 'u1', now: 6 }), null, 'opening the link again does nothing');
  assert.throws(() => redeemInvite({ invite: used, creator: null, uid: 'u2', now: 6 }), /already been used/);
  assert.throws(() => redeemInvite({ invite: null, creator: null, uid: 'u2', now: 6 }), /isn't valid/);
});

test('a second invite adds to an existing creator', () => {
  const creator = { name: 'Sam', email: 'sam@example.com', days: ['2026-12-01'], allDays: false, joinedAt: 1 };
  const done = redeemInvite({ invite: { name: 'Other label', days: ['2026-12-05'] }, creator, uid: 'u1', now: 9 });
  assert.equal(done.creator.name, 'Sam');
  assert.deepEqual(done.creator.days, ['2026-12-01', '2026-12-05']);
  assert.equal(done.creator.joinedAt, 1);
});
