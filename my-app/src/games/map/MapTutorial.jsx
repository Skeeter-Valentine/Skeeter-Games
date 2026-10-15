import { useMemo } from 'react';
import { WalkthroughPanel, useWalkthrough } from '../../components/Walkthrough';
import { makeCandidate } from './puzzle.js';
import { mapWalkthrough } from './walkthrough.js';

// Cartograskeet "Learn to play": a small 12-region map colored one forced
// region at a time. Seed 104 is one of the game's own verified small maps.
export const MAP_TUTORIAL_KEY = 'map:tutorial-seen';
const COLORS = ['#39ff14', '#ff2a85', '#ffff00', '#00d9ff'];
const NAMES = ['green', 'pink', 'yellow', 'blue'];
const list = items => items.length > 2 ? `${items.slice(0, -1).join(', ')} and ${items.at(-1)}` : items.join(' and ');

export default function MapTutorial({ onDone }) {
  const map = useMemo(() => makeCandidate(104, 'Small'), []);
  const steps = useMemo(() => (mapWalkthrough(map) ?? []).map((step, index) => ({
    ...step,
    title: index === 0 ? 'Three neighbors, one choice' : `This one must be ${NAMES[step.color]}`,
    text: index === 0
      ? `Neighboring regions can't share a color, and there are only four colors. The outlined region already touches ${list(step.around.map(c => NAMES[c]))}, so the only color left for it is ${NAMES[step.color]}. Tap it.`
      : `It touches ${list(step.around.map(c => NAMES[c]))}, so it can only be ${NAMES[step.color]}. Tap it.`,
    wrong: 'Not that one. Look for the region with the pulsing red outline.',
  })), [map]);
  const walk = useWalkthrough(steps, MAP_TUTORIAL_KEY);
  const colors = [...map.clues];
  walk.applied.forEach(entry => { colors[entry.id] = entry.step.color; });
  const targets = new Set(walk.remaining);
  const focus = new Set(walk.step?.focus ?? []);

  return <WalkthroughPanel walk={walk} steps={steps} label="Learn to play Cartograskeet" wide onExit={() => onDone(null)}
    intro={<>
      <h2>How Cartograskeet works</h2>
      <ul>
        <li>Color every region <strong>green</strong>, <strong>pink</strong>, <strong>yellow</strong> or <strong>blue</strong>.</li>
        <li>Regions that share a border can never be the <strong>same color</strong>.</li>
        <li>The regions colored at the start are fixed clues.</li>
      </ul>
      <p>One simple idea colors this whole map. Let's try it.</p>
    </>}
    done={<>
      <h2>Mapped!</h2>
      <p>The key move: find a region whose neighbors already show <strong>three different colors</strong>. It can only be the fourth.</p>
      <p>Each region you fill gives its neighbors one more color to rule out, so the map fills in step by step. In the real game, pick a color from the palette and tap a region, or drag a color from one region to another.</p>
    </>}
    doneActions={[{ label: 'Try a small practice map', primary: true, onClick: () => onDone('practice') }, { label: 'Today\'s map', onClick: () => onDone('daily') }]}
    board={<svg className="wt-map" viewBox="-3 -3 726 506" aria-label="Walkthrough map">
      {/* Highlighted regions are drawn last so their outlines sit on top. */}
      {map.polygons.map((poly, i) => i).sort((a, b) => (targets.has(a) * 2 + focus.has(a)) - (targets.has(b) * 2 + focus.has(b))).map(i => {
        const poly = map.polygons[i];
        const tap = () => walk.tap(i);
        return <g key={i} className={`wt-map-region${targets.has(i) ? ' is-target' : ''}${focus.has(i) ? ' is-focus' : ''}`}
          role="button" tabIndex={walk.phase === 'play' ? 0 : -1} aria-label={`Region ${i + 1}, ${colors[i] < 0 ? 'uncolored' : NAMES[colors[i]]}${targets.has(i) ? ', next move' : ''}`}
          onClick={tap} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); tap(); } }}>
          <polygon points={poly.map(p => p.join(',')).join(' ')} fill={colors[i] < 0 ? '#2a3046' : COLORS[colors[i]]} />
          {map.clues[i] >= 0 && <circle cx={map.centers[i][0]} cy={map.centers[i][1]} r="7" className="wt-map-clue" />}
        </g>;
      })}
    </svg>}
  />;
}
