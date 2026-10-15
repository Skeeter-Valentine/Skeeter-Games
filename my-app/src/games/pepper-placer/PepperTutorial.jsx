import { useMemo, useState } from 'react';
import { readLocal, writeLocal } from '../../utils/dailyStats.js';
import { PATCH_COLORS, Pepper, cellEdges, colourPatches } from './board.jsx';
import { walkthrough } from './puzzle.js';

// "Learn to play": a small Mild board solved one guided step at a time.
// Every step is one of the two Mild moves: plant a pepper in the last open
// square of a row, column or patch, then clear the squares it rules out.
const BOARD = { size: 5, peppers: 1, regions: ['11100', '11002', '41000', '41333', '43333'].map(row => [...row].map(Number)) };
export const PEPPER_TUTORIAL_KEY = 'pepper-placer:tutorial-seen';
const SEEN_KEY = PEPPER_TUTORIAL_KEY;
export const tutorialSeen = () => !!readLocal(SEEN_KEY, false);

const PLACE = { row: 'row', col: 'column', patch: 'patch' };

function explain(step, index, steps) {
  if (step.kind === 'pepper') {
    const { type, cells } = step.unit;
    if (type === 'patch' && cells.length === 1) return {
      title: 'A patch with one square',
      text: 'Every outlined patch needs exactly one pepper. This patch is a single square, so its pepper has to go right here. Tap the glowing square.',
    };
    if (type === 'patch') return {
      title: 'Only one place left',
      text: 'Everything else in this patch has been ruled out, so only one square is still open. Its pepper must go there. Tap it.',
    };
    return {
      title: `One open square in this ${PLACE[type]}`,
      text: `Every ${PLACE[type]} needs one pepper, and this ${PLACE[type]} has just one open square left. Plant the pepper there.`,
    };
  }
  const first = steps.findIndex(other => other.kind === 'mark') === index;
  return first ? {
    title: 'Clear around the pepper',
    text: 'A pepper uses up its row, its column and its patch, and peppers can never touch, not even at the corners. So all the glowing squares must stay empty. Tap each one to mark it, or press Show me.',
  } : {
    title: 'Clear again',
    text: 'Same as before: mark the squares this pepper rules out. That\'s the rest of its row, column and patch, plus the squares touching it.',
  };
}

export default function PepperTutorial({ onDone }) {
  const steps = useMemo(() => walkthrough(BOARD), []);
  const colours = useMemo(() => colourPatches(BOARD), []);
  const [phase, setPhase] = useState('intro'); // intro | play | done
  const [index, setIndex] = useState(0);
  const [peppers, setPeppers] = useState(() => new Set());
  const [marks, setMarks] = useState(() => new Set());
  const [nudge, setNudge] = useState('');
  const n = BOARD.size;
  const step = phase === 'play' ? steps[index] : null;
  const targets = new Set(step ? step.kind === 'pepper' ? [step.cell] : step.cells.filter(cell => !marks.has(cell)) : []);
  const focus = new Set(step?.kind === 'pepper' ? step.unit.cells : step ? [step.from] : []);
  const words = step ? explain(step, index, steps) : null;

  const advance = () => {
    setNudge('');
    if (index + 1 >= steps.length) { setPhase('done'); writeLocal(SEEN_KEY, true); }
    else setIndex(index + 1);
  };
  const showMe = () => {
    if (!step) return;
    if (step.kind === 'pepper') setPeppers(current => new Set([...current, step.cell]));
    else setMarks(current => new Set([...current, ...step.cells]));
    advance();
  };
  const tap = cell => {
    if (!step || peppers.has(cell) || marks.has(cell)) return;
    if (!targets.has(cell)) {
      setNudge(step.kind === 'pepper' ? `Not that one. Look at the outlined ${PLACE[step.unit.type]}: which square is still open?` : 'That square isn\'t ruled out yet. Mark the glowing ones.');
      return;
    }
    setNudge('');
    if (step.kind === 'pepper') { setPeppers(current => new Set([...current, cell])); advance(); return; }
    const next = new Set([...marks, cell]);
    setMarks(next);
    if (step.cells.every(other => next.has(other))) advance();
  };
  const restart = () => { setPeppers(new Set()); setMarks(new Set()); setIndex(0); setNudge(''); setPhase('play'); };

  return <section className="pp-panel pp-tutorial" aria-label="Learn to play Pepper Placer">
    <div className="pp-tutorial-text" aria-live="polite">
      {phase === 'intro' && <>
        <p className="pp-tutorial-step">Learn to play · about a minute</p>
        <h2>How Pepper Placer works</h2>
        <ul>
          <li>Every <strong>row</strong>, every <strong>column</strong> and every outlined <strong>patch</strong> gets exactly one pepper.</li>
          <li>Peppers can't <strong>touch</strong>, not even diagonally.</li>
        </ul>
        <p>On Mild, two moves solve every puzzle. Let's solve this little board together.</p>
        <div className="pp-tutorial-actions">
          <button type="button" className="pp-tutorial-primary" onClick={() => setPhase('play')}>Start the walkthrough</button>
          <button type="button" onClick={() => onDone(null)}>Back to the puzzle</button>
        </div>
      </>}
      {phase === 'play' && <>
        <p className="pp-tutorial-step">Step {index + 1} of {steps.length}</p>
        <h2>{words.title}</h2>
        <p>{words.text}</p>
        {nudge && <p className="pp-tutorial-nudge" role="alert">{nudge}</p>}
        <div className="pp-tutorial-actions">
          <button type="button" onClick={showMe}>Show me</button>
          <button type="button" onClick={() => onDone(null)}>Skip</button>
        </div>
      </>}
      {phase === 'done' && <>
        <p className="pp-tutorial-step">Solved!</p>
        <h2>That's all there is to Mild</h2>
        <ol>
          <li>Find a row, column or patch with <strong>one open square</strong> left and plant its pepper.</li>
          <li><strong>Clear</strong> what that pepper rules out: the rest of its row, column and patch, and every square touching it.</li>
        </ol>
        <p>Repeat until the board is full. Medium and Picante boards need a few extra tricks, explained in How to play.</p>
        <div className="pp-tutorial-actions">
          <button type="button" className="pp-tutorial-primary" onClick={() => onDone('practice')}>Try a Mild practice puzzle</button>
          <button type="button" onClick={() => onDone('daily')}>Today's puzzle</button>
          <button type="button" onClick={restart}>Walk through again</button>
        </div>
      </>}
    </div>
    <div className="pp-board pp-tutorial-board" style={{ '--size': n }} aria-label="Walkthrough board">
      {BOARD.regions.flatMap((row, r) => row.map((patch, c) => {
        const id = r * n + c;
        const pepper = peppers.has(id), mark = marks.has(id);
        return <button key={id} type="button" data-cell={id}
          className={`pp-cell${cellEdges(BOARD.regions, r, c)}${focus.has(id) ? ' pp-focus' : ''}${targets.has(id) ? ' pp-target' : ''}`}
          style={{ background: PATCH_COLORS[colours.get(patch)] }}
          aria-label={`Row ${r + 1}, column ${c + 1}, ${pepper ? 'pepper' : mark ? 'marked empty' : 'empty'}${targets.has(id) ? ', next move' : ''}`}
          disabled={phase !== 'play'} onClick={() => tap(id)}>
          {pepper ? <Pepper /> : mark ? <span className="pp-mark" aria-hidden="true" /> : null}
        </button>;
      }))}
    </div>
  </section>;
}
