import React, { useMemo, useRef, useState } from 'react';
import './Map.css';

// Original implementation of Simon Tatham's Map rules. No external dependencies.
const COLORS = ['#ed9279', '#edc965', '#83b9a0', '#859fcc'];
const NAMES = ['Coral', 'Gold', 'Sage', 'Blue'];
const WIDTH = 720, HEIGHT = 500;

function random(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function clip(poly, a, b, c) {
  const result = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const dp = a * p[0] + b * p[1] - c;
    const dq = a * q[0] + b * q[1] - c;
    if (dp <= 1e-7) result.push(p);
    if ((dp < 0) !== (dq < 0)) {
      const t = dp / (dp - dq);
      result.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
    }
  }
  return result;
}

// Build each shared border once, then reuse it in reverse for its neighbor.
// Bends stay inside the triangles from the original edge to each cell center,
// so neighboring borders cannot cross and the adjacency graph stays intact.
function shapeBorders(polygons, centers, seed) {
  const rand = random(seed ^ 0x51ed270b);
  const edges = Object.create(null);
  const pointKey = p => p.map(v => v.toFixed(5)).join(',');
  const edgeKey = (p, q) => [pointKey(p), pointKey(q)].sort().join('|');
  polygons.forEach((poly, owner) => poly.forEach((p, i) => {
    const q = poly[(i + 1) % poly.length], key = edgeKey(p, q);
    if (!edges[key]) edges[key] = { p, q, owners: [] };
    edges[key].owners.push(owner);
  }));
  Object.values(edges).forEach(edge => {
    const { p, q, owners } = edge;
    edge.points = [p];
    const length = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (owners.length === 2 && length > 16) {
      const count = length > 85 ? 3 : 2;
      for (let i = 1; i <= count; i++) {
        const t = (i + (rand() - .5) * .24) / (count + 1);
        const base = [p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])];
        const center = centers[owners[rand() < .5 ? 0 : 1]];
        const distance = Math.hypot(center[0] - base[0], center[1] - base[1]);
        const amount = Math.min(.09 + rand() * .09, length * .12 / distance);
        edge.points.push([base[0] + (center[0] - base[0]) * amount,
          base[1] + (center[1] - base[1]) * amount]);
      }
    }
    edge.points.push(q);
  });
  return polygons.map(poly => poly.flatMap((p, i) => {
    const edge = edges[edgeKey(p, poly[(i + 1) % poly.length])];
    const points = pointKey(p) === pointKey(edge.p) ? edge.points : [...edge.points].reverse();
    return points.slice(0, -1);
  }));
}

// MRV backtracking; stops after two solutions when testing uniqueness.
function solutions(adj, clues, limit = 2) {
  const values = [...clues], found = [];
  function search() {
    let next = -1, choices = [];
    for (let i = 0; i < values.length; i++) {
      if (values[i] !== -1) continue;
      const options = [0, 1, 2, 3].filter(c => adj[i].every(j => values[j] !== c));
      if (!options.length) return;
      if (next === -1 || options.length < choices.length) { next = i; choices = options; }
    }
    if (next === -1) { found.push([...values]); return; }
    for (const c of choices) {
      values[next] = c; search(); values[next] = -1;
      if (found.length >= limit) return;
    }
  }
  search(); return found;
}

function polygonArea(poly) {
  return Math.abs(poly.reduce((sum, p, i) => {
    const q = poly[(i + 1) % poly.length];
    return sum + p[0] * q[1] - q[0] * p[1];
  }, 0)) / 2;
}

