import { useEffect, useMemo, useRef, useState } from 'react';
import Navbar from '../../components/Navbar';
import DailyResults from '../../components/DailyResults';
import useUndoShortcut from '../../components/useUndoShortcut';
import { useDailyDate, useArchive } from '../../components/DailyBoundary';
import { readLocal, writeLocal } from '../../utils/dailyStats.js';
import { puzzleSnapshot } from '../../utils/archive.js';
import { dailyLevel as dailyLevelFor } from './dailyConfig.js';
import { LEVELS, checkBoard, dailyPuzzle, generatePuzzle } from './puzzle.js';
import { PATCH_COLORS, Pepper, colourPatches } from './board.jsx';
import { WalkthroughPrompt } from '../../components/Walkthrough';
import PepperTutorial, { PEPPER_TUTORIAL_KEY, tutorialSeen } from './PepperTutorial.jsx';
import './PepperPlacer.css';

// Pepper Placer: Star Battle with peppers. 1, 2 or 3 peppers in every row,
// column and patch, and no two peppers touching (diagonals included).

// v2: puzzles built by the logic-checked generator (v1 progress is for old boards).
const saveKey = (date, archive) => `${archive ? 'archive:v1:' : ''}pepper-placer-daily-v2:${date}`;

export function restoreProgress(puzzle, saved) {
  const empty = { peppers: [], marks: [], seconds: 0, started: false };
  const cells = puzzle.size * puzzle.size;
  const valid = list => Array.isArray(list) && new Set(list).size === list.length && list.every(id => Number.isInteger(id) && id >= 0 && id < cells);
  if (!saved || saved.fingerprint !== JSON.stringify(puzzle.regions) || !valid(saved.peppers) || !valid(saved.marks)
    || saved.peppers.some(id => saved.marks.includes(id))) return empty;
  return { peppers: saved.peppers, marks: saved.marks,
    seconds: Number.isInteger(saved.seconds) && saved.seconds >= 0 ? saved.seconds : 0,
    started: !!saved.started || saved.peppers.length > 0 || saved.marks.length > 0 };
}

function buildGame(date, mode, level, archive) {
  const puzzle = mode === 'daily'
    // Mild boards got simpler (v3); the other levels are unchanged (v2).
    ? puzzleSnapshot(level === 1 ? 'pepper-placer-v3' : 'pepper-placer-v2', date, () => dailyPuzzle(date, level))
    : generatePuzzle(level);
  const progress = restoreProgress(puzzle, mode === 'daily' ? readLocal(saveKey(date, archive), null) : null);
  return { puzzle, mode, ...progress, past: [], future: [] };
}

