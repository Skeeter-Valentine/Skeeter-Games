import { WalkthroughPanel, useWalkthrough } from '../../components/Walkthrough';
import { TUTORIAL_PUZZLE, TUTORIAL_STEPS, peers } from './walkthrough.js';

// Skeedoku "Learn to play": a 4 x 4 mini board (see walkthrough.js). Each
// step is two taps, like the game: pick the square, then the number.
export const SUDOKU_TUTORIAL_KEY = 'sudoku:tutorial-seen';
const STEPS = TUTORIAL_STEPS.map(step => ({ ...step, targets: [`c${step.cell}`, `n${step.digit}`], ordered: true,
  wrong: 'Not that one. Tap the pulsing square, then the pulsing number.' }));

export default function SudokuTutorial({ onDone }) {
  const walk = useWalkthrough(STEPS, SUDOKU_TUTORIAL_KEY);
  const grid = [...TUTORIAL_PUZZLE];
  walk.applied.forEach(entry => { if (entry.id.startsWith('n')) grid[entry.step.cell] = entry.step.digit; });
  const step = walk.step;
  const selected = step && walk.applied.some(entry => entry.step === step) ? step.cell : -1;
  const next = walk.remaining[0];
  const area = new Set(step ? step.group?.cells ?? [step.cell, ...peers(step.cell)] : []);

  return <WalkthroughPanel walk={walk} steps={STEPS} label="Learn to play Skeedoku" onExit={() => onDone(null)}
    intro={<>
      <h2>How Skeedoku works</h2>
      <ul>
        <li>Fill the grid so every <strong>row</strong>, <strong>column</strong> and <strong>box</strong> holds each number exactly once.</li>
        <li>The full game is 9 x 9 with the numbers 1 to 9. This mini board uses 1 to 4.</li>
        <li>Pick a square, then pick its number.</li>
      </ul>
      <p>The same three moves solve both. Let's try them.</p>
    </>}
    done={<>
      <h2>Solved!</h2>
      <ol>
        <li>A row, column or box with <strong>one empty square</strong>: fill in the missing number.</li>
        <li>A number with <strong>only one spot</strong> left in a row, column or box goes there.</li>
        <li>A square where <strong>only one number fits</strong> takes that number.</li>
      </ol>
      <p>On bigger boards, Notes mode lets you pencil in the numbers a square could still be.</p>
    </>}
    doneActions={[{ label: 'Try a 4 x 4 practice puzzle', primary: true, onClick: () => onDone('practice') }, { label: 'Today\'s puzzle', onClick: () => onDone('daily') }]}
    board={<div className="wt-sudoku">
      <div className="wt-sudoku-grid" aria-label="Walkthrough board">
        {grid.map((value, id) => {
          const given = !!TUTORIAL_PUZZLE[id];
          return <button key={id} type="button" disabled={walk.phase !== 'play'}
            className={`wt-sudoku-cell${given ? ' given' : ''}${area.has(id) ? ' area' : ''}${id === selected ? ' selected' : ''}${next === `c${id}` ? ' wt-target' : ''}${id % 4 === 1 ? ' box-right' : ''}${Math.floor(id / 4) === 1 ? ' box-bottom' : ''}`}
            aria-label={`Row ${Math.floor(id / 4) + 1}, column ${id % 4 + 1}, ${value || 'empty'}${next === `c${id}` ? ', next move' : ''}`}
            onClick={() => walk.tap(`c${id}`)}>
            {value || ''}
          </button>;
        })}
      </div>
      <div className="wt-sudoku-pad" aria-label="Numbers">
        {[1, 2, 3, 4].map(n => <button key={n} type="button" disabled={walk.phase !== 'play'}
          className={next === `n${n}` ? 'wt-target' : ''} onClick={() => walk.tap(`n${n}`)}>{n}</button>)}
      </div>
    </div>}
  />;
}
