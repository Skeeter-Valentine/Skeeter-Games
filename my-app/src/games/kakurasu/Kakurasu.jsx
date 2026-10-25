import { useEffect, useMemo, useRef, useState } from 'react';
import Navbar from '../../components/Navbar';
import DailyResults from '../../components/DailyResults';
import useUndoShortcut from '../../components/useUndoShortcut';
import { useDailyDate, useArchive, useGauntlet } from '../../components/DailyBoundary';
import { WalkthroughPrompt, walkthroughSeen } from '../../components/Walkthrough';
import KakurasuTutorial, { KAKURASU_TUTORIAL_KEY } from './KakurasuTutorial';
import { readLocal, writeLocal } from '../../utils/dailyStats.js';
import { puzzleSnapshot } from '../../utils/archive.js';
import { PRACTICE_SIZES, dailyPuzzle, evaluateBoard, generatePuzzle } from './puzzle.js';
import './Kakurasu.css';

// Add ’em Up: the site's Kakurasu. Shade squares so every row and column adds
// up to its clue, counting each shaded square by its position.
export const KAKURASU_TITLE = 'Add ’em Up';
const saveKey = (date, archive) => `${archive ? 'archive:v1:' : ''}kakurasu-daily-v1:${date}`;

export function restoreProgress(puzzle, saved) {
  const empty = { shaded: [], marks: [], seconds: 0, started: false };
  const cells = puzzle.size * puzzle.size;
  const valid = list => Array.isArray(list) && new Set(list).size === list.length
    && list.every(id => Number.isInteger(id) && id >= 0 && id < cells);
  if (!saved || saved.fingerprint !== JSON.stringify(puzzle) || !valid(saved.shaded) || !valid(saved.marks)
    || saved.shaded.some(id => saved.marks.includes(id))) return empty;
  return { shaded: saved.shaded, marks: saved.marks,
    seconds: Number.isInteger(saved.seconds) && saved.seconds >= 0 ? saved.seconds : 0,
    started: !!saved.started || saved.shaded.length > 0 || saved.marks.length > 0 };
}

function newGame(date, mode = 'daily', size = 6, archive = false) {
  const puzzle = mode === 'daily' ? puzzleSnapshot('kakurasu', date, () => dailyPuzzle(date)) : generatePuzzle(size, `practice:${Math.random()}`);
  const progress = restoreProgress(puzzle, mode === 'daily' ? readLocal(saveKey(date, archive), null) : null);
  return { puzzle, mode, ...progress, past: [], future: [] };
}

