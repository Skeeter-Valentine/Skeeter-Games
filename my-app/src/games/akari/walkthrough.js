import { neighbors, visibleCells } from './puzzle.js';

// Steps for the Skeeluminate "Learn to play" walkthrough: the simplest Light
// Up logic, one move at a time. Returns [{ action: 'bulb' | 'mark' | 'info',
// targets, focus, reason, wall? }] or null if these moves don't solve it.
//  zero      a 0 wall: its neighbors can't hold bulbs
//  wallFull  a wall with exactly as many open neighbors as bulbs it needs
//  wallDone  a wall that has its bulbs: its other neighbors are empty
//  onlyLight a square that can only be lit from one place
//  lighting  (info) what a bulb lights, after the first bulb
export function akariWalkthrough(puzzle) {
  const { size, cells } = puzzle;
  const bulbs = new Set(), marks = new Set(), lit = new Set();
  const whites = cells.flatMap((cell, id) => cell === null ? [id] : []);
  const open = id => cells[id] === null && !bulbs.has(id) && !marks.has(id) && !lit.has(id);
  const steps = [];
  let explainedLight = false;
  const place = (targets, step) => {
    targets.forEach(id => { bulbs.add(id); visibleCells(puzzle, id).forEach(cell => lit.add(cell)); });
    steps.push(step);
    if (!explainedLight) { explainedLight = true; steps.push({ action: 'info', targets: [], focus: [...lit], reason: 'lighting' }); }
  };
  for (let guard = 0; guard < size * size * 2 && whites.some(id => !lit.has(id)); guard++) {
    const walls = cells.flatMap((cell, id) => cell !== null && cell >= 0 ? [id] : []);
    const zero = walls.find(id => cells[id] === 0 && neighbors(size, id).some(open));
    if (zero !== undefined) {
      const targets = neighbors(size, zero).filter(open);
      targets.forEach(id => marks.add(id));
      steps.push({ action: 'mark', targets, focus: [zero], reason: 'zero', wall: 0 });
      continue;
    }
    let moved = false;
    for (const wall of walls) {
      const need = cells[wall] - neighbors(size, wall).filter(id => bulbs.has(id)).length;
      const candidates = neighbors(size, wall).filter(open);
      if (need > 0 && candidates.length === need) {
        place(candidates, { action: 'bulb', targets: candidates, focus: [wall], reason: 'wallFull', wall: cells[wall] });
        moved = true; break;
      }
      if (need === 0 && candidates.length) {
        candidates.forEach(id => marks.add(id));
        steps.push({ action: 'mark', targets: candidates, focus: [wall], reason: 'wallDone', wall: cells[wall] });
        moved = true; break;
      }
    }
    if (moved) continue;
    // An unlit square with only one place left that could light it. Marked
    // squares first: they make the clearest example.
    const unlit = whites.filter(id => !lit.has(id) && !bulbs.has(id)).sort((a, b) => marks.has(b) - marks.has(a));
    const forced = unlit.map(id => ({ id, lighters: visibleCells(puzzle, id).filter(open) })).find(entry => entry.lighters.length === 1);
    if (!forced) return null;
    place(forced.lighters, { action: 'bulb', targets: forced.lighters, focus: [forced.id], reason: 'onlyLight' });
  }
  return whites.every(id => lit.has(id)) ? steps : null;
}