function makeLayout(seed, count) {
  const rand = random(seed ^ 0x2c9277b5);
  for (let attempt = 0; attempt < 512; attempt++) {
    // Free placement creates sparse areas and clusters instead of equal grid cells.
    const points = Array.from({ length: count }, () => [
      (0.025 + rand() * .95) * WIDTH, (0.025 + rand() * .95) * HEIGHT,
    ]);
    const polygons = points.map((p, i) => {
    let poly = [[0, 0], [WIDTH, 0], [WIDTH, HEIGHT], [0, HEIGHT]];
    points.forEach((q, j) => {
      if (i !== j) poly = clip(poly, q[0] - p[0], q[1] - p[1],
        (q[0] ** 2 + q[1] ** 2 - p[0] ** 2 - p[1] ** 2) / 2);
    });
    return poly;
    });
    const centers = polygons.map(poly => [
      poly.reduce((s, p) => s + p[0], 0) / poly.length,
      poly.reduce((s, p) => s + p[1], 0) / poly.length,
    ]);
    const shaped = shapeBorders(polygons, centers, seed);
    const areas = shaped.map(polygonArea).sort((a, b) => a - b);
    const ratio = areas[count - 1] / areas[0];
    // Measure the actual rendered regions, including their irregular borders.
    // Require a broad middle spread as well as a 10–12× largest/smallest ratio.
    if (ratio >= 10 && ratio <= 12 && areas[0] >= WIDTH * HEIGHT / count * .15 &&
        areas[Math.floor(count * .75)] / areas[Math.floor(count * .25)] >= 2.2) {
      return { points, polygons, centers, shaped };
    }
  }
  // Seed 1 is a verified fallback for all three supported region counts.
  return makeLayout(1, count);
}

function makePuzzle(seed, size) {
  const rand = random(seed), count = size === 'Small' ? 12 : size === 'Large' ? 35 : 24;
  const { points, polygons, centers, shaped } = makeLayout(seed, count);
  const adj = points.map(() => []);
  points.forEach((p, i) => points.forEach((q, j) => {
    if (j <= i) return;
    const a = q[0] - p[0], b = q[1] - p[1];
    const c = (q[0] ** 2 + q[1] ** 2 - p[0] ** 2 - p[1] ** 2) / 2;
    const edge = polygons[i].some((v, k, poly) => {
      const w = poly[(k + 1) % poly.length];
      return Math.abs(a * v[0] + b * v[1] - c) < 1e-5 &&
        Math.abs(a * w[0] + b * w[1] - c) < 1e-5 && Math.hypot(v[0] - w[0], v[1] - w[1]) > 1e-5;
    });
    if (edge) { adj[i].push(j); adj[j].push(i); }
  }));
  const solution = solutions(adj, points.map(() => -1), 1)[0];
  // A three-colorable map needs a fourth-color seed to allow deductions.
  if (!solution.includes(3)) {
    const candidate = adj.findIndex(ns => ns.length >= 3);
    solution[candidate < 0 ? 0 : candidate] = 3;
  }
  const clues = [...solution];
  const order = points.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]];
  }
  for (const i of order) {
    const saved = clues[i];
    if (clues.filter(c => c === saved).length <= 1) continue;
    clues[i] = -1;
    if (solutions(adj, clues).length !== 1) clues[i] = saved;
  }
  if (!clues.includes(-1)) return makePuzzle((seed + 1) >>> 0, size);
  return { polygons: shaped, centers, adj, clues, solution };
}

const initialBoard = puzzle => ({ colors: [...puzzle.clues], notes: puzzle.clues.map(() => 0) });

