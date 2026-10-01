import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import Navbar from '../../components/Navbar';
import MapGameTools from './MapGameTools';
import DailyResults from '../../components/DailyResults';
import { useDailyDate, useDailyMode, useArchive } from '../../components/DailyBoundary';
import { readLocal, writeLocal } from '../../utils/dailyStats.js';
import { puzzleSnapshot } from '../../utils/archive.js';
import { makePuzzle, dailyConfig } from './puzzle.js';
import { restoreMapProgress } from './progress.js';
import './Map.css';

const COLORS = ['var(--neon-green, #39ff14)', 'var(--neon-pink, #ff2a85)', 'var(--neon-yellow, #ffff00)', 'var(--neon-blue, #00d9ff)'];
const NAMES = ['Green', 'Pink', 'Yellow', 'Blue'];
const PATTERN_NAMES = ['Stripes', 'Dots', 'Crosshatch', 'Waves'];
const WIDTH = 720, HEIGHT = 500;

const initialBoard = puzzle => ({ colors: [...puzzle.clues], notes: puzzle.clues.map(() => 0) });

export default function Map({ initialSeed, initialSize = 'Medium' }) {
  const date = useDailyDate();
  const archive = !!useArchive()?.archive;
  const [daily, setDaily] = useState(initialSeed === undefined);
  useDailyMode(daily);
  const saveKey = `skeeter:map-progress:v3:${archive ? 'archive' : 'daily'}:${date}`;
  const dailyPuzzle = useMemo(() => puzzleSnapshot('map-clear-edges-v3', date, () => {
    const config = dailyConfig(date);
    return { ...config, ...makePuzzle(config.seed, config.size) };
  }), [date]);
  const [settings, setSettings] = useState(() => initialSeed === undefined ? dailyPuzzle : {
    seed: initialSeed, size: ['Small', 'Medium', 'Large'].includes(initialSize) ? initialSize : 'Medium',
  });
  const puzzle = useMemo(() => daily ? dailyPuzzle : settings.puzzle ?? makePuzzle(settings.seed, settings.size), [daily, dailyPuzzle, settings]);
  const [history, setHistory] = useState(() => daily ? restoreMapProgress(puzzle, readLocal(saveKey, null)).history : [initialBoard(puzzle)]);
  const [cursor, setCursor] = useState(() => daily ? restoreMapProgress(puzzle, readLocal(saveKey, null)).cursor : 0);
  useEffect(() => {
    if (daily) writeLocal(saveKey, { fingerprint: JSON.stringify(puzzle), history, cursor });
  }, [daily, saveKey, puzzle, history, cursor]);
  function playDaily() {
    cancelDrag();
    const saved = restoreMapProgress(dailyPuzzle, readLocal(saveKey, null));
    setDaily(true); setSettings(dailyPuzzle); setHistory(saved.history); setCursor(saved.cursor);
    setMessage('Your daily map. Pick up where you left off.');
  }
  const patternId = useId().replace(/:/g, '');
  const [patterns, setPatterns] = useState(() => readLocal('skeeter:map-patterns', false) === true);
  const names = patterns ? PATTERN_NAMES : NAMES;
  const fillFor = color => patterns ? `url(#${patternId}-${color})` : COLORS[color];
  useEffect(() => { writeLocal('skeeter:map-patterns', patterns); }, [patterns]);
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
    const generated = makePuzzle(next.seed, next.size, puzzle.sourceSeed);
    setDaily(false); setSettings({ ...next, puzzle: generated }); setHistory([initialBoard(generated)]); setCursor(0);
    setMessage('A fresh map to make your own.');
  }
  function hint() {
    const i = board.colors.findIndex((c, j) => c !== puzzle.solution[j]);
    if (i === -1) return;
    const next = { colors: [...board.colors], notes: [...board.notes] };
    next.colors[i] = puzzle.solution[i]; next.notes[i] = 0; commit(next);
    setMessage(`Hint: region ${i + 1} is ${names[puzzle.solution[i]].toLowerCase()}.`);
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
    <section className="skeedomap" onKeyDown={keyboard} aria-label="Cartograskeet puzzle">
      <Navbar />
      <header className="skeedomap-header">
        <h1>Cartograskeet</h1>
        <p className="skeedomap-subtitle">Let's make a map.</p>
        <p className="skeedomap-description">Four colors. No matching neighbors.</p>
      </header>
      {daily ? <DailyResults gameId="map" title="Cartograskeet" daily date={date} started={history.length > 1} finished={won} /> : <MapGameTools puzzleId={`${settings.seed}:${settings.size}`} won={won} filled={filled} total={board.colors.length} actions={cursor} />}
      <div className="skeedomap-heading">
        <div className="skeedomap-session-controls">
          <button className="skeedomap-primary" aria-pressed={daily} onClick={playDaily}>{archive ? 'Archive puzzle' : 'Daily'}</button>
          <button className="skeedomap-primary" aria-pressed={!daily} onClick={() => newGame()}>New practice map <span aria-hidden="true">↗</span></button>
        </div>
      </div>
      <label className="skeedomap-pattern-toggle">
        <input type="checkbox" role="switch" checked={patterns} onChange={event => setPatterns(event.target.checked)} />
        <span>Colorblind mode · patterns</span>
      </label>
      <div className={`skeedomap-layout${patterns ? ' uses-patterns' : ''}`}>
        <main className="skeedomap-board-card">
          <div className="skeedomap-board-top"><span><span className="skeedomap-live-dot" /> {daily ? `${archive ? 'ARCHIVE' : 'DAILY'} · ${date}` : `PRACTICE · ${String(settings.seed).slice(-5)}`}</span>
            <label>Map size <select disabled={daily} value={settings.size} onChange={e => newGame(e.target.value)}>{['Small', 'Medium', 'Large'].map(s => <option key={s}>{s}</option>)}</select></label></div>
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
              <defs>
                {[0, 1, 2, 3].map(index => <pattern key={index} id={`${patternId}-${index}`} width="16" height="16" patternUnits="userSpaceOnUse">
                  <rect width="16" height="16" fill={COLORS[index]} />
                  {index === 0 && <path d="M-4 4L4-4M0 16L16 0M12 20L20 12" stroke="#000000" strokeWidth="3" />}
                  {index === 1 && <circle cx="8" cy="8" r="3" fill="#000000" />}
                  {index === 2 && <path d="M0 8H16M8 0V16" stroke="#000000" strokeWidth="2" />}
                  {index === 3 && <path d="M0 4Q4 0 8 4T16 4M0 12Q4 8 8 12T16 12" fill="none" stroke="#000000" strokeWidth="2" />}
                </pattern>)}
              </defs>
              {puzzle.polygons.map((poly, i) => {
                const fixed = puzzle.clues[i] >= 0, color = board.colors[i], [x, y] = puzzle.centers[i];
                return <g key={i} data-region={i} onPointerDown={e => startDrag(e, i)}
                  className={`skeedomap-region ${fixed ? 'is-fixed' : ''} ${color >= 0 ? 'is-draggable' : 'is-empty'} ${dragPreview?.target === i ? 'is-drop-target' : ''} ${dragPreview?.target === i && !dragPreview.note ? 'is-fill-preview' : ''} ${conflicts.has(i) ? 'has-conflict' : ''}`} role="button" tabIndex={0}
                  aria-disabled={fixed} aria-label={`Region ${i + 1}, ${color < 0 ? 'uncolored' : names[color]}${fixed ? ', fixed clue' : ''}${conflicts.has(i) ? ', conflicting neighbor' : ''}${board.notes[i] ? ', notes: ' + names.filter((_, c) => board.notes[i] & 1 << c).join(', ') : ''}`}
                  onClick={() => paint(i)} onContextMenu={e => { e.preventDefault(); paint(i, true); }}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); paint(i); } }}>
                  <polygon points={poly.map(p => p.join(',')).join(' ')} fill={dragPreview?.target === i && !dragPreview.note ? fillFor(dragPreview.color) : color < 0 ? 'var(--tile-empty)' : fillFor(color)} />
                  {labels && <text x={x} y={y + 5}>{i + 1}</text>}
                  {color < 0 && [0, 1, 2, 3].map(c => board.notes[i] & 1 << c ? patterns ? <g key={c} aria-hidden="true"><circle cx={x + (c % 2 ? 10 : -10)} cy={y + (c < 2 ? -10 : 10)} r="9" fill={COLORS[c]} /><text className="skeedomap-note-number" x={x + (c % 2 ? 10 : -10)} y={y + (c < 2 ? -6 : 14)}>{c + 1}</text></g> : <circle key={c} cx={x + (c % 2 ? 8 : -8)} cy={y + (c < 2 ? -8 : 8)} r="5" fill={COLORS[c]} stroke="var(--tile-border)" strokeWidth="1"/> : null)}
                  {conflicts.has(i) && <text className="skeedomap-warning" x={x} y={y - 17}>!</text>}
                </g>;
              })}
            </svg>
          </div>
          <div className="skeedomap-board-bottom"><span>{won ? '✓ Map complete' : `${filled} of ${board.colors.length} regions colored`}</span><span>● <span className="skeedomap-muted">Starting colors are fixed clues</span></span></div>
          <div className="skeedomap-progress" role="progressbar" aria-label="Regions colored" aria-valuenow={filled} aria-valuemin={0} aria-valuemax={board.colors.length}><span style={{ width: `${filled / board.colors.length * 100}%` }} /></div>
        </main>
        <aside className="skeedomap-sidebar">
          <div className="skeedomap-tool-card"><p className="skeedomap-eyebrow">YOUR PALETTE</p><h2>Choose a {patterns ? 'pattern' : 'color'}</h2>
            <div className="skeedomap-palette">{COLORS.map((color, i) => <button key={color} aria-pressed={selected === i} onClick={() => setSelected(i)} className={selected === i ? 'is-selected' : ''}><span className="skeedomap-swatch" style={{ background: color }}>{patterns && <svg viewBox="0 0 120 44" preserveAspectRatio="none" aria-hidden="true"><rect width="120" height="44" fill={fillFor(i)} /></svg>}{selected === i && <b aria-hidden="true">✓</b>}</span><span>{names[i]} <kbd>{i + 1}</kbd></span></button>)}</div>
            <div className="skeedomap-modes"><button aria-pressed={selected === -1} onClick={() => setSelected(-1)}>⌫ Eraser <kbd>E</kbd></button><button aria-pressed={pencil} onClick={() => setPencil(!pencil)}>✎ Notes <kbd>P</kbd></button></div>
            <p className="skeedomap-small">{patterns ? 'Choose a pattern or drag it between regions. Notes use 1–4 to match the palette.' : pencil ? 'Notes on. Click or drag a color into an empty region to mark a possibility.' : 'Drag color from a region, or select a palette color and click to fill.'}</p>
            <div className="skeedomap-divider" />
            <div className="skeedomap-actions"><button disabled={!cursor} onClick={() => setCursor(cursor - 1)}>↶ Undo</button><button disabled={cursor === history.length - 1} onClick={() => setCursor(cursor + 1)}>↷ Redo</button><button disabled={won} onClick={hint}>✧ Hint</button><button onClick={() => { commit(initialBoard(puzzle)); setMessage('Map reset. A clean slate.'); }}>↺ Reset</button></div>
            <label className="skeedomap-label-toggle"><input type="checkbox" checked={labels} onChange={e => setLabels(e.target.checked)}/> Show region numbers <kbd>L</kbd></label>
          </div>
        </aside>
      </div>
      <div className={`skeedomap-status ${won ? 'is-won' : ''}`} role="status" aria-live="polite">{won ? 'Beautifully mapped. Every color is in its place. Ready for another?' : conflicts.size ? `${conflicts.size} regions have matching neighbors. Look for the ! marks.` : message}</div>
      <footer className="skeedomap-footer"><span>Inspired by <a href="https://www.chiark.greenend.org.uk/~sgtatham/puzzles/" target="_blank" rel="noreferrer">Simon Tatham’s Map</a></span></footer>
    </section>
  );
}
