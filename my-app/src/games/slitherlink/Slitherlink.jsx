import { useEffect, useMemo, useRef, useState } from 'react';
import Navbar from '../../components/Navbar';
import DailyResults from '../../components/DailyResults';
import useUndoShortcut from '../../components/useUndoShortcut';
import { useDailyDate, useArchive, useGauntlet } from '../../components/DailyBoundary';
import { WalkthroughPrompt, walkthroughSeen } from '../../components/Walkthrough';
import SlitherlinkTutorial, { SLITHERLINK_TUTORIAL_KEY } from './SlitherlinkTutorial';
import SlitherBoard from './SlitherBoard';
import { readLocal, writeLocal } from '../../utils/dailyStats.js';
import { puzzleSnapshot } from '../../utils/archive.js';
import { PRACTICE_SIZES, dailyPuzzle, evaluateBoard, generatePuzzle, geometry } from './puzzle.js';
import './Slitherlink.css';

// Skeeterlink: the site's Slitherlink. Draw one loop along the dotted grid;
// each number counts how many of its square's sides the loop uses.
export const SLITHERLINK_TITLE = 'Skeeterlink';
const saveKey = (date, archive) => `${archive ? 'archive:v1:' : ''}slitherlink-daily-v1:${date}`;
const fingerprint = puzzle => JSON.stringify([puzzle.rows, puzzle.cols, puzzle.clues]);

export function restoreProgress(puzzle, saved) {
  const empty = { lines: [], crosses: [], seconds: 0, started: false };
  const edges = geometry(puzzle.rows, puzzle.cols).E;
  const valid = list => Array.isArray(list) && new Set(list).size === list.length
    && list.every(id => Number.isInteger(id) && id >= 0 && id < edges);
  if (!saved || saved.fingerprint !== fingerprint(puzzle) || !valid(saved.lines) || !valid(saved.crosses)
    || saved.lines.some(id => saved.crosses.includes(id))) return empty;
  return { lines: saved.lines, crosses: saved.crosses,
    seconds: Number.isInteger(saved.seconds) && saved.seconds >= 0 ? saved.seconds : 0,
    started: !!saved.started || saved.lines.length > 0 || saved.crosses.length > 0 };
}

function newGame(date, mode = 'daily', size = 6, archive = false) {
  const puzzle = mode === 'daily'
    ? puzzleSnapshot('slitherlink', date, () => { const { rows, cols, clues } = dailyPuzzle(date); return { rows, cols, clues }; })
    : generatePuzzle(size, size, `practice:${Math.random()}`, size >= 8 ? 2 : 1);
  const progress = restoreProgress(puzzle, mode === 'daily' ? readLocal(saveKey(date, archive), null) : null);
  return { puzzle, mode, ...progress, past: [], future: [] };
}