export default function PepperPlacer() {
  const date = useDailyDate();
  const archive = !!useArchive()?.archive;
  const dailyLevel = dailyLevelFor(date);
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState({ mode: 'daily', level: dailyLevel });
  const [practiceLevel, setPracticeLevel] = useState(1);
  const [tool, setTool] = useState('pepper');
  // The "Learn to play" walkthrough replaces the board while it's open; new
  // players get a prompt to try it.
  const [learning, setLearning] = useState(false);
  const [seenTutorial, setSeenTutorial] = useState(tutorialSeen);
  const boardRef = useRef(null);
  const drag = useRef(null);

  // Bigger boards take a moment to grow, so build them after the page paints.
  useEffect(() => {
    if (!loading) return undefined;
    const timer = setTimeout(() => {
      setGame(buildGame(date, loading.mode, loading.level, archive));
      setLoading(null);
    }, 30);
    return () => clearTimeout(timer);
  }, [loading, date, archive]);

  const puzzle = game?.puzzle;
  const pepperSet = useMemo(() => new Set(game?.peppers ?? []), [game?.peppers]);
  const markSet = useMemo(() => new Set(game?.marks ?? []), [game?.marks]);
  const status = useMemo(() => puzzle ? checkBoard(puzzle, pepperSet) : null, [puzzle, pepperSet]);
  const colours = useMemo(() => puzzle ? colourPatches(puzzle) : null, [puzzle]);
  const won = !!status?.won;

  useEffect(() => {
    if (!game?.started || won || learning) return undefined;
    const timer = setInterval(() => setGame(current => ({ ...current, seconds: current.seconds + 1 })), 1000);
    return () => clearInterval(timer);
  }, [game?.started, won, learning]);

  useEffect(() => {
    if (game?.mode === 'daily') writeLocal(saveKey(date, archive), {
      fingerprint: JSON.stringify(game.puzzle.regions), peppers: game.peppers, marks: game.marks, seconds: game.seconds, started: game.started,
    });
  }, [date, archive, game]);

  function changeMode(mode, level = mode === 'daily' ? dailyLevel : practiceLevel) {
    setLearning(false);
    setGame(null);
    setLoading({ mode, level });
    setTool('pepper');
  }

  function commit(peppers, marks) {
    setGame(current => ({ ...current, peppers, marks, started: true,
      past: [...current.past, { peppers: current.peppers, marks: current.marks }].slice(-500), future: [] }));
  }

  // Sets one cell to 'pepper', 'mark' or 'empty'.
  function setCell(id, value, base = game) {
    const peppers = base.peppers.filter(cell => cell !== id), marks = base.marks.filter(cell => cell !== id);
    if (value === 'pepper') peppers.push(id);
    if (value === 'mark') marks.push(id);
    return { peppers, marks };
  }
  function toggle(id, using = tool) {
    if (won || !game) return;
    const now = pepperSet.has(id) ? 'pepper' : markSet.has(id) ? 'mark' : 'empty';
    const next = using === 'erase' ? 'empty' : now === using ? 'empty' : using;
    if (next === now) return;
    const { peppers, marks } = setCell(id, next);
    commit(peppers, marks);
  }

  function travel(direction) {
    setGame(current => {
      if (!current) return current;
      const from = direction === 'undo' ? 'past' : 'future';
      const to = direction === 'undo' ? 'future' : 'past';
      if (!current[from].length || checkBoard(current.puzzle, new Set(current.peppers)).won) return current;
      return { ...current, ...current[from].at(-1), [from]: current[from].slice(0, -1),
        [to]: [...current[to], { peppers: current.peppers, marks: current.marks }] };
    });
  }
  useUndoShortcut(() => travel('undo'), () => travel('redo'));

  // Marking drags: right-button (or the Mark tool) and drag across cells to
  // mark them all; starting on a mark clears instead. One undo step per drag.
  function cellAt(event) {
    const element = document.elementFromPoint(event.clientX, event.clientY)?.closest?.('[data-cell]');
    return element && boardRef.current?.contains(element) ? Number(element.dataset.cell) : null;
  }
  function pointerDown(event, id) {
    if (won) return;
    const marking = event.button === 2 || (tool === 'mark' && event.button === 0);
    if (!marking) return;
    event.preventDefault();
    const clearing = markSet.has(id);
    drag.current = { clearing, before: { peppers: game.peppers, marks: game.marks }, cells: new Set(), moved: false };
    paintDrag(id);
  }
  function paintDrag(id) {
    const state = drag.current;
    if (!state || id === null || state.cells.has(id) || pepperSet.has(id)) return;
    state.cells.add(id);
    if (state.cells.size > 1) state.moved = true;
    setGame(current => {
      const marks = state.clearing ? current.marks.filter(cell => cell !== id) : current.marks.includes(id) ? current.marks : [...current.marks, id];
      return { ...current, marks, started: true };
    });
  }
  useEffect(() => {
    const move = event => { if (drag.current) paintDrag(cellAt(event)); };
    const up = () => {
      const state = drag.current;
      if (!state) return;
      drag.current = null;
      if (state.cells.size) setGame(current => ({ ...current, past: [...current.past, state.before].slice(-500), future: [] }));
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
  });

  function handleKey(event, id) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key === 'p' || key === ' ' || key === 'enter') { event.preventDefault(); toggle(id, 'pepper'); return; }
    if (key === 'x' || key === 'm') { event.preventDefault(); toggle(id, 'mark'); return; }
    if (key === 'backspace' || key === 'delete') { event.preventDefault(); toggle(id, 'erase'); return; }
    const n = puzzle.size;
    const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -n, ArrowDown: n }[event.key];
    if (!delta) return;
    event.preventDefault();
    const next = id + delta;
    if (next < 0 || next >= n * n || (Math.abs(delta) === 1 && Math.floor(next / n) !== Math.floor(id / n))) return;
    boardRef.current?.querySelector(`[data-cell="${next}"]`)?.focus();
  }

  const spice = game ? null : loading?.level ?? 1;
  const level = game?.puzzle.peppers ?? LEVELS[spice].peppers;
  const n = puzzle?.size ?? 0;
  const message = !game ? 'Planting today\'s peppers…'
    : won ? `Perfectly planted! ${status.total} peppers, none of them touching.`
    : status.conflicts.size ? 'Two peppers are touching. Peppers can\'t touch, not even at the corners.'
    : [...status.rows, ...status.cols, ...status.patches].includes('over') ? `A row, column or patch has more than ${level} ${level === 1 ? 'pepper' : 'peppers'}.`
    : `Place ${level} ${level === 1 ? 'pepper' : 'peppers'} in every row, column and outlined patch. No two peppers may touch.`;

  return <main className="pp-page">
    <Navbar />
    <header className="pp-heading">
      <p className="pp-eyebrow">STAR BATTLE, SPICED UP</p>
      <h1>Pepper Placer</h1>
      <p>Plant every pepper. Keep them apart.</p>
    </header>
    {game && <DailyResults gameId="pepper-placer" title="Pepper Placer" daily={game.mode === 'daily'} date={date} finished={won} seconds={game.seconds} started={game.started} onLearn={() => setLearning(true)} />}
    <div className="pp-controls">
      <button aria-pressed={!learning && (game?.mode ?? loading?.mode) === 'daily'} onClick={() => changeMode('daily')}>{archive ? 'Archive puzzle' : 'Daily'}</button>
      <button aria-pressed={!learning && (game?.mode ?? loading?.mode) === 'practice'} onClick={() => changeMode('practice')}>Practice</button>
      <button aria-pressed={learning} onClick={() => setLearning(!learning)}>Learn to play</button>
      {!learning && (game?.mode ?? loading?.mode) === 'practice' && <>
        <select aria-label="Practice difficulty" value={practiceLevel} onChange={event => { const next = Number(event.target.value); setPracticeLevel(next); changeMode('practice', next); }}>
          {[1, 2, 3].map(id => <option key={id} value={id}>{LEVELS[id].label}</option>)}
        </select>
        <button onClick={() => changeMode('practice')}>New puzzle</button>
      </>}
    </div>
    {!learning && <p className="pp-date">{(game?.mode ?? loading?.mode) === 'daily' ? `${date} · ${archive ? 'Archive' : 'Daily'}` : 'Practice'} · {level} {level === 1 ? 'pepper' : 'peppers'} per row, column and patch</p>}
    {!learning && !seenTutorial && !won && <WalkthroughPrompt game="Pepper Placer" seenKey={PEPPER_TUTORIAL_KEY} onStart={() => setLearning(true)} onDismiss={() => setSeenTutorial(true)} />}
    {learning ? <PepperTutorial onDone={action => {
      setLearning(false); setSeenTutorial(true);
      if (action === 'practice') { setPracticeLevel(1); changeMode('practice', 1); }
      if (action === 'daily') changeMode('daily');
    }} /> : <>
    <section className="pp-panel" aria-label="Pepper Placer puzzle">
      <div className="pp-progress">
        <span className="pp-goal">{Array.from({ length: level }, (_, i) => <Pepper key={i} className="pp-goal-pepper" />)} <span>× {level} each</span></span>
        <span><strong>{status?.placed ?? 0}</strong> / {status?.total ?? (LEVELS[spice]?.size ?? 0) * level} placed</span>
        <span>{game ? `${Math.floor(game.seconds / 60)}:${String(game.seconds % 60).padStart(2, '0')}` : '0:00'}</span>
      </div>
      {!game ? <div className="pp-loading" role="status"><Pepper className="pp-loading-pepper" />Planting peppers…</div>
        : <div className={`pp-board${won ? ' won' : ''}${tool === 'mark' ? ' marking' : ''}`} ref={boardRef} style={{ '--size': n }} aria-label="Pepper Placer board"
          onContextMenu={event => event.preventDefault()}>
          {puzzle.regions.flatMap((row, r) => row.map((patch, c) => {
            const id = r * n + c;
            const pepper = pepperSet.has(id), mark = markSet.has(id);
            const over = pepper && (status.rows[r] === 'over' || status.cols[c] === 'over' || status.patches[patch] === 'over');
            const edges = [r === 0 || puzzle.regions[r - 1][c] !== patch ? ' t' : '', c === n - 1 || puzzle.regions[r][c + 1] !== patch ? ' r' : '',
              r === n - 1 || puzzle.regions[r + 1][c] !== patch ? ' b' : '', c === 0 || puzzle.regions[r][c - 1] !== patch ? ' l' : ''].join('');
            return <button key={id} type="button" data-cell={id}
              className={`pp-cell${edges}${pepper && status.conflicts.has(id) ? ' conflict' : ''}${over ? ' over' : ''}`}
              style={{ background: PATCH_COLORS[colours.get(patch)] }}
              aria-label={`Row ${r + 1}, column ${c + 1}, patch ${patch + 1}, ${pepper ? 'pepper' : mark ? 'marked empty' : 'empty'}`}
              aria-pressed={pepper}
              onPointerDown={event => pointerDown(event, id)}
              onClick={event => { if (event.detail > 0 && tool === 'mark') return; toggle(id, event.shiftKey ? 'mark' : tool); }}
              onKeyDown={event => handleKey(event, id)}>
              {pepper ? <Pepper /> : mark ? <span className="pp-mark" aria-hidden="true" /> : null}
            </button>;
          }))}
        </div>}
      <div className="pp-controls pp-tools" aria-label="Board tools">
        <button aria-pressed={tool === 'pepper'} onClick={() => setTool('pepper')}><Pepper className="pp-tool-pepper" /> Pepper</button>
        <button aria-pressed={tool === 'mark'} onClick={() => setTool('mark')}>• Mark</button>
        <button aria-pressed={tool === 'erase'} onClick={() => setTool('erase')}>Erase</button>
        <button disabled={!game?.past.length || won} onClick={() => travel('undo')} title="Undo (Ctrl+Z)">↶ Undo</button>
        <button disabled={!game?.future.length || won} onClick={() => travel('redo')} title="Redo (Ctrl+Y)">↷ Redo</button>
        <button disabled={!game || won || (!game.peppers.length && !game.marks.length)} onClick={() => commit([], [])}>Reset</button>
      </div>
      <p className={`pp-message${won ? ' won' : ''}`} role="status">{message}</p>
    </section>
    </>}
    <p className="pp-help">Tap a square to plant a pepper. Use Mark (or right-click and drag) to dot squares that must stay empty.<br />Arrow keys move · P or Space pepper · X mark · Delete erase · Ctrl+Z undo</p>
  </main>;
}
