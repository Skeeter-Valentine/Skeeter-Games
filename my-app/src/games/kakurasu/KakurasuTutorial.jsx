import { useEffect, useRef } from 'react';
import { WalkthroughPanel, useWalkthrough } from '../../components/Walkthrough';
import { evaluateBoard } from './puzzle.js';
import { TUTORIAL_PUZZLE, TUTORIAL_STEPS } from './walkthrough.js';

// Add ’em Up "Learn to play": a 4 x 4 board (see walkthrough.js).
export const KAKURASU_TUTORIAL_KEY = 'kakurasu:tutorial-seen';
const SIZE = TUTORIAL_PUZZLE.size;
const STEPS = TUTORIAL_STEPS.map(step => ({ ...step,
  action: step.shade.length ? 'shade' : 'mark',
  targets: step.shade.length ? step.shade : step.clear,
  wrong: step.shade.length ? 'Not that square. Shade the glowing ones.' : 'Not that square. Cross off the glowing ones.' }));
const lineCells = (kind, index) => Array.from({ length: SIZE }, (_, i) => kind === 'row' ? index * SIZE + i : i * SIZE + index);

export default function KakurasuTutorial({ onDone }) {
  const walk = useWalkthrough(STEPS, KAKURASU_TUTORIAL_KEY);
  const shaded = new Set(), crossed = new Set();
  walk.applied.forEach(entry => (entry.step.action === 'shade' ? shaded : crossed).add(entry.id));
  // Finished steps also cross off the squares they proved empty.
  STEPS.slice(0, walk.phase === 'done' ? STEPS.length : walk.index).forEach(step => step.clear.forEach(id => crossed.add(id)));
  const status = evaluateBoard(TUTORIAL_PUZZLE, [...shaded]);
  const targets = new Set(walk.remaining);
  const step = walk.step;
  const line = new Set(step ? lineCells(step.kind, step.index) : []);
  const focusClue = step ? `${step.kind}${step.index}` : '';
  // Dragging across squares taps each one, like shading a line in the game.
  const dragging = useRef(false);
  useEffect(() => {
    const stop = () => { dragging.current = false; };
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    return () => { window.removeEventListener('pointerup', stop); window.removeEventListener('pointercancel', stop); };
  }, []);
  const clue = (kind, index, value, state) => <span key={`${kind}${index}`}
    className={`kk-clue${state ? ` ${state}` : ''}${focusClue === `${kind}${index}` ? ' wt-kk-clue' : ''}`}>{value}</span>;

  return <WalkthroughPanel walk={walk} steps={STEPS} label="Learn to play Add ’em Up" onExit={() => onDone(null)}
    intro={<>
      <h2>How Add ’em Up works</h2>
      <ul>
        <li><strong>Shade</strong> squares so every row and column adds up to the <strong>clue</strong> at its end.</li>
        <li>In a row, a shaded square is worth its <strong>column number</strong>. In a column, it's worth its <strong>row number</strong>.</li>
        <li>The small numbers along the top and left show what each position is worth.</li>
      </ul>
      <p>Let's solve a 4 x 4 board together.</p>
    </>}
    done={<>
      <h2>It all adds up!</h2>
      <ol>
        <li>Look for clues with <strong>only one way</strong> to make them: the full line, a 1 or a 2.</li>
        <li>Subtract what a line <strong>already has</strong>, and find what's left among its open squares.</li>
        <li><strong>Cross off</strong> squares you know stay empty. They narrow down the lines that cross them.</li>
      </ol>
      <p>In the game, tap or drag to shade. Mark × (or right-click) crosses squares off.</p>
    </>}
    doneActions={[{ label: 'Try a 4 x 4 practice puzzle', primary: true, onClick: () => onDone('practice') }, { label: 'Today\'s puzzle', onClick: () => onDone('daily') }]}
    board={<div className="kk-board wt-kk" style={{ '--size': SIZE }} aria-label="Walkthrough board">
      <span className="kk-corner" />
      {Array.from({ length: SIZE }, (_, c) => <span key={`h${c}`} className="kk-index">{c + 1}</span>)}
      <span className="kk-corner" />
      {Array.from({ length: SIZE }, (_, r) => <div key={r} style={{ display: 'contents' }}>
        <span className="kk-index">{r + 1}</span>
        {Array.from({ length: SIZE }, (_, c) => {
          const id = r * SIZE + c, on = shaded.has(id), cross = crossed.has(id);
          return <button key={id} type="button" disabled={walk.phase !== 'play'}
            className={`kk-cell${on ? ' shaded' : ''}${line.has(id) && !on && !cross ? ' wt-kk-line' : ''}${targets.has(id) ? ' wt-target' : ''}`}
            aria-label={`Row ${r + 1}, column ${c + 1}, ${on ? 'shaded' : cross ? 'crossed off' : 'empty'}${targets.has(id) ? ', next move' : ''}`}
            onPointerDown={event => { event.currentTarget.releasePointerCapture?.(event.pointerId); dragging.current = true; walk.tap(id); }}
            onPointerEnter={() => { if (dragging.current && targets.has(id)) walk.tap(id); }}
            onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); walk.tap(id); } }}>
            {cross ? <span aria-hidden="true">×</span> : null}
          </button>;
        })}
        {clue('row', r, TUTORIAL_PUZZLE.rows[r], status.rows[r])}
      </div>)}
      <span className="kk-corner" />
      {Array.from({ length: SIZE }, (_, c) => clue('col', c, TUTORIAL_PUZZLE.cols[c], status.cols[c]))}
      <span className="kk-corner" />
    </div>}
  />;
}