export default function Kakurasu({ onWin }) {
  const date = useDailyDate();
  const archive = !!useArchive()?.archive;
  const [game, setGame] = useState(() => newGame(date, 'daily', 6, archive));
  const [tool, setTool] = useState('shade');
  const [practiceSize, setPracticeSize] = useState(6);
  // "Learn to play" walkthrough (never inside the Skeeter Gauntlet).
  const inGauntlet = !!useGauntlet();
  const [learning, setLearning] = useState(false);
  const [seenTutorial, setSeenTutorial] = useState(() => walkthroughSeen(KAKURASU_TUTORIAL_KEY));
  const boardRef = useRef(null);
  const drag = useRef(null);
  const notified = useRef(false);
  const { puzzle, shaded, marks } = game;
  const { size } = puzzle;
  const status = useMemo(() => evaluateBoard(puzzle, shaded), [puzzle, shaded]);
  const { won, sums } = status;

  useEffect(() => {
    if (!game.started || won || learning) return;
    const timer = setInterval(() => setGame(current => ({ ...current, seconds: current.seconds + 1 })), 1000);
    return () => clearInterval(timer);
  }, [game.started, won, learning]);

  useEffect(() => {
    if (game.mode === 'daily') writeLocal(saveKey(date, archive), {
      fingerprint: JSON.stringify(puzzle), shaded, marks, seconds: game.seconds, started: game.started,
    });
  }, [date, archive, game.mode, game.seconds, game.started, puzzle, shaded, marks]);

  useEffect(() => {
    if (won && game.started && !notified.current) { notified.current = true; onWin?.(); }
  }, [won, game.started, onWin]);

  function changeMode(mode, nextSize = practiceSize) {
    setLearning(false);
    notified.current = false;
    setGame(newGame(date, mode, nextSize, archive));
    setTool('shade');
  }

  // A square's new state for a tool: tapping a square that already has the
  // tool's state clears it.
  const stateOf = id => shaded.includes(id) ? 'shade' : marks.includes(id) ? 'mark' : 'erase';
  function paint(id, value) {
    setGame(current => {
      const now = current.shaded.includes(id) ? 'shade' : current.marks.includes(id) ? 'mark' : 'erase';
      if (now === value) return current;
      const nextShaded = current.shaded.filter(cell => cell !== id), nextMarks = current.marks.filter(cell => cell !== id);
      if (value === 'shade') nextShaded.push(id);
      if (value === 'mark') nextMarks.push(id);
      return { ...current, shaded: nextShaded, marks: nextMarks, started: true };
    });
  }
  // One press (or one drag across several squares) is one Undo step.
  function startPaint(id, selectedTool) {
    if (won) return;
    const value = selectedTool !== 'erase' && stateOf(id) === selectedTool ? 'erase' : selectedTool;
    drag.current = { value, before: { shaded, marks } };
    setGame(current => ({ ...current, past: [...current.past, { shaded: current.shaded, marks: current.marks }], future: [] }));
    paint(id, value);
  }
  useEffect(() => {
    const stop = () => {
      const current = drag.current;
      drag.current = null;
      if (!current) return;
      // Nothing changed: drop the Undo step that the press added.
      setGame(state => state.shaded === current.before.shaded && state.marks === current.before.marks
        ? { ...state, past: state.past.slice(0, -1) } : state);
    };
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    return () => { window.removeEventListener('pointerup', stop); window.removeEventListener('pointercancel', stop); };
  }, []);

  function travel(direction) {
    setGame(current => {
      const from = direction === 'undo' ? 'past' : 'future';
      const to = direction === 'undo' ? 'future' : 'past';
      if (!current[from].length || won) return current;
      return { ...current, ...current[from].at(-1), [from]: current[from].slice(0, -1),
        [to]: [...current[to], { shaded: current.shaded, marks: current.marks }] };
    });
  }
  useUndoShortcut(() => travel('undo'), () => travel('redo'));

  function reset() {
    setGame(current => ({ ...current, shaded: [], marks: [],
      past: [...current.past, { shaded: current.shaded, marks: current.marks }], future: [] }));
  }

  function handleKey(event, id) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key.toLowerCase();
    const keyTool = { ' ': tool, enter: tool, s: 'shade', x: 'mark', backspace: 'erase', delete: 'erase' }[key];
    if (keyTool) {
      event.preventDefault();
      startPaint(id, keyTool);
      window.dispatchEvent(new Event('pointerup'));
      return;
    }
    const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -size, ArrowDown: size }[event.key];
    if (!delta) return;
    event.preventDefault();
    const next = id + delta;
    if (next < 0 || next >= size * size || (Math.abs(delta) === 1 && Math.floor(next / size) !== Math.floor(id / size))) return;
    boardRef.current?.querySelector(`[data-cell="${next}"]`)?.focus();
  }

  const clueClass = (state) => `kk-clue${state ? ` ${state}` : ''}`;
  const over = [...status.rows, ...status.cols].includes('over');

  return <main className="kk-page">
    <Navbar />
    <header className="kk-heading"><p className="kk-eyebrow">KAKURASU</p><h1>{KAKURASU_TITLE}</h1><p>Every square counts. Some count more.</p></header>
    <DailyResults gameId="kakurasu" title={KAKURASU_TITLE} daily={game.mode === 'daily'} date={date} finished={won} seconds={game.seconds} started={game.started} onLearn={() => setLearning(true)} />
    <div className="kk-controls">
      <button aria-pressed={!learning && game.mode === 'daily'} onClick={() => changeMode('daily')}>{archive ? 'Archive puzzle' : 'Daily'}</button>
      <button aria-pressed={!learning && game.mode === 'practice'} onClick={() => changeMode('practice')}>Practice</button>
      {!inGauntlet && <button aria-pressed={learning} onClick={() => setLearning(!learning)}>Learn to play</button>}
      {!learning && game.mode === 'practice' && <>
        <select aria-label="Practice board size" value={practiceSize} onChange={event => { const next = Number(event.target.value); setPracticeSize(next); changeMode('practice', next); }}>
          {PRACTICE_SIZES.map(n => <option key={n} value={n}>{n} × {n}</option>)}
        </select>
        <button onClick={() => changeMode('practice')}>New puzzle</button>
      </>}
    </div>
    {!learning && !seenTutorial && !inGauntlet && !won && <WalkthroughPrompt game={KAKURASU_TITLE} seenKey={KAKURASU_TUTORIAL_KEY} onStart={() => setLearning(true)} onDismiss={() => setSeenTutorial(true)} />}
    {learning ? <KakurasuTutorial onDone={action => {
      setLearning(false); setSeenTutorial(true);
      if (action === 'practice') { setPracticeSize(4); changeMode('practice', 4); }
      if (action === 'daily') changeMode('daily');
    }} /> : <>
    <p className="kk-date">{game.mode === 'daily' ? `${date} · ${archive ? 'Archive' : 'Daily'}` : 'Practice'} · {size} × {size}</p>
    <section className="kk-panel" aria-label={`${KAKURASU_TITLE} puzzle`}>
      <div className="kk-progress"><span><strong>{[...status.rows, ...status.cols].filter(state => state === 'met').length}</strong> / {size * 2} lines added up</span><span className="fixed-time">{Math.floor(game.seconds / 60)}:{String(game.seconds % 60).padStart(2, '0')}</span></div>
      <div className="kk-board" ref={boardRef} style={{ '--size': size }} aria-label={`${size} by ${size} Kakurasu board`}
        onContextMenu={event => event.preventDefault()}>
        <span className="kk-corner" aria-hidden="true" />
        {Array.from({ length: size }, (_, c) => <span key={`h${c}`} className="kk-index" aria-hidden="true">{c + 1}</span>)}
        <span className="kk-corner" aria-hidden="true" />
        {Array.from({ length: size }, (_, r) => <div key={r} className="kk-row" style={{ display: 'contents' }}>
          <span className="kk-index" aria-hidden="true">{r + 1}</span>
          {Array.from({ length: size }, (_, c) => {
            const id = r * size + c, on = shaded.includes(id), mark = marks.includes(id);
            return <button key={id} type="button" data-cell={id} className={`kk-cell${on ? ' shaded' : ''}${mark ? ' marked' : ''}`}
              aria-label={`Row ${r + 1}, column ${c + 1}, ${on ? 'shaded' : mark ? 'marked empty' : 'empty'}`} aria-pressed={on}
              onPointerDown={event => {
                event.currentTarget.releasePointerCapture?.(event.pointerId);
                startPaint(id, event.button === 2 ? 'mark' : event.shiftKey ? 'mark' : tool);
              }}
              onPointerEnter={() => { if (drag.current) paint(id, drag.current.value); }}
              onKeyDown={event => handleKey(event, id)}>
              {mark ? <span aria-hidden="true">×</span> : null}
            </button>;
          })}
          <span className={clueClass(status.rows[r])} aria-label={`Row ${r + 1} needs ${puzzle.rows[r]}, has ${sums.rows[r]}`}>{puzzle.rows[r]}</span>
        </div>)}
        <span className="kk-corner" aria-hidden="true" />
        {Array.from({ length: size }, (_, c) => <span key={`c${c}`} className={clueClass(status.cols[c])}
          aria-label={`Column ${c + 1} needs ${puzzle.cols[c]}, has ${sums.cols[c]}`}>{puzzle.cols[c]}</span>)}
        <span className="kk-corner" aria-hidden="true" />
      </div>
      <div className="kk-controls kk-tools" aria-label="Board tools">
        <button aria-pressed={tool === 'shade'} onClick={() => setTool('shade')}>Shade</button>
        <button aria-pressed={tool === 'mark'} onClick={() => setTool('mark')}>Mark ×</button>
        <button aria-pressed={tool === 'erase'} onClick={() => setTool('erase')}>Erase</button>
        <button disabled={won || !game.past.length} onClick={() => travel('undo')}>Undo</button>
        <button disabled={won || !game.future.length} onClick={() => travel('redo')}>Redo</button>
        <button disabled={won || (!shaded.length && !marks.length)} onClick={reset}>Reset</button>
      </div>
      <p className={`kk-message${won ? ' won' : ''}`} role="status">{won ? 'Perfect! Every row and column adds up.'
        : over ? 'A pink clue has gone over: its shaded squares add up to more than the clue.'
          : 'Each shaded square counts its column number across a row, and its row number down a column.'}</p>
    </section>
    <p className="kk-help">Tap or drag to shade squares. Use Mark × for squares you know stay empty, or right-click.<br />Arrow keys move · S shade · X mark · Delete erase</p>
    </>}
  </main>;
}
