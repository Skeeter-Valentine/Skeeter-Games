import { getEdges } from './puzzle.js';

// Keep the existing live key so current daily progress is preserved.
export const storageKey = (date, archive = false) => `${archive ? 'archive:v1:' : ''}stitches-daily-v2-${date}`;

export function restoreProgress(puzzle, saved) {
  const empty = { selected: [], marks: [], seconds: 0, started: false };
  const validIds = new Set(getEdges(puzzle.regions).map(edge => edge.id));
  if (!saved || saved.fingerprint !== JSON.stringify(puzzle)
    || !Array.isArray(saved.selected) || !saved.selected.every(id => validIds.has(id))
    || !Array.isArray(saved.marks) || !saved.marks.every(cell => Number.isInteger(cell) && cell >= 0 && cell < puzzle.regions.length ** 2)) return empty;
  const seconds = Number.isInteger(saved.seconds) && saved.seconds >= 0 ? saved.seconds : 0;
  return { selected: [...new Set(saved.selected)], marks: [...new Set(saved.marks)], seconds,
    started: !!saved.started || seconds > 0 || saved.selected.length > 0 || saved.marks.length > 0 };
}
