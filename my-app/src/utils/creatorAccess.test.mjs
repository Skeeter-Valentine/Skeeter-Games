import assert from 'node:assert/strict';
import test from 'node:test';
import { accessSummary, canPreviewDay, previewDays, withDay } from './creatorAccess.js';

test('creators open only the gauntlets they were given', () => {
  const creator = { allDays: false, days: ['2026-12-01', '2026-12-03'] };
  assert.ok(canPreviewDay(creator, '2026-12-01'));
  assert.ok(!canPreviewDay(creator, '2026-12-02'));
  assert.ok(!canPreviewDay(null, '2026-12-01'));
  assert.ok(canPreviewDay({ allDays: true, days: [] }, '2027-05-05'));
  assert.deepEqual(previewDays(creator, ['2026-12-01', '2026-12-02', '2026-12-03']), ['2026-12-01', '2026-12-03']);
});

test('access reads in plain words, leaving out past days', () => {
  assert.equal(accessSummary({ allDays: true }), 'All upcoming gauntlets');
  assert.equal(accessSummary({ days: ['2026-11-01', '2026-12-01'] }, '2026-11-20'), '1 gauntlet: Dec 1');
  assert.equal(accessSummary({ days: [] }), 'No upcoming gauntlets');
});

test('inviting to a day adds it once; un-inviting removes it', () => {
  const creator = { days: ['2026-12-03'] };
  assert.deepEqual(withDay(creator, '2026-12-01', true), ['2026-12-01', '2026-12-03']);
  assert.deepEqual(withDay({ days: ['2026-12-01'] }, '2026-12-01', true), ['2026-12-01']);
  assert.deepEqual(withDay(creator, '2026-12-03', false), []);
});
