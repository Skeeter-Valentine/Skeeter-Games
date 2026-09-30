import test from 'node:test';
import assert from 'node:assert/strict';
import { dailyDate, watchDailyDate } from './dailyClock.js';

test('daily dates use UTC across local time zones, year boundaries, and leap days', () => {
  assert.equal(dailyDate(new Date('2026-09-29T18:00:00-06:00')), '2026-09-30');
  assert.equal(dailyDate(new Date('2026-09-30T08:59:59+09:00')), '2026-09-29');
  assert.equal(dailyDate(new Date('2026-12-31T17:00:00-07:00')), '2027-01-01');
  assert.equal(dailyDate(new Date('2028-02-28T17:00:00-07:00')), '2028-02-29');
});

test('clock updates at UTC midnight, catches up after sleep, and cleans up', () => {
  let now = new Date('2026-09-29T23:59:59.900Z');
  let pending;
  const dates = [];
  const windowTarget = new EventTarget();
  const documentTarget = new EventTarget();
  const stop = watchDailyDate(date => dates.push(date), {
    now: () => now,
    schedule: (callback, delay) => { pending = { callback, delay }; return pending; },
    cancel: () => { pending = null; },
    windowTarget, documentTarget,
  });
  assert.deepEqual(dates, ['2026-09-29']);
  assert.equal(pending.delay, 100);
  now = new Date('2026-09-30T00:00:00Z');
  pending.callback();
  assert.equal(dates.at(-1), '2026-09-30');
  assert.equal(pending.delay, 86400000);
  now = new Date('2026-10-03T12:00:00Z');
  documentTarget.dispatchEvent(new Event('visibilitychange'));
  assert.equal(dates.at(-1), '2026-10-03');
  assert.equal(pending.delay, 43200000);
  now = new Date('2026-10-04T01:00:00Z');
  windowTarget.dispatchEvent(new Event('focus'));
  assert.equal(dates.at(-1), '2026-10-04');
  stop();
  assert.equal(pending, null);
  const count = dates.length;
  windowTarget.dispatchEvent(new Event('focus'));
  documentTarget.dispatchEvent(new Event('visibilitychange'));
  assert.equal(dates.length, count);
});
