import { useLayoutEffect, useRef } from 'react';

// Use the full playing area for games with multiple boards or outside clues.
export const boardSelectors = {
  parshle: '.parshle-board',
  '2048': '.game2048-board',
  hashi: '.hashi-canvas',
  minesweeper: '.ms-classic-board',
  word500: '.word500-board',
  skeedlemath: '.word500-board',
  quordle: '.quordle-grid',
  'skeedle-marathon': '.marathon-boards',
  nonograms: '.grid-layout',
  shikaku: '.shikaku-grid',
  sudoku: '.sudoku-board',
  pipes: '.pipes-canvas',
  stitches: '.stitches-board',
  map: '.skeedomap-canvas svg',
  'skeedle-beadle': '.beadle-panel',
};

export default function useBoardAlignment(gameId) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const bar = ref.current;
    const selector = boardSelectors[gameId];
    if (!bar || !selector) return;
    let frame, board, shift = 0;
    const resize = new ResizeObserver(() => schedule());
    const layout = new MutationObserver(() => schedule());
    function align() {
      // Find the nearest common container, keeping embedded games independent.
      let scope = bar.parentElement;
      while (scope && !scope.querySelector(selector)) scope = scope.parentElement;
      const next = scope?.querySelector(selector);
      if (!next) return;
      if (next !== board) {
        board = next;
        resize.disconnect();
        layout.disconnect();
        resize.observe(board);
        for (let ancestor = board.parentElement; ancestor; ancestor = ancestor.parentElement) {
          resize.observe(ancestor);
          layout.observe(ancestor, { attributes: true, attributeFilter: ['style', 'class'] });
        }
        layout.observe(board, { attributes: true, attributeFilter: ['style', 'class'] });
      }
      const bounds = board.getBoundingClientRect();
      if (!bounds.width) return;
      // A narrow board (e.g. Parshle on a phone) may not fit the timer and tool
      // buttons on one line. Then the bar grows leftward, up to the screen
      // width, while staying aligned with the board's right edge.
      const gap = parseFloat(getComputedStyle(bar).columnGap) || 0;
      const items = [...bar.children];
      const needed = Math.ceil(items.reduce((sum, item) => sum + item.getBoundingClientRect().width, 0)
        + gap * Math.max(0, items.length - 1));
      const room = document.documentElement.clientWidth - 20;
      const barWidth = Math.max(bounds.width, Math.min(needed, room));
      const width = `${barWidth}px`;
      if (bar.style.width !== width) bar.style.width = width;
      const current = bar.getBoundingClientRect();
      const targetLeft = barWidth > bounds.width ? Math.max(10, bounds.right - barWidth) : bounds.left;
      const nextShift = shift + targetLeft - current.left;
      if (Math.abs(nextShift - shift) > 0.25) {
        shift = nextShift;
        bar.style.translate = `${shift}px 0`;
      }
    }
    function schedule() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(align);
    }
    // Boards can mount after a saved puzzle or a new mode has loaded.
    const children = new MutationObserver(schedule);
    children.observe(bar.parentElement, { childList: true, subtree: true });
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    align();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect(); layout.disconnect(); children.disconnect();
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
    };
  }, [gameId]);
  return ref;
}
