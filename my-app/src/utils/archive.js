import { readLocal, writeLocal } from './dailyStats.js';

export const ARCHIVE_START = '2026-08-20';
export const ARCHIVE_VERSION = 'v1';
// Enable each game only after its puzzle snapshots and progress are isolated.
export const ARCHIVE_GAMES = ['map', 'akari'];
export function validArchiveDate(date, today) {
  return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
    && Number.isFinite(Date.parse(`${date}T00:00:00Z`))
    && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date
    && date >= ARCHIVE_START && date < today;
}
export const archiveStatsId = (game, archive) => archive ? `archive:${ARCHIVE_VERSION}:${game}` : game;
export const snapshotKey = (game, date) => `skeeter:puzzle:${ARCHIVE_VERSION}:${game}:${date}`;

// Preserve the generated puzzle independently of mutable player progress.
// Callers receive a fresh copy so moves cannot mutate the archived snapshot.
export function puzzleSnapshot(game, date, generate) {
  const key = snapshotKey(game, date);
  let saved = readLocal(key, null);
  if (!saved || saved.version !== ARCHIVE_VERSION || saved.date !== date || saved.game !== game) {
    saved = { version: ARCHIVE_VERSION, date, game, puzzle: generate() };
    writeLocal(key, saved);
  }
  return JSON.parse(JSON.stringify(saved.puzzle));
}

export function gameStorage(archive) {
  const keyFor = key => archive ? `skeeter:archive-progress:${ARCHIVE_VERSION}:${key}` : key;
  return {
    getItem(key) { return readLocal(`raw:${keyFor(key)}`, null) ?? (() => { try { return localStorage.getItem(keyFor(key)); } catch { return null; } })(); },
    setItem(key, value) { writeLocal(`raw:${keyFor(key)}`, String(value)); try { localStorage.setItem(keyFor(key), value); } catch { /* memory fallback */ } },
    removeItem(key) { writeLocal(`raw:${keyFor(key)}`, null); try { localStorage.removeItem(keyFor(key)); } catch { /* memory fallback */ } },
  };
}

export function resultSummary(counts) {
  const starts = counts?.starts || 0, wins = counts?.wins || 0, losses = counts?.losses || 0;
  return { starts, wins, losses, unfinished: Math.max(0, starts - wins - losses),
    winRate: starts ? Math.round(wins / starts * 100) : null };
}
