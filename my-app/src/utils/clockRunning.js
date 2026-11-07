// Whether a puzzle's clock should be ticking. Daily (and archive) puzzles
// time from the moment the puzzle is on screen, so working it out before the
// first move counts too; practice puzzles still start on the first move.
// Either way the clock pauses once solved, while learning to play, while the
// first-visit "Learn to play?" offer is open, and while the tab is hidden.
export function clockRunning({ daily, moved, done, learning = false, promptOpen = false, visible = true }) {
  return visible && !done && !learning && (moved || (daily && !promptOpen));
}