export default function Slitherlink({ onWin }) {
  const date = useDailyDate();
  const archive = !!useArchive()?.archive;
  const [game, setGame] = useState(() => newGame(date, 'daily', 6, archive));
  const [tool, setTool] = useState('line');
  const [practiceSize, setPracticeSize] = useState(6);
  const inGauntlet = !!useGauntlet();
  const [learning, setLearning] = useState(false);
  const [seenTutorial, setSeenTutorial] = useState(() => walkthroughSeen(SLITHERLINK_TUTORIAL_KEY));
  const drag = useRef(null);
  const notified = useRef(false);
  const { puzzle, lines, crosses } = game;
  const status = useMemo(() => evaluateBoard(puzzle, lines, crosses), [puzzle, lines, crosses]);
  const { won } = status;
  const clueCount = puzzle.clues.filter(clue => clue >= 0).length;
  const metCount = status.clueState.filter(state => state === 'met').length;

  useEffect(() => {
    if (!game.started || won || learning) return;
    const timer = setInterval(() => setGame(current => ({ ...current, seconds: current.seconds + 1 })), 1000);
    return () => clearInterval(timer);
  }, [game.started, won, learning]);

  useEffect(() => {
    if (game.mode === 'daily') writeLocal(saveKey(date, archive), {
      fingerprint: fingerprint(puzzle), lines, crosses, seconds: game.seconds, started: game.started,
    });
  }, [date, archive, game.mode, game.seconds, game.started, puzzle, lines, crosses]);

  useEffect(() => {
    if (won && game.started && !notified.current) { notified.current = true; onWin?.(); }
  }, [won, game.started, onWin]);

  function changeMode(mode, nextSize = practiceSize) {
    setLearning(false);
    notified.current = false;
    setGame(newGame(date, mode, nextSize, archive));
  }

  // An edge's state: 'line', 'cross' or 'erase' (empty).
  function paint(edge, value) {
    setGame(current => {
      const now = current.lines.includes(edge) ? 'line' : current.crosses.includes(edge) ? 'cross' : 'erase';
      if (now === value) return current;
      const nextLines = current.lines.filter(e => e !== edge), nextCrosses = current.crosses.filter(e => e !== edge);
      if (value === 'line') nextLines.push(edge);
      if (value === 'cross') nextCrosses.push(edge);
      return { ...current, lines: nextLines, crosses: nextCrosses, started: true };
    });
  }
  // A press picks what the drag paints: the tool, or clearing if the first
  // edge already had it. One press or drag is one Undo step.
  function press(edge, event) {
    if (won) return;
    const selected = event.button === 2 || event.shiftKey ? 'cross' : tool;
    const now = lines.includes(edge) ? 'line' : crosses.includes(edge) ? 'cross' : 'erase';
    const value = selected !== 'erase' && now === selected ? 'erase' : selected;
    drag.current = { value, before: { lines, crosses } };
    setGame(current => ({ ...current, past: [...current.past, { lines: current.lines, crosses: current.crosses }], future: [] }));
    paint(edge, value);
  }
  useEffect(() => {
    const stop = () => {
      const current = drag.current;
      drag.current = null;
      if (!current) return;
      setGame(state => state.lines === current.before.lines && state.crosses === current.before.crosses
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
        [to]: [...current[to], { lines: current.lines, crosses: current.crosses }] };
    });
  }
  useUndoShortcut(() => travel('undo'), () => travel('redo'));

  function reset() {
    setGame(current => ({ ...current, lines: [], crosses: [],
      past: [...current.past, { lines: current.lines, crosses: current.crosses }], future: [] }));
  }

  const over = status.clueState.includes('over');
  const message = won ? 'Loop closed! Every number is satisfied.'
    : status.branches.length ? 'A dot has more than two lines (shown in pink). The loop can\'t branch or cross itself.'
      : over ? 'A pink number has too many lines around it.'
        : 'Draw one loop. Each number counts the sides of its square that the loop uses.';

  return <main className="sl-page">
    <Navbar />
    <header className="sl-heading"><p className="sl-eyebrow">SLITHERLINK</p><h1>{SLITHERLINK_TITLE}</h1><p>One loop. Every number counts.</p></header>
    <DailyResults gameId="slitherlink" title={SLITHERLINK_TITLE} daily={game.mode === 'daily'} date={date} finished={won} seconds={game.seconds} started={game.started} onLearn={() => setLearning(true)} />
    <div className="sl-controls">
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
    {!learning && !seenTutorial && !inGauntlet && !won && <WalkthroughPrompt game={SLITHERLINK_TITLE} seenKey={SLITHERLINK_TUTORIAL_KEY} onStart={() => setLearning(true)} onDismiss={() => setSeenTutorial(true)} />}
    {learning ? <SlitherlinkTutorial onDone={action => {
      setLearning(false); setSeenTutorial(true);
      if (action === 'practice') { setPracticeSize(5); changeMode('practice', 5); }
      if (action === 'daily') changeMode('daily');
    }} /> : <>
    <p className="sl-date">{game.mode === 'daily' ? `${date} · ${archive ? 'Archive' : 'Daily'}` : 'Practice'} · {puzzle.rows} × {puzzle.cols}</p>
    <section className="sl-panel" aria-label={`${SLITHERLINK_TITLE} puzzle`}>
      <div className="sl-progress"><span><strong>{metCount}</strong> / {clueCount} numbers satisfied</span><span className="fixed-time">{Math.floor(game.seconds / 60)}:{String(game.seconds % 60).padStart(2, '0')}</span></div>
      <SlitherBoard puzzle={puzzle} lines={lines} crosses={crosses} clueState={status.clueState} branches={status.branches} won={won}
        disabled={won} onPress={press} onDrag={edge => { if (drag.current) paint(edge, drag.current.value); }}
        label={`${puzzle.rows} by ${puzzle.cols} Slitherlink board with ${lines.length} lines drawn`} />
      <div className="sl-controls sl-tools" aria-label="Board tools">
        <button aria-pressed={tool === 'line'} onClick={() => setTool('line')}>Line</button>
        <button aria-pressed={tool === 'cross'} onClick={() => setTool('cross')}>Cross ×</button>
        <button aria-pressed={tool === 'erase'} onClick={() => setTool('erase')}>Erase</button>
        <button disabled={won || !game.past.length} onClick={() => travel('undo')}>Undo</button>
        <button disabled={won || !game.future.length} onClick={() => travel('redo')}>Redo</button>
        <button disabled={won || (!lines.length && !crosses.length)} onClick={reset}>Reset</button>
      </div>
      <p className={`sl-message${won ? ' won' : ''}`} role="status">{message}</p>
    </section>
    <p className="sl-help">Tap a side between two dots to draw a line, or drag along the grid to draw several.<br />Cross × marks sides you know the loop skips (right-click also crosses). Tap a line again to clear it.</p>
    </>}
  </main>;
}
