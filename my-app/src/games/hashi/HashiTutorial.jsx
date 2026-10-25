import { useMemo } from 'react';
import { WalkthroughPanel, useWalkthrough } from '../../components/Walkthrough';
import { getPossibleBridges } from './solver.js';
import { TUTORIAL_ISLANDS, TUTORIAL_WORDS, bridgeKey, hashiWalkthrough } from './walkthrough.js';

// Hashkeet "Learn to play": a 5 x 5 board of six islands (in
// walkthrough.js), solved with the three basic Hashi moves.
export const HASHI_TUTORIAL_KEY = 'hashi:tutorial-seen';
const SIZE = 5, CELL = 80, PAD = 40;
const at = island => [PAD + island.c * CELL, PAD + island.r * CELL];

export default function HashiTutorial({ onDone }) {
  const steps = useMemo(() => (hashiWalkthrough(TUTORIAL_ISLANDS) ?? []).map((step, index) => ({
    ...step, ...TUTORIAL_WORDS[index],
    wrong: 'Not that gap. Tap the pulsing red line between two islands.',
  })), []);
  const walk = useWalkthrough(steps, HASHI_TUTORIAL_KEY);
  const counts = {};
  walk.applied.forEach(entry => { counts[entry.id] = (counts[entry.id] || 0) + 1; });
  const target = walk.remaining[0];
  const focus = new Set(walk.step?.focus ?? []);
  const edges = getPossibleBridges(TUTORIAL_ISLANDS);
  const degree = id => edges.reduce((sum, edge) => sum + (edge.from === id || edge.to === id ? counts[bridgeKey(edge.from, edge.to)] || 0 : 0), 0);
  const view = PAD * 2 + (SIZE - 1) * CELL;

  return <WalkthroughPanel walk={walk} steps={steps} label="Learn to play Hashkeet" onExit={() => onDone(null)}
    intro={<>
      <h2>How Hashkeet works</h2>
      <ul>
        <li>Join the islands with <strong>bridges</strong> until each island has as many bridges as its <strong>number</strong>.</li>
        <li>Bridges run straight across or down, and never cross another bridge or island.</li>
        <li>Two islands can share <strong>one or two</strong> bridges.</li>
        <li>In the end, every island must be <strong>connected</strong> into one network.</li>
      </ul>
      <p>Let's solve a small one together.</p>
    </>}
    done={<>
      <h2>All connected!</h2>
      <ol>
        <li>An island that needs <strong>every bridge it can still take</strong>: draw them all.</li>
        <li>If its other neighbors <strong>can't fit enough</strong>, at least one bridge goes to the one that can.</li>
        <li>Never finish two islands into a <strong>closed-off group</strong>.</li>
      </ol>
      <p>In the real game, tap between two islands for a bridge, again for a double, and a third time to remove it.</p>
    </>}
    doneActions={[{ label: 'Try a small practice puzzle', primary: true, onClick: () => onDone('practice') }, { label: 'Today\'s puzzle', onClick: () => onDone('daily') }]}
    board={<svg className="wt-hashi" viewBox={`0 0 ${view} ${view}`} aria-label="Walkthrough islands">
      {Array.from({ length: SIZE }, (_, i) => <g key={i} className="wt-hashi-grid">
        <line x1={PAD} x2={view - PAD} y1={PAD + i * CELL} y2={PAD + i * CELL} />
        <line y1={PAD} y2={view - PAD} x1={PAD + i * CELL} x2={PAD + i * CELL} />
      </g>)}
      {edges.map(edge => {
        const key = bridgeKey(edge.from, edge.to), count = counts[key] || 0;
        const [x1, y1] = at(TUTORIAL_ISLANDS[edge.from]), [x2, y2] = at(TUTORIAL_ISLANDS[edge.to]);
        const flat = y1 === y2, gap = count === 2 ? 7 : 0;
        const tap = () => walk.phase === 'play' && walk.tap(key);
        return <g key={key} className={`wt-hashi-edge${key === target ? ' is-target' : ''}`}
          role="button" tabIndex={walk.phase === 'play' ? 0 : -1}
          aria-label={`Bridge between the ${TUTORIAL_ISLANDS[edge.from].req} and the ${TUTORIAL_ISLANDS[edge.to].req}, ${count === 0 ? 'none' : count === 1 ? 'single' : 'double'}${key === target ? ', next move' : ''}`}
          onClick={tap} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); tap(); } }}>
          {key === target && <line className="wt-hashi-cue" x1={x1} y1={y1} x2={x2} y2={y2} />}
          {count > 0 && [-gap, gap].slice(0, count === 2 ? 2 : 1).map(offset => <line key={offset} className="wt-hashi-bridge"
            x1={x1 + (flat ? 0 : offset)} y1={y1 + (flat ? offset : 0)} x2={x2 + (flat ? 0 : offset)} y2={y2 + (flat ? offset : 0)} />)}
          <line className="wt-hashi-hit" x1={x1} y1={y1} x2={x2} y2={y2} />
        </g>;
      })}
      {TUTORIAL_ISLANDS.map(island => {
        const [x, y] = at(island), have = degree(island.id);
        return <g key={island.id} className={`wt-hashi-island${have === island.req ? ' done' : ''}${focus.has(island.id) ? ' is-focus' : ''}`}>
          <circle cx={x} cy={y} r="26" />
          <text x={x} y={y + 1}>{island.req}</text>
        </g>;
      })}
    </svg>}
  />;
}
