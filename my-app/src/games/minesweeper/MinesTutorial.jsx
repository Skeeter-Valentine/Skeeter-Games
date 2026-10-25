import { useMemo } from 'react';
import { WalkthroughPanel, useWalkthrough } from '../../components/Walkthrough';
import { TUTORIAL_MINES, TUTORIAL_SIZE, TUTORIAL_START, TUTORIAL_WORDS, counts, mineWalkthrough, open } from './walkthrough.js';

// Mineskeeter "Learn to play": a 5 x 5 board with five mines (see
// walkthrough.js). The board shows the game's own cell styles.
export const MINES_TUTORIAL_KEY = 'minesweeper:tutorial-seen';
const NUMBERS = counts(TUTORIAL_SIZE, TUTORIAL_MINES);

export default function MinesTutorial({ onDone }) {
  const steps = useMemo(() => (mineWalkthrough(TUTORIAL_SIZE, TUTORIAL_MINES, TUTORIAL_START) ?? []).map((step, index) => ({
    ...step, ...TUTORIAL_WORDS[index],
    wrong: 'Not that square. Look at the highlighted number and the pulsing square beside it.',
  })), []);
  const walk = useWalkthrough(steps, MINES_TUTORIAL_KEY);
  const revealed = new Set(), flagged = new Set();
  open(TUTORIAL_SIZE, NUMBERS, revealed, TUTORIAL_START);
  walk.applied.forEach(entry => {
    if (entry.step.action === 'flag') flagged.add(entry.id);
    else open(TUTORIAL_SIZE, NUMBERS, revealed, entry.id);
  });
  const targets = new Set(walk.remaining);
  const focus = new Set(walk.step?.focus ?? []);
  const cleared = walk.phase === 'done';

  return <WalkthroughPanel walk={walk} steps={steps} label="Learn to play Mineskeeter" onExit={() => onDone(null)}
    intro={<>
      <h2>How Mineskeeter works</h2>
      <ul>
        <li>Some squares hide <strong>mines</strong>. Dig up every square that <strong>isn't</strong> a mine to win.</li>
        <li>A dug square shows how many mines <strong>touch</strong> it, including diagonally.</li>
        <li><strong>Flag</strong> the squares you know are mines so you don't dig them by mistake.</li>
      </ul>
      <p>The first dig has opened up the corner of this board. Let's finish it.</p>
    </>}
    done={<>
      <h2>Board cleared!</h2>
      <ol>
        <li>A number with exactly as many <strong>hidden squares</strong> as mines: they're all mines. <strong>Flag</strong> them.</li>
        <li>A number that already touches all its <strong>flags</strong>: its other squares are safe. <strong>Dig</strong> them.</li>
      </ol>
      <p>In the game, tap to dig. Switch the Dig/Flag toggle to flag with a tap, or right-click (long-press on a phone) to flag.</p>
    </>}
    doneActions={[{ label: 'Try a Beginner board', primary: true, onClick: () => onDone('practice') }, { label: 'Today\'s board', onClick: () => onDone('daily') }]}
    board={<div className="ms-classic-board wt-mines" style={{ '--size': TUTORIAL_SIZE }} aria-label="Walkthrough board">
      {Array.from({ length: TUTORIAL_SIZE }, (_, r) => <div key={r} className="ms-row">
        {Array.from({ length: TUTORIAL_SIZE }, (_, c) => {
          const id = r * TUTORIAL_SIZE + c, dug = revealed.has(id), flag = flagged.has(id);
          const highlight = `${focus.has(id) ? ' wt-focus' : ''}${targets.has(id) ? ' wt-target' : ''}`;
          return <button key={id} type="button" disabled={walk.phase !== 'play'}
            className={`ms-classic-cell ${dug ? 'revealed' : 'unrevealed'} num-${dug ? NUMBERS[id] : 0}${highlight}`}
            aria-label={`Row ${r + 1}, column ${c + 1}, ${dug ? NUMBERS[id] ? `${NUMBERS[id]} mines nearby` : 'empty' : flag ? 'flagged' : 'hidden'}${targets.has(id) ? ', next move' : ''}`}
            onClick={() => walk.tap(id)}>
            {dug ? NUMBERS[id] || '' : flag || (cleared && TUTORIAL_MINES.includes(id)) ? '🚩' : ''}
          </button>;
        })}
      </div>)}
    </div>}
  />;
}
