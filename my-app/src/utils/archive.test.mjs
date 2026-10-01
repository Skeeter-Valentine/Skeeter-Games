import assert from 'node:assert/strict';
import test from 'node:test';
import { validArchiveDate, puzzleSnapshot, archiveStatsId } from './archive.js';
import { recordDailyResult, readDailyStats } from './dailyStats.js';

test('archive dates exclude today, future dates, impossible dates, and prelaunch dates', () => {
  for (const date of ['2026-09-30', '2026-10-01', '2026-02-30', '2026-08-19', null, 'bad']) {
    assert.equal(validArchiveDate(date, '2026-09-30'), false);
  }
  assert.equal(validArchiveDate('2026-09-29', '2026-09-30'), true);
});
test('snapshots stay unchanged and archive results cannot alter daily results', () => {
  const snapshot = puzzleSnapshot('test-map', '2026-09-29', () => ({ cells: [1, 2] }));
  snapshot.cells[0] = 9;
  assert.deepEqual(puzzleSnapshot('test-map', '2026-09-29', () => ({ cells: [3] })), { cells: [1, 2] });
  recordDailyResult('test-map', '2026-09-29', false, 15);
  recordDailyResult(archiveStatsId('test-map', true), '2026-09-29', true, 10);
  assert.equal(readDailyStats('test-map').results['2026-09-29'].won, false);
  assert.equal(readDailyStats(archiveStatsId('test-map', true)).results['2026-09-29'].won, true);
});
