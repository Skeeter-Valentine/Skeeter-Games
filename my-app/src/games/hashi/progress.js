// Daily and archive Hashkeet progress, tied to the exact island layout.
export const hashiProgressKey = (date, archive) => `${archive ? 'archive:v1:' : ''}hashi_progress_v1_${date}`;
export const hashiSolvedKey = (date, archive) => `${archive ? 'archive:v1:' : ''}hashi_solved_v2_${date}`;

export const islandFingerprint = islands => islands.map(island => `${island.id}:${island.r},${island.c}=${island.req}`).join('|');

export function restoreHashi(islands, saved) {
  if (!saved || saved.fingerprint !== islandFingerprint(islands) || !Array.isArray(saved.bridges)) return null;
  const ids = new Set(islands.map(island => island.id));
  const bridges = saved.bridges.filter(b => b && ids.has(b.from) && ids.has(b.to) && b.from !== b.to
    && (b.count === 1 || b.count === 2)).map(({ from, to, count }) => ({ from, to, count }));
  const seconds = Number.isFinite(saved.seconds) && saved.seconds >= 0 ? Math.floor(saved.seconds) : 0;
  return { bridges, seconds, solved: !!saved.solved };
}
