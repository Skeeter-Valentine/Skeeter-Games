import { WalkthroughPanel, useWalkthrough } from '../../components/Walkthrough';
import { getCounts, getEdges } from './puzzle.js';
import { TUTORIAL_PUZZLE, TUTORIAL_STEPS } from './walkthrough.js';

// Skitches "Learn to play": a 5 x 5 board of five blocks (see walkthrough.js).
export const STITCHES_TUTORIAL_KEY = 'stitches:tutorial-seen';
// The game's block colors (Stitches.jsx).
const COLORS = ['#ff2a85', '#00f0ff', '#ffb703', '#00ff87', '#b568ff'];
const SIZE = 5;
const { regions } = TUTORIAL_PUZZLE;
const EDGES = getEdges(regions);

export default function StitchesTutorial({ onDone }) {
  const walk = useWalkthrough(TUTORIAL_STEPS.map(step => ({ ...step,
    wrong: 'Not that border. Tap the pulsing red one.' })), STITCHES_TUTORIAL_KEY);
  const done = new Set(walk.applied.map(entry => entry.id));
  const targets = new Set(walk.remaining);
  const focus = new Set(walk.step?.focus ?? []);
  const counts = getCounts(SIZE, EDGES.filter(edge => done.has(edge.id)));
  const clueClass = (have, want, key) => `stitches-clue${have > want ? ' over' : have === want ? ' met' : ''}${focus.has(key) ? ' wt-clue' : ''}`;

  return <WalkthroughPanel walk={walk} steps={TUTORIAL_STEPS} label="Learn to play Skitches" onExit={() => onDone(null)}
    intro={<>
      <h2>How Skitches works</h2>
      <ul>
        <li>The board is split into colored <strong>blocks</strong>. Every two blocks that touch need exactly <strong>one stitch</strong> across their border.</li>
        <li>A stitch joins two cells side by side. Its ends are <strong>holes</strong>, and a cell can only hold one hole.</li>
        <li>The numbers outside count the <strong>holes</strong> in each row and column.</li>
      </ul>
      <p>Let's stitch a small one together.</p>
    </>}
    done={<>
      <h2>All stitched up!</h2>
      <ol>
        <li>Blocks that touch in <strong>only one spot</strong>: stitch there.</li>
        <li>A cell that's already a hole <strong>rules out</strong> every other stitch through it.</li>
        <li>Use the <strong>numbers</strong>: a full row or column is all holes, and a finished one has no more.</li>
      </ol>
      <p>In the game, tap a thick border to stitch it and tap again to remove it. Mark empty × lets you note cells that can't be holes.</p>
    </>}
    doneActions={[{ label: 'Try a 5 x 5 random puzzle', primary: true, onClick: () => onDone('practice') }, { label: 'Today\'s puzzle', onClick: () => onDone('daily') }]}
    board={<svg className="stitches-board wt-stitches" viewBox={`0 0 ${SIZE + 1.25} ${SIZE + 1.25}`} aria-label="Walkthrough board">
      {TUTORIAL_PUZZLE.cols.map((clue, c) => <g key={`c${c}`}>
        {focus.has(`c${c}`) && <rect className="wt-stitches-clue-bg" x={c + 1.12} y="0.12" width="0.76" height="0.76" rx="0.12" />}
        <text x={c + 1.5} y="0.55" className={clueClass(counts.cols[c], clue, `c${c}`)}>{clue}</text>
      </g>)}
      {TUTORIAL_PUZZLE.rows.map((clue, r) => <g key={`r${r}`}>
        {focus.has(`r${r}`) && <rect className="wt-stitches-clue-bg" x="0.1" y={r + 1.12} width="0.76" height="0.76" rx="0.12" />}
        <text x="0.48" y={r + 1.55} className={clueClass(counts.rows[r], clue, `r${r}`)}>{clue}</text>
      </g>)}
      {regions.flatMap((row, r) => row.map((block, c) => <g key={`${r}-${c}`}>
        <rect x={c + 1} y={r + 1} width="1" height="1" fill={COLORS[block]} className="stitches-cell" />
        {focus.has(`b${block}`) && <rect x={c + 1} y={r + 1} width="1" height="1" className="wt-stitches-focus" />}
      </g>))}
      {regions.flatMap((row, r) => row.map((block, c) => <g key={`border-${r}-${c}`}>
        {c < SIZE - 1 && row[c + 1] !== block && <line className="stitches-boundary" x1={c + 2} x2={c + 2} y1={r + 1} y2={r + 2} />}
        {r < SIZE - 1 && regions[r + 1][c] !== block && <line className="stitches-boundary" x1={c + 1} x2={c + 2} y1={r + 2} y2={r + 2} />}
      </g>))}
      <rect className="stitches-outline" x="1" y="1" width={SIZE} height={SIZE} />
      {EDGES.map(edge => {
        const x1 = edge.a % SIZE + 1.5, y1 = Math.floor(edge.a / SIZE) + 1.5;
        const x2 = edge.b % SIZE + 1.5, y2 = Math.floor(edge.b / SIZE) + 1.5;
        const flat = y1 === y2, active = done.has(edge.id), target = targets.has(edge.id);
        const tap = () => walk.tap(edge.id);
        return <g key={edge.id} className={`stitches-edge${active ? ' active' : ''}`}
          role="button" tabIndex={walk.phase === 'play' ? 0 : -1}
          aria-label={`Border between row ${Math.floor(edge.a / SIZE) + 1} column ${edge.a % SIZE + 1} and row ${Math.floor(edge.b / SIZE) + 1} column ${edge.b % SIZE + 1}${active ? ', stitched' : ''}${target ? ', next move' : ''}`}
          onClick={tap} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); tap(); } }}>
          <rect className="stitches-hit" x={(x1 + x2) / 2 - (flat ? 0.28 : 0.38)} y={(y1 + y2) / 2 - (flat ? 0.38 : 0.28)}
            width={flat ? 0.56 : 0.76} height={flat ? 0.76 : 0.56} rx="0.1" />
          {target && <rect className="wt-stitches-target" x={(x1 + x2) / 2 - (flat ? 0.2 : 0.42)} y={(y1 + y2) / 2 - (flat ? 0.42 : 0.2)}
            width={flat ? 0.4 : 0.84} height={flat ? 0.84 : 0.4} rx="0.08" />}
          <g className="stitches-thread">
            <line className="stitches-thread-outline" x1={x1} y1={y1} x2={x2} y2={y2} />
            <line x1={x1} y1={y1} x2={x2} y2={y2} />
            <circle cx={x1} cy={y1} r="0.105" /><circle cx={x2} cy={y2} r="0.105" />
          </g>
        </g>;
      })}
    </svg>}
  />;
}
