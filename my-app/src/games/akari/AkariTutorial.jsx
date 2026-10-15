import { useMemo } from 'react';
import { WalkthroughPanel, useWalkthrough } from '../../components/Walkthrough';
import { visibleCells } from './puzzle.js';
import { akariWalkthrough } from './walkthrough.js';

// Skeeluminate "Learn to play": a 5 x 5 board solved with the three basic
// moves (0 walls, walls that need every open neighbor, squares with only one
// way to be lit). # is a plain wall, digits are numbered walls.
const LAYOUT = ['##.3.', '0....', '.#...', '.###.', '1..##'];
const BOARD = { size: 5, cells: LAYOUT.join('').split('').map(ch => ch === '.' ? null : ch === '#' ? -1 : Number(ch)) };
export const AKARI_TUTORIAL_KEY = 'akari:tutorial-seen';

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;
function words(step) {
  const n = step.wall;
  switch (step.reason) {
    case 'zero': return { title: 'A 0 wall',
      text: 'A number on a black wall counts the bulbs right next to it: up, down, left and right. This wall says 0, so none of its neighbors can hold a bulb. Tap each glowing square to mark it ×.' };
    case 'wallFull': return { title: `A ${n} with ${n === 1 ? 'one open square' : `${n} open squares`}`,
      text: `This wall needs ${plural(n, 'bulb')} beside it, and it has exactly ${n === 1 ? 'one open square' : `${n} open squares`} next to it. ${n === 1 ? 'That square must be a bulb' : 'They must all be bulbs'}. Tap ${n === 1 ? 'it' : 'them'}.` };
    case 'lighting': return { title: 'Light travels',
      text: 'A bulb lights its whole row and column until a wall stops it: everything glowing yellow. Lit squares can\'t hold another bulb, because two bulbs may never shine on each other.' };
    case 'wallDone': return { title: 'This wall is done',
      text: `This wall already has its ${plural(n, 'bulb')}, so its other neighbors must stay empty. Mark them ×.` };
    default: return { title: 'Only one way to light it',
      text: 'Every white square must end up lit. The outlined square can only be lit from one place: everything else it can see is lit, marked or blocked by a wall. Put a bulb on the glowing square.' };
  }
}

export default function AkariTutorial({ onDone }) {
  const steps = useMemo(() => akariWalkthrough(BOARD).map(step => ({
    ...step, ...words(step),
    wrong: step.action === 'bulb' ? 'Not that one. Look at the outlined square or wall and its glowing neighbor.' : 'That square isn\'t ruled out yet. Mark the glowing ones.',
  })), []);
  const walk = useWalkthrough(steps, AKARI_TUTORIAL_KEY);
  const bulbs = new Set(walk.applied.filter(entry => entry.step.action === 'bulb').map(entry => entry.id));
  const marks = new Set(walk.applied.filter(entry => entry.step.action === 'mark').map(entry => entry.id));
  const lit = new Set([...bulbs].flatMap(id => visibleCells(BOARD, id)));
  const targets = new Set(walk.remaining);
  const focus = new Set(walk.step?.reason === 'lighting' ? [] : walk.step?.focus ?? []);

  return <WalkthroughPanel walk={walk} steps={steps} label="Learn to play Skeeluminate" onExit={() => onDone(null)}
    intro={<>
      <h2>How Skeeluminate works</h2>
      <ul>
        <li>Place <strong>bulbs</strong> on white squares until every white square is <strong>lit</strong>.</li>
        <li>A bulb shines along its row and column until a wall stops it, and two bulbs may never shine on each other.</li>
        <li>A <strong>number</strong> on a wall says how many bulbs touch it.</li>
      </ul>
      <p>Three simple moves solve this little board. Let's do it together.</p>
    </>}
    done={<>
      <h2>You've got the basics</h2>
      <ol>
        <li>A <strong>0</strong> wall: mark every square beside it.</li>
        <li>A wall with exactly as many open squares as its number: they're all <strong>bulbs</strong>. A wall that has its bulbs: mark the rest.</li>
        <li>A square that can only be lit from <strong>one place</strong>: put the bulb there.</li>
      </ol>
      <p>Bigger boards use the same moves, just more of them.</p>
    </>}
    doneActions={[{ label: 'Try a small practice puzzle', primary: true, onClick: () => onDone('practice') }, { label: 'Today\'s puzzle', onClick: () => onDone('daily') }]}
    board={<div className="akari-board wt-akari-board" style={{ '--size': BOARD.size }} aria-label="Walkthrough board">
      {BOARD.cells.map((cell, id) => {
        const highlight = `${focus.has(id) ? ' wt-focus' : ''}${targets.has(id) ? ' wt-target' : ''}`;
        if (cell !== null) return <div key={id} className={`akari-wall${highlight}`}>{cell >= 0 ? cell : ''}</div>;
        const bulb = bulbs.has(id), mark = marks.has(id);
        return <button key={id} type="button" className={`akari-cell${lit.has(id) ? ' lit' : ''}${highlight}`} disabled={walk.phase !== 'play'}
          aria-label={`Row ${Math.floor(id / BOARD.size) + 1}, column ${id % BOARD.size + 1}, ${bulb ? 'bulb' : mark ? 'marked empty' : 'empty'}${targets.has(id) ? ', next move' : ''}`}
          onClick={() => walk.tap(id)}>
          {bulb ? <svg viewBox="0 0 32 40" aria-hidden="true"><path d="M10 28C10 23 4 22 4 14a12 12 0 0 1 24 0c0 8-6 9-6 14Z" fill="#ffd14e" stroke="currentColor" strokeWidth="2.5" /><path d="M11 29h10m-10 5h10m-8 4h6M16 27V16m-4-3 4 3 4-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /></svg>
            : mark ? <span aria-hidden="true">×</span> : null}
        </button>;
      })}
    </div>}
  />;
}
