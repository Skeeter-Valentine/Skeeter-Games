import { useEffect, useRef } from 'react';
import { WalkthroughPanel, useWalkthrough } from '../../components/Walkthrough';
import { TUTORIAL_PICTURE, TUTORIAL_SIZE, TUTORIAL_STEPS, clues } from './walkthrough.js';

// Skeedograms "Learn to play": a 5 x 5 heart (see walkthrough.js).
export const NONOGRAM_TUTORIAL_KEY = 'nonograms:tutorial-seen';
const ROW_CLUES = clues(TUTORIAL_PICTURE);
const COL_CLUES = clues(TUTORIAL_PICTURE[0].map((_, c) => TUTORIAL_PICTURE.map(line => line[c])));

export default function NonogramTutorial({ onDone }) {
  const walk = useWalkthrough(TUTORIAL_STEPS.map(step => ({ ...step,
    wrong: step.action === 'cross' ? 'Not that square. Cross the glowing ones.' : 'Not that square. Fill the glowing ones.' })), NONOGRAM_TUTORIAL_KEY);
  const state = {};
  walk.applied.forEach(entry => { state[entry.id] = entry.step.action; });
  const targets = new Set(walk.remaining);
  const focus = new Set(walk.step?.focus ?? []);
  // Dragging across squares taps each one, like filling a line in the game.
  const dragging = useRef(false);
  useEffect(() => {
    const stop = () => { dragging.current = false; };
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    return () => { window.removeEventListener('pointerup', stop); window.removeEventListener('pointercancel', stop); };
  }, []);

  return <WalkthroughPanel walk={walk} steps={TUTORIAL_STEPS} label="Learn to play Skeedograms" onExit={() => onDone(null)}
    intro={<>
      <h2>How Skeedograms works</h2>
      <ul>
        <li>Fill squares to reveal a hidden <strong>picture</strong>.</li>
        <li>The numbers beside each row and above each column list its <strong>blocks</strong> of filled squares, in order.</li>
        <li>Blocks in the same line have at least one <strong>empty square</strong> between them.</li>
      </ul>
      <p>Let's uncover a small picture together.</p>
    </>}
    done={<>
      <h2>Picture complete!</h2>
      <ol>
        <li>A block as long as the line <strong>fills it</strong>.</li>
        <li>A long block <strong>overlaps</strong> the middle wherever it sits: fill the overlap.</li>
        <li>When a line has its blocks, <strong>cross</strong> the rest, and use the crosses to work out the next line.</li>
      </ol>
      <p>In the game, choose Fill or Cross and drag across squares. Right-click also places a cross.</p>
    </>}
    doneActions={[{ label: 'Try a 5 x 5 practice puzzle', primary: true, onClick: () => onDone('practice') }, { label: 'Today\'s puzzle', onClick: () => onDone('daily') }]}
    board={<div className="puzzle-container wt-nonogram" style={{ '--grid-cols': TUTORIAL_SIZE }}>
      <div className="grid-layout" style={{ '--grid-cols': TUTORIAL_SIZE }}>
        <div className="clue-cell corner" />
        {COL_CLUES.map((list, c) => <div key={`c${c}`} className={`clue-cell col-clue${focus.has(`c${c}`) ? ' wt-clue-focus' : ''}`}>
          {list.map((value, i) => <span key={i}>{value}</span>)}
        </div>)}
        {ROW_CLUES.map((list, r) => <div key={`r${r}`} style={{ display: 'contents' }}>
          <div className={`clue-cell row-clue${focus.has(`r${r}`) ? ' wt-clue-focus' : ''}`}>{list.join('  ')}</div>
          {Array.from({ length: TUTORIAL_SIZE }, (_, c) => {
            const id = r * TUTORIAL_SIZE + c, mark = state[id];
            return <button key={id} type="button" disabled={walk.phase !== 'play'}
              className={`game-cell${mark === 'fill' ? ' filled' : mark === 'cross' ? ' crossed' : ''}${targets.has(id) ? ' wt-target' : ''}`}
              aria-label={`Row ${r + 1}, column ${c + 1}, ${mark === 'fill' ? 'filled' : mark === 'cross' ? 'crossed' : 'empty'}${targets.has(id) ? ', next move' : ''}`}
              onPointerDown={event => { event.currentTarget.releasePointerCapture?.(event.pointerId); dragging.current = true; walk.tap(id); }}
              onPointerEnter={() => { if (dragging.current && targets.has(id)) walk.tap(id); }}
              onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); walk.tap(id); } }}>
              {mark === 'cross' ? '✕' : ''}
            </button>;
          })}
        </div>)}
      </div>
    </div>}
  />;
}
