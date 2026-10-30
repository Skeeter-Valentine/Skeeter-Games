import { WalkthroughPanel, useWalkthrough } from '../../components/Walkthrough';
import SlitherBoard from './SlitherBoard';
import { evaluateBoard } from './puzzle.js';
import { TUTORIAL_PUZZLE, TUTORIAL_STEPS } from './walkthrough.js';

// Skeeterlink "Learn to play": a 3 x 3 board (see walkthrough.js).
export const SLITHERLINK_TUTORIAL_KEY = 'slitherlink:tutorial-seen';
const STEPS = TUTORIAL_STEPS.map(step => ({ ...step,
  wrong: step.action === 'line' ? 'Not that side. Draw the glowing ones.' : 'Not that side. Cross off the glowing ones.' }));

export default function SlitherlinkTutorial({ onDone }) {
  const walk = useWalkthrough(STEPS, SLITHERLINK_TUTORIAL_KEY);
  const lines = new Set(), crosses = new Set();
  walk.applied.forEach(entry => (entry.step.action === 'line' ? lines : crosses).add(entry.id));
  STEPS.slice(0, walk.phase === 'done' ? STEPS.length : walk.index).forEach(step => step.auto.forEach(id => crosses.add(id)));
  const status = evaluateBoard(TUTORIAL_PUZZLE, [...lines], [...crosses]);
  const step = walk.step;

  return <WalkthroughPanel walk={walk} steps={STEPS} label="Learn to play Skeeterlink" onExit={() => onDone(null)}
    intro={<>
      <h2>How Skeeterlink works</h2>
      <ul>
        <li>Draw <strong>one loop</strong> along the sides between the dots.</li>
        <li>A <strong>number</strong> says how many sides of its square the loop uses. Blank squares can use any number.</li>
        <li>The loop never branches, crosses or touches itself, so every dot has <strong>0 or 2</strong> lines.</li>
      </ul>
      <p>Let's solve a 3 x 3 board together.</p>
    </>}
    done={<>
      <h2>Loop closed!</h2>
      <ol>
        <li>Start with <strong>0s</strong> (cross every side) and <strong>3s</strong> next to them.</li>
        <li>A number that already has its lines gets the <strong>rest crossed off</strong>, and one with only enough sides left uses them all.</li>
        <li>A line can't <strong>dead-end</strong>: at a dot with one line, follow the only way left.</li>
        <li>Never close a <strong>small loop</strong> early: there's only one loop.</li>
      </ol>
      <p>In the game, tap or drag to draw lines. Cross × (or right-click) marks sides the loop skips.</p>
    </>}
    doneActions={[{ label: 'Try a 5 x 5 practice puzzle', primary: true, onClick: () => onDone('practice') }, { label: 'Today\'s puzzle', onClick: () => onDone('daily') }]}
    board={<div className="wt-sl">
      <SlitherBoard puzzle={TUTORIAL_PUZZLE} lines={lines} crosses={crosses} clueState={status.clueState} won={status.won}
        targets={new Set(walk.remaining)} focusCells={new Set(step?.cells ?? [])} disabled={walk.phase !== 'play'}
        onPress={edge => walk.tap(edge)} onDrag={edge => { if (walk.remaining.includes(edge)) walk.tap(edge); }}
        label="Walkthrough board" />
    </div>}
  />;
}
