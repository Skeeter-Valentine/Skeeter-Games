import { useMemo } from 'react';
import { WalkthroughPanel, useWalkthrough } from '../../components/Walkthrough';
import { TUTORIAL_GIVEN, TUTORIAL_SOLUTION, TUTORIAL_SOURCE, TUTORIAL_TAPS, TUTORIAL_WORDS, pipesWalkthrough, rotate } from './walkthrough.js';

// Skeeter Piper "Learn to play": a 4 x 4 network (see walkthrough.js).
export const PIPES_TUTORIAL_KEY = 'pipes:tutorial-seen';
const N = TUTORIAL_SOLUTION.length, CELL = 100;
const turn = (mask, times) => { for (let i = 0; i < times; i++) mask = rotate(mask); return mask; };
const SOLVED = TUTORIAL_SOLUTION.flat();
const START = SOLVED.map((mask, id) => TUTORIAL_TAPS[id] ? turn(mask, 4 - TUTORIAL_TAPS[id]) : mask);
const STEPS_OUT = [[0, -1, 1, 4], [1, 0, 2, 8], [0, 1, 4, 1], [-1, 0, 8, 2]]; // dx, dy, bit, opposite bit

// Tiles joined to the source through matching openings.
function powered(masks) {
  const seen = new Set([TUTORIAL_SOURCE]), queue = [TUTORIAL_SOURCE];
  while (queue.length) {
    const id = queue.shift(), x = id % N, y = Math.floor(id / N);
    for (const [dx, dy, bit, back] of STEPS_OUT) {
      const nx = x + dx, ny = y + dy, next = ny * N + nx;
      if (nx < 0 || ny < 0 || nx >= N || ny >= N || seen.has(next)) continue;
      if (masks[id] & bit && masks[next] & back) { seen.add(next); queue.push(next); }
    }
  }
  return seen;
}

function Pipe({ mask, x, y, lit }) {
  const cx = x + CELL / 2, cy = y + CELL / 2;
  const ends = STEPS_OUT.filter(([, , bit]) => mask & bit).map(([dx, dy]) => [cx + dx * CELL / 2, cy + dy * CELL / 2]);
  const draw = (className) => <>
    {ends.map(([ex, ey], i) => <line key={i} className={className} x1={cx} y1={cy} x2={ex} y2={ey} />)}
    {ends.length === 1 ? <circle className={className} style={{ stroke: 'none' }} cx={cx} cy={cy} r={className.includes('outer') ? 22 : 13} />
      : <rect className={className} style={{ stroke: 'none' }} x={cx - (className.includes('outer') ? 15 : 9)} y={cy - (className.includes('outer') ? 15 : 9)}
        width={className.includes('outer') ? 30 : 18} height={className.includes('outer') ? 30 : 18} />}
  </>;
  return <g className={`wt-pipe${lit ? ' lit' : ''}`}>{draw('wt-pipe-outer')}{draw('wt-pipe-inner')}</g>;
}

export default function PipesTutorial({ onDone }) {
  const steps = useMemo(() => (pipesWalkthrough(TUTORIAL_SOLUTION, TUTORIAL_GIVEN) ?? []).map((step, index) => ({
    ...step, ...TUTORIAL_WORDS[index], targets: Array(TUTORIAL_TAPS[step.cell]).fill(step.cell), ordered: true,
    wrong: 'Not that tile. Tap the one with the pulsing red outline.',
  })), []);
  const walk = useWalkthrough(steps, PIPES_TUTORIAL_KEY);
  const masks = [...START];
  walk.applied.forEach(entry => { masks[entry.id] = rotate(masks[entry.id]); });
  const lit = powered(masks);
  const target = walk.remaining[0];
  const size = N * CELL;

  return <WalkthroughPanel walk={walk} steps={steps} label="Learn to play Skeeter Piper" onExit={() => onDone(null)}
    intro={<>
      <h2>How Skeeter Piper works</h2>
      <ul>
        <li>Tap a tile to <strong>turn</strong> it a quarter turn clockwise.</li>
        <li>Turn the tiles until every pipe <strong>connects</strong> to the green source, with no open ends.</li>
        <li>Nothing may point off the edge of the board.</li>
      </ul>
      <p>Some of this little network is already in place. Let's finish it.</p>
    </>}
    done={<>
      <h2>Fully connected!</h2>
      <ol>
        <li>Start at the <strong>edges and corners</strong>: they only leave tiles a few ways to face.</li>
        <li>A tile must face the pipes that <strong>point at it</strong>, and away from the ones that don't.</li>
        <li>Two dead ends can't face each other: they'd be cut off from the rest.</li>
      </ol>
      <p>In the game, right-click a tile to lock it once you're sure, so a stray click can't turn it.</p>
    </>}
    doneActions={[{ label: 'Try a 5 x 5 custom game', primary: true, onClick: () => onDone('practice') }, { label: 'Today\'s puzzle', onClick: () => onDone('daily') }]}
    board={<svg className="wt-pipes" viewBox={`0 0 ${size} ${size}`} aria-label="Walkthrough pipes">
      {masks.map((mask, id) => {
        const x = (id % N) * CELL, y = Math.floor(id / N) * CELL;
        const tap = () => walk.tap(id);
        return <g key={id} role="button" tabIndex={walk.phase === 'play' ? 0 : -1} className="wt-pipe-cell"
          aria-label={`Row ${Math.floor(id / N) + 1}, column ${id % N + 1}${id === TUTORIAL_SOURCE ? ', source' : ''}${mask === SOLVED[id] ? '' : ', not connected yet'}${id === target ? ', next move' : ''}`}
          onClick={tap} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); tap(); } }}>
          <rect className={`wt-pipe-tile${id === TUTORIAL_SOURCE ? ' source' : ''}`} x={x + 2} y={y + 2} width={CELL - 4} height={CELL - 4} rx="6" />
          <Pipe mask={mask} x={x} y={y} lit={lit.has(id)} />
          {id === target && <rect className="wt-pipe-target" x={x + 6} y={y + 6} width={CELL - 12} height={CELL - 12} rx="8" />}
        </g>;
      })}
    </svg>}
  />;
}
