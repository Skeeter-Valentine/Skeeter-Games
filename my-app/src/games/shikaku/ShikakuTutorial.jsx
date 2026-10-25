import { useEffect, useMemo, useRef, useState } from 'react';
import { WalkthroughPanel, useWalkthrough } from '../../components/Walkthrough';
import { TUTORIAL_CLUES, TUTORIAL_WORDS, rectKey, shikakuWalkthrough } from './walkthrough.js';

// Skeekaku "Learn to play": a 5 x 5 board of six rectangles (see
// walkthrough.js). Drag a rectangle, or tap inside the glowing one.
export const SHIKAKU_TUTORIAL_KEY = 'shikaku:tutorial-seen';
const SIZE = TUTORIAL_CLUES.length;
const box = rect => ({ top: `${rect.r1 * 20}%`, left: `${rect.c1 * 20}%`,
  width: `${(rect.c2 - rect.c1 + 1) * 20}%`, height: `${(rect.r2 - rect.r1 + 1) * 20}%` });
const bounds = (a, b) => ({ r1: Math.min(a.r, b.r), r2: Math.max(a.r, b.r), c1: Math.min(a.c, b.c), c2: Math.max(a.c, b.c) });

export default function ShikakuTutorial({ onDone }) {
  const steps = useMemo(() => (shikakuWalkthrough(TUTORIAL_CLUES) ?? []).map((step, index) => ({
    ...step, ...TUTORIAL_WORDS[index], targets: [rectKey(step.rect)],
    wrong: 'Not quite. Cover the squares inside the pulsing red outline.',
  })), []);
  const walk = useWalkthrough(steps, SHIKAKU_TUTORIAL_KEY);
  const placed = walk.applied.map(entry => entry.step.rect);
  const target = walk.phase === 'play' && walk.remaining.length ? walk.step.rect : null;
  const [r0, c0] = walk.step?.clue ?? [];
  const [fr, fc] = walk.step?.cell ?? [];
  const [drag, setDrag] = useState(null); // { start, end }
  const dragRef = useRef(null);
  dragRef.current = drag;
  const walkRef = useRef(walk);
  walkRef.current = walk;

  useEffect(() => {
    const finish = () => {
      const current = dragRef.current, w = walkRef.current;
      if (!current) return;
      setDrag(null);
      const step = w.step;
      if (!step) return;
      const rect = bounds(current.start, current.end);
      const goal = step.rect;
      const tapInside = rect.r1 === rect.r2 && rect.c1 === rect.c2
        && rect.r1 >= goal.r1 && rect.r1 <= goal.r2 && rect.c1 >= goal.c1 && rect.c1 <= goal.c2;
      w.tap(rectKey(rect) === rectKey(goal) || tapInside ? rectKey(goal) : 'miss');
    };
    const cancel = () => setDrag(null);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', cancel);
    return () => { window.removeEventListener('pointerup', finish); window.removeEventListener('pointercancel', cancel); };
  }, []);

  return <WalkthroughPanel walk={walk} steps={steps} label="Learn to play Skeekaku" onExit={() => onDone(null)}
    intro={<>
      <h2>How Skeekaku works</h2>
      <ul>
        <li>Split the board into <strong>rectangles</strong> (squares count too).</li>
        <li>Each rectangle holds exactly <strong>one number</strong>, and the number is how many <strong>squares</strong> it covers.</li>
        <li>Every square on the board ends up in exactly one rectangle.</li>
      </ul>
      <p>Let's split up a small board together.</p>
    </>}
    done={<>
      <h2>Board covered!</h2>
      <ol>
        <li>A number with only <strong>one rectangle</strong> that fits: draw it.</li>
        <li>A square only <strong>one number can reach</strong>: that number's rectangle must cover it.</li>
        <li>Every rectangle you draw leaves less room for the rest.</li>
      </ol>
      <p>In the game, drag from one corner of a rectangle to the other. Tap a rectangle to remove it.</p>
    </>}
    doneActions={[{ label: 'Try a 5 x 5 custom game', primary: true, onClick: () => onDone('practice') }, { label: 'Today\'s puzzle', onClick: () => onDone('daily') }]}
    board={<div className="wt-shikaku" aria-label="Walkthrough board">
      {TUTORIAL_CLUES.flatMap((row, r) => row.map((value, c) => {
        const focus = (r === r0 && c === c0) || (r === fr && c === fc);
        return <button key={`${r}-${c}`} type="button" disabled={walk.phase !== 'play'}
          className={`wt-shikaku-cell${focus ? ' wt-focus' : ''}`}
          aria-label={`Row ${r + 1}, column ${c + 1}${value ? `, number ${value}` : ''}`}
          onPointerDown={event => { event.currentTarget.releasePointerCapture?.(event.pointerId); setDrag({ start: { r, c }, end: { r, c } }); }}
          onPointerEnter={() => { if (dragRef.current) setDrag({ ...dragRef.current, end: { r, c } }); }}
          onKeyDown={event => {
            if ((event.key !== 'Enter' && event.key !== ' ') || !walk.step) return;
            event.preventDefault();
            const goal = walk.step.rect;
            walk.tap(r >= goal.r1 && r <= goal.r2 && c >= goal.c1 && c <= goal.c2 ? rectKey(goal) : 'miss');
          }}>
          {value || ''}
        </button>;
      }))}
      {placed.map(rect => <div key={rectKey(rect)} className="wt-shikaku-rect" style={box(rect)} />)}
      {target && <div className="wt-shikaku-target" style={box(target)} />}
      {drag && <div className="wt-shikaku-drag" style={box(bounds(drag.start, drag.end))} />}
    </div>}
  />;
}