export default function Map({ initialSeed = 17429, initialSize = 'Medium' }) {
  const [settings, setSettings] = useState({ seed: initialSeed, size: ['Small', 'Medium', 'Large'].includes(initialSize) ? initialSize : 'Medium' });
  const puzzle = useMemo(() => makePuzzle(settings.seed, settings.size), [settings]);
  const [history, setHistory] = useState(() => [initialBoard(puzzle)]);
  const [cursor, setCursor] = useState(0);
  const [selected, setSelected] = useState(0);
  const [pencil, setPencil] = useState(false);
  const [labels, setLabels] = useState(false);
  const [message, setMessage] = useState('Pick a color. Find its place.');
  const drag = useRef(null);
  const suppressClick = useRef(false);
  const suppressContextMenu = useRef(false);
  const [dragPreview, setDragPreview] = useState(null);
  const board = history[cursor];
  const conflicts = new Set();
  puzzle.adj.forEach((neighbors, i) => neighbors.forEach(j => {
    if (board.colors[i] >= 0 && board.colors[i] === board.colors[j]) { conflicts.add(i); conflicts.add(j); }
  }));
  const filled = board.colors.filter(c => c >= 0).length;
  const won = filled === board.colors.length && !conflicts.size;

  function commit(next) {
    setHistory([...history.slice(0, cursor + 1), next]); setCursor(cursor + 1);
  }
  function paint(i, note = pencil, color = selected) {
    if (puzzle.clues[i] >= 0) { setMessage('That region is a fixed clue.'); return; }
    const next = { colors: [...board.colors], notes: [...board.notes] };
    if (note && color >= 0) {
      if (next.colors[i] >= 0) { setMessage('Erase this region before adding notes.'); return; }
      next.notes[i] ^= 1 << color;
    } else { next.colors[i] = color; next.notes[i] = 0; }
    if (next.colors[i] === board.colors[i] && next.notes[i] === board.notes[i]) return;
    commit(next); setMessage('A little color, a little closer.');
  }
  function startDrag(event, source) {
    if ((event.button !== 0 && event.button !== 2) || !event.isPrimary || drag.current) return;
    suppressClick.current = false;
    if (board.colors[source] < 0) return;
    const svg = event.currentTarget.ownerSVGElement;
    const rightButton = event.button === 2;
    suppressContextMenu.current = rightButton;
    drag.current = { source, color: board.colors[source], note: rightButton || pencil, rightButton,
      pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false, svg };
    svg.setPointerCapture(event.pointerId);
  }
  function dragTarget(event, session) {
    const element = session.svg.ownerDocument.elementFromPoint(event.clientX, event.clientY);
    const region = element?.closest('[data-region]');
    return region && session.svg.contains(region) ? Number(region.dataset.region) : -1;
  }
  function moveDrag(event) {
    const session = drag.current;
    if (!session || session.pointerId !== event.pointerId) return;
    if (Math.hypot(event.clientX - session.x, event.clientY - session.y) > 6) session.moved = true;
    if (!session.moved) return;
    const target = dragTarget(event, session);
    setDragPreview({ source: session.source, color: session.color, note: session.note,
      target: target !== session.source && puzzle.clues[target] === -1 &&
        (!session.note || board.colors[target] === -1) ? target : -1 });
  }
  function cancelDrag() {
    const session = drag.current;
    if (!session) return;
    drag.current = null;
    suppressClick.current = true;
    setDragPreview(null);
    if (session.svg.hasPointerCapture(session.pointerId)) session.svg.releasePointerCapture(session.pointerId);
  }
  function finishDrag(event) {
    const session = drag.current;
    if (!session || session.pointerId !== event.pointerId) return;
    const moved = session.moved || Math.hypot(event.clientX - session.x, event.clientY - session.y) > 6;
    const target = dragTarget(event, session);
    cancelDrag();
    // Pointer capture retargets the native click to the SVG. Handle taps here
    // and suppress that click so a completed drag never paints the source.
    if (!moved) paint(session.source, session.rightButton || pencil);
    else if (target >= 0 && target !== session.source) paint(target, session.note, session.color);
  }
  function newGame(size = settings.size) {
    cancelDrag();
    const next = { seed: (settings.seed + 7919) >>> 0, size };
    const generated = makePuzzle(next.seed, next.size);
    setSettings(next); setHistory([initialBoard(generated)]); setCursor(0);
    setMessage('A fresh map to make your own.');
  }
  function hint() {
    const i = board.colors.findIndex((c, j) => c !== puzzle.solution[j]);
    if (i === -1) return;
    const next = { colors: [...board.colors], notes: [...board.notes] };
    next.colors[i] = puzzle.solution[i]; next.notes[i] = 0; commit(next);
    setMessage(`Hint: region ${i + 1} is ${NAMES[puzzle.solution[i]].toLowerCase()}.`);
    setLabels(true);
  }
  function keyboard(event) {
    if (/^(SELECT|INPUT|TEXTAREA)$/.test(event.target.tagName)) return;
    const key = event.key.toLowerCase();
    if (key === 'escape') { cancelDrag(); return; }
    if ('1234'.includes(key) && key.length === 1) setSelected(Number(key) - 1);
    else if (key === 'e') setSelected(-1);
    else if (key === 'p') setPencil(!pencil);
    else if (key === 'l') setLabels(!labels);
    else if ((event.ctrlKey || event.metaKey) && key === 'z') {
      event.preventDefault(); setCursor(Math.max(0, Math.min(history.length - 1, cursor + (event.shiftKey ? 1 : -1))));
    }
  }

  return (
    <section className="skeedomap" onKeyDown={keyboard} aria-label="Skeedomap puzzle">
      <header className="skeedomap-header">
        <a className="skeedomap-brand" href="https://www.chiark.greenend.org.uk/~sgtatham/puzzles/doc/map.html" target="_blank" rel="noreferrer" aria-label="Skeedomap, Map puzzle rules">
          <span className="skeedomap-logo" aria-hidden="true">◈</span> skeedomap<span className="skeedomap-period">.</span>
        </a>
        <span className="skeedomap-tagline">FOUR COLORS. ONE QUIET CHALLENGE.</span>
      </header>
      <div className="skeedomap-heading">
        <div><p className="skeedomap-eyebrow">A LITTLE SPACE FOR LOGIC</p><h1>Make room for color.</h1>
          <p>Four colors. Every region. No matching neighbors.</p></div>
        <button className="skeedomap-primary" onClick={() => newGame()}>New map <span aria-hidden="true">↗</span></button>
      </div>
      <div className="skeedomap-layout">
        <main className="skeedomap-board-card">
          <div className="skeedomap-board-top"><span><span className="skeedomap-live-dot" /> MAP {String(settings.seed).slice(-5)}</span>
            <label>Map size <select value={settings.size} onChange={e => newGame(e.target.value)}>{['Small', 'Medium', 'Large'].map(s => <option key={s}>{s}</option>)}</select></label></div>
          <div className="skeedomap-canvas">
            <svg className={dragPreview ? 'is-dragging' : ''}
              onPointerDownCapture={() => { if (!drag.current) { suppressClick.current = false; suppressContextMenu.current = false; } }}
              onPointerMove={moveDrag} onPointerUp={finishDrag}
              onPointerCancel={cancelDrag} onLostPointerCapture={cancelDrag}
              onContextMenuCapture={e => {
                e.preventDefault();
                // Browsers can emit contextmenu before or after pointerup.
                // A right-button gesture is handled once by finishDrag.
                if (suppressContextMenu.current) e.stopPropagation();
              }}
              onClickCapture={e => { if (suppressClick.current && e.detail !== 0) { suppressClick.current = false; e.preventDefault(); e.stopPropagation(); } }}
              viewBox={`-3 -3 ${WIDTH + 6} ${HEIGHT + 6}`} aria-label="Interactive map. Drag a colored region onto another to copy its color, or use the palette. Tab to regions and press Enter or Space to color them.">
              {puzzle.polygons.map((poly, i) => {
                const fixed = puzzle.clues[i] >= 0, color = board.colors[i], [x, y] = puzzle.centers[i];
                return <g key={i} data-region={i} onPointerDown={e => startDrag(e, i)}
                  className={`skeedomap-region ${fixed ? 'is-fixed' : ''} ${color >= 0 ? 'is-draggable' : ''} ${dragPreview?.target === i ? 'is-drop-target' : ''} ${conflicts.has(i) ? 'has-conflict' : ''}`} role="button" tabIndex={0}
                  aria-disabled={fixed} aria-label={`Region ${i + 1}, ${color < 0 ? 'uncolored' : NAMES[color]}${fixed ? ', fixed clue' : ''}${conflicts.has(i) ? ', conflicting neighbor' : ''}${board.notes[i] ? ', notes: ' + NAMES.filter((_, c) => board.notes[i] & 1 << c).join(', ') : ''}`}
                  onClick={() => paint(i)} onContextMenu={e => { e.preventDefault(); paint(i, true); }}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); paint(i); } }}>
                  <polygon points={poly.map(p => p.join(',')).join(' ')} fill={dragPreview?.target === i && !dragPreview.note ? COLORS[dragPreview.color] : color < 0 ? '#f6f4ee' : COLORS[color]} />
                  {fixed && <g transform={`translate(${x - 5},${y - 6})`} className="skeedomap-lock"><rect x="0" y="5" width="10" height="8" rx="2"/><path d="M2 5V3a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" strokeWidth="1.8"/></g>}
                  {labels && <text x={x} y={y + (fixed ? 23 : 5)}>{i + 1}</text>}
                  {color < 0 && [0, 1, 2, 3].map(c => board.notes[i] & 1 << c ? <circle key={c} cx={x + (c % 2 ? 8 : -8)} cy={y + (c < 2 ? -8 : 8)} r="5" fill={COLORS[c]} stroke="#403e35" strokeWidth="1"/> : null)}
                  {conflicts.has(i) && <text className="skeedomap-warning" x={x} y={y - 17}>!</text>}
                </g>;
              })}
            </svg>
          </div>
          <div className="skeedomap-board-bottom"><span>{won ? '✓ Map complete' : `${filled} of ${board.colors.length} regions colored`}</span><span>● <span className="skeedomap-muted">Locked regions are clues</span></span></div>
          <div className="skeedomap-progress" role="progressbar" aria-label="Regions colored" aria-valuenow={filled} aria-valuemin={0} aria-valuemax={board.colors.length}><span style={{ width: `${filled / board.colors.length * 100}%` }} /></div>
        </main>
        <aside className="skeedomap-sidebar">
          <div className="skeedomap-tool-card"><p className="skeedomap-eyebrow">YOUR PALETTE</p><h2>Choose a color</h2>
            <div className="skeedomap-palette">{COLORS.map((color, i) => <button key={color} aria-pressed={selected === i} onClick={() => setSelected(i)} className={selected === i ? 'is-selected' : ''}><span style={{ background: color }}>{selected === i ? '✓' : ''}</span><span>{NAMES[i]} <kbd>{i + 1}</kbd></span></button>)}</div>
            <div className="skeedomap-modes"><button aria-pressed={selected === -1} onClick={() => setSelected(-1)}>⌫ Eraser <kbd>E</kbd></button><button aria-pressed={pencil} onClick={() => setPencil(!pencil)}>✎ Notes <kbd>P</kbd></button></div>
            <p className="skeedomap-small">{pencil ? 'Notes on. Click or drag a color into an empty region to mark a possibility.' : 'Drag color from a region, or select a palette color and click to fill.'}</p>
            <div className="skeedomap-divider" />
            <div className="skeedomap-actions"><button disabled={!cursor} onClick={() => setCursor(cursor - 1)}>↶ Undo</button><button disabled={cursor === history.length - 1} onClick={() => setCursor(cursor + 1)}>↷ Redo</button><button disabled={won} onClick={hint}>✧ Hint</button><button onClick={() => { commit(initialBoard(puzzle)); setMessage('Map reset. A clean slate.'); }}>↺ Reset</button></div>
            <label className="skeedomap-label-toggle"><input type="checkbox" checked={labels} onChange={e => setLabels(e.target.checked)}/> Show region numbers <kbd>L</kbd></label>
          </div>
          <div className="skeedomap-how"><span className="skeedomap-eyebrow">THE ART OF ADJACENCY</span><h2>A border makes a neighbor.</h2><p>Regions sharing an edge need different colors. Regions touching only at a corner can match.</p><p>Drag from any colored region, including a locked clue, and release on another region to copy its color. Locked clues cannot be changed.</p><p>Right-click and drag a colored region into an empty region to toggle that color’s note. Right-click an empty region to toggle the selected palette color’s note. Press Escape to cancel a drag.</p></div>
        </aside>
      </div>
      <div className={`skeedomap-status ${won ? 'is-won' : ''}`} role="status" aria-live="polite">{won ? 'Beautifully mapped. Every color is in its place. Ready for another?' : conflicts.size ? `${conflicts.size} regions have matching neighbors. Look for the ! marks.` : message}</div>
      <footer className="skeedomap-footer"><span>A small puzzle. A fresh perspective.</span><span>Inspired by <a href="https://www.chiark.greenend.org.uk/~sgtatham/puzzles/" target="_blank" rel="noreferrer">Simon Tatham’s Map</a></span></footer>
    </section>
  );
}