import { useMemo } from 'react';
import { WalkthroughPanel, useWalkthrough } from '../../components/Walkthrough';
import { CAPACITY, isSolvedStick, slide, topRun } from './puzzle.js';
import { BEADS, beadDefs, beadMarkup } from './beads.js';
import { TUTORIAL_MOVES, TUTORIAL_START } from './walkthrough.js';

export const BEADLE_TUTORIAL_KEY = 'skeedle-beadle:tutorial-seen';
// Its own gradient ids, so it never clashes with the main board's.
const PREFIX = 'beadle-wt';
const DEFS = beadDefs(PREFIX);
const name = color => BEADS[color].name.toLowerCase(); // e.g. "red circle"

function Bead({ color }) {
  return <svg className="beadle-bead-shape" viewBox="0 0 40 40" aria-hidden="true" focusable="false"
    dangerouslySetInnerHTML={{ __html: beadMarkup(color, PREFIX) }} />;
}

function words(lesson, bead) {
  switch (lesson) {
    case 'match': return { title: 'Pick up, then slide',
      text: `Tap the outlined stick to pick up its top bead, a ${name(bead)}. Then tap the stick with a ${name(bead)} on top. Beads only land on the same shape.` };
    case 'empty': return { title: 'Empty sticks take anything',
      text: `Now an ${name(bead)} is on top. You can put any shape on an empty stick, so slide it onto the empty one.` };
    case 'build': return { title: 'Keep building',
      text: `This stick has another ${name(bead)} on top. Slide it onto the one you just moved.` };
    case 'dig': return { title: 'Uncover what\'s underneath',
      text: `This stick has an orange triangle buried under a ${name(bead)}. Move the ${name(bead)} out of the way first: it can go on the other ${name(bead)}s.` };
    case 'freed': return { title: 'Now it\'s free',
      text: `The ${name(bead)} is on top now. Slide it onto the other ${name(bead)}s.` };
    case 'finish': return { title: 'Finish a stick',
      text: `Four matching beads on one stick finish it, and its base turns green. Add the last ${name(bead)}.` };
    case 'together': return { title: 'Matching beads move together',
      text: `When the top beads match, they all slide across at once, as many as fit. Pick up these three ${name(bead)}s and move them in one go.` };
    default: return { title: 'Last bead',
      text: `Put the final ${name(bead)} away and every stick holds a single kind.` };
  }
}

export default function BeadleTutorial({ onDone }) {
  const steps = useMemo(() => {
    let sticks = TUTORIAL_START;
    return TUTORIAL_MOVES.map(move => {
      const bead = sticks[move.from].at(-1);
      sticks = slide(sticks, move.from, move.to).sticks;
      return { ...move, ...words(move.lesson, bead), targets: [move.from, move.to], ordered: true,
        wrong: 'Not that stick. Tap the one with the pulsing red outline.' };
    });
  }, []);
  const walk = useWalkthrough(steps, BEADLE_TUTORIAL_KEY);

  // Replay every finished move; a half-done move has its beads picked up.
  const moves = walk.phase === 'done' ? steps : walk.phase === 'play' ? steps.slice(0, walk.index) : [];
  let sticks = TUTORIAL_START, last = null;
  for (const step of moves) {
    const result = slide(sticks, step.from, step.to);
    sticks = result.sticks; last = { index: step.to, amount: result.amount, key: moves.length };
  }
  const picked = walk.step && walk.applied.some(entry => entry.step === walk.step) ? walk.step.from : null;
  const targets = new Set(walk.remaining);
  const nudge = picked !== null ? 'Now tap the outlined stick to put the beads down.' : null;

  return <WalkthroughPanel walk={walk} steps={steps} label="Learn to play Skeedle Beadle" onExit={() => onDone(null)}
    intro={<>
      <h2>How Skeedle Beadle works</h2>
      <ul>
        <li>Sort the beads so every stick holds a <strong>single kind</strong>. Each color has its own shape.</li>
        <li>Tap a stick to pick up its <strong>top beads</strong>, then tap another stick to slide them across.</li>
        <li>Beads only go onto the <strong>same shape</strong> or an <strong>empty stick</strong>, and each stick holds {CAPACITY}.</li>
      </ul>
      <p>Let's sort this little rack together.</p>
    </>}
    done={<>
      <h2>Sorted!</h2>
      <ol>
        <li>Beads land on the <strong>same shape</strong> or an <strong>empty stick</strong>.</li>
        <li>Use empty sticks to <strong>dig out</strong> beads buried underneath.</li>
        <li>Matching beads on top <strong>move together</strong>, as many as fit.</li>
      </ol>
      <p>Real puzzles have more sticks, so plan ahead. Undo takes back a move, and Hint shows one (on the daily it adds 5 seconds).</p>
    </>}
    doneActions={[{ label: 'Try a Mild practice puzzle', primary: true, onClick: () => onDone('practice') }, { label: 'Today\'s puzzle', onClick: () => onDone('daily') }]}
    board={<div className="wt-beadle">
      <svg className="beadle-defs" aria-hidden="true" focusable="false"><defs dangerouslySetInnerHTML={{ __html: DEFS }} /></svg>
      {walk.phase === 'play' && <p className="wt-beadle-cue" aria-hidden="true">{nudge || 'Tap the outlined stick to pick up its top beads.'}</p>}
      <div className={`beadle-rack${walk.phase === 'done' ? ' won' : ''}`} style={{ '--columns': sticks.length, '--capacity': CAPACITY }} aria-label="Walkthrough sticks">
        {sticks.map((stick, index) => {
          const lifted = picked === index, run = topRun(stick);
          const done = stick.length > 0 && isSolvedStick(stick);
          return <button key={index} type="button" disabled={walk.phase !== 'play'}
            aria-label={`Stick ${index + 1}: ${stick.length ? stick.map(color => BEADS[color].name).join(', ') + ' from bottom to top' : 'empty'}${done ? ', finished' : ''}${lifted ? ', picked up' : ''}${targets.has(index) ? ', next move' : ''}`}
            className={`beadle-stick${lifted ? ' selected' : ''}${done ? ' done' : ''}${targets.has(index) ? ' wt-target' : ''}`}
            onClick={() => walk.tap(index)}>
            <span className="beadle-post">
              <span className="beadle-rod" aria-hidden="true" />
              <span className="beadle-beads">
                {stick.map((color, position) => {
                  const fresh = last?.index === index && position >= stick.length - last.amount;
                  return <span key={fresh ? `${position}-${last.key}` : position}
                    className={`beadle-bead${lifted && position >= stick.length - run ? ' rising' : ''}${fresh ? ' fresh' : ''}`}><Bead color={color} /></span>;
                })}
              </span>
              <span className="beadle-base" aria-hidden="true" />
            </span>
          </button>;
        })}
      </div>
    </div>}
  />;
}
