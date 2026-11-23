import { useEffect, useMemo, useRef, useState } from 'react';
import Navbar from '../../components/Navbar';
import DailyResults from '../../components/DailyResults';
import { useDailyDate, useArchive, useGauntlet } from '../../components/DailyBoundary';
import { useClockRunning } from '../../components/useDailyClock';
import { readLocal, writeLocal } from '../../utils/dailyStats.js';
import ChessBoard, { PROMOTION_GLYPHS } from './ChessBoard';
import { colorOf, findUci, gameEnd, inCheck, kingSquare, legalMoves, makeMove, parseFen, san, toFen, uci } from './engine.js';
import { dailyLevel, dailyPuzzle, judgeMove, levelOf, loadChessPuzzles, playerColor, practicePuzzle } from './puzzles.js';
import { barShare, formatScore, STOCKFISH_SOURCE, verdict } from './stockfish.js';
import useStockfish from './useStockfish.js';
import './Chess.css';

// Skeetmate: a daily chess puzzle. The opponent has just moved; find the best
// reply, then keep finding the best moves until the puzzle is done. A wrong
// move doesn't end it (try again), but it's counted.
//
// Once it's over (solved or solution shown) there's a review: step back and
// forth through the moves, try other moves from any position, and switch on
// Analysis to have Stockfish evaluate whatever is on the board.
export const CHESS_TITLE = 'Skeetmate';
const LEVEL_NAMES = ['Mild', 'Medium', 'Picante'];
const saveKey = (date, archive) => `${archive ? 'archive:v1:' : ''}chess-daily-v1:${date}`;
const OPPONENT_DELAY = 550;

// `played` lists the moves on the board (UCI): the solution's, except that a
// different checkmate also finishes it. It must replay legally.
export function replay(puzzle, played) {
  const positions = [parseFen(puzzle.fen)];
  const moves = [];
  for (const text of played) {
    const move = findUci(positions.at(-1), text);
    if (!move) return null;
    moves.push(move);
    positions.push(makeMove(positions.at(-1), move));
  }
  return { positions, moves };
}

// "12. Qxf7+" or "12… Kxf7": a move with its number, for labels.
export function moveLabel(pos, move) {
  return `${pos.full}${pos.turn === 'w' ? '.' : '…'} ${san(pos, move)}`;
}

// An engine line (UCI moves) as numbered SAN, up to `max` moves.
export function lineText(pos, pv, max = 8) {
  const words = [];
  let at = pos;
  for (const text of pv.slice(0, max)) {
    const move = findUci(at, text);
    if (!move) break;
    words.push(at.turn === 'w' || !words.length ? moveLabel(at, move) : san(at, move));
    at = makeMove(at, move);
  }
  return words.join(' ');
}

export function restoreProgress(puzzle, saved) {
  const fresh = { played: [], mistakes: 0, hints: 0, seconds: 0, started: false, gaveUp: false };
  if (!saved || saved.id !== puzzle.id || !Array.isArray(saved.played) || saved.played.length > puzzle.moves.length
    || !replay(puzzle, saved.played)) return fresh;
  const int = (value, max) => Number.isInteger(value) && value >= 0 && value <= max ? value : 0;
  return { played: saved.played, mistakes: int(saved.mistakes, 999), hints: int(saved.hints, 999),
    seconds: int(saved.seconds, 86400 * 7), started: !!saved.started, gaveUp: !!saved.gaveUp };
}

function newGame(date, mode, level, archive, avoidId) {
  const puzzle = mode === 'daily' ? dailyPuzzle(date) : practicePuzzle(level, avoidId);
  const progress = restoreProgress(puzzle, mode === 'daily' ? readLocal(saveKey(date, archive), null) : null);
  return { puzzle, mode, ...progress };
}

// The puzzles are downloaded (see puzzles.js): show the game once the day's
// puzzle is in, and offer a retry if it couldn't load.
export default function Chess(props) {
  const date = useDailyDate();
  const [loaded, setLoaded] = useState({ date: null, error: false });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    loadChessPuzzles(date)
      .then(() => { if (active) setLoaded({ date, error: false }); })
      .catch(() => { if (active) setLoaded({ date: null, error: true }); });
    return () => { active = false; };
  }, [date, attempt]);
  if (loaded.date === date) return <ChessGame key={date} {...props} />;
  return <main className="ch-page">
    <Navbar />
    <header className="ch-heading"><p className="ch-eyebrow">CHESS PUZZLE</p><h1>{CHESS_TITLE}</h1><p>Find the best move.</p></header>
    {loaded.error
      ? <p className="ch-loading" role="alert">Couldn't load today's puzzle. Check your connection and{' '}
        <button type="button" onClick={() => { setLoaded({ date: null, error: false }); setAttempt(count => count + 1); }}>try again</button>.</p>
      : <p className="ch-loading" role="status">Loading the puzzle…</p>}
  </main>;
}

function ChessGame({ onWin }) {
  const date = useDailyDate();
  const archive = !!useArchive()?.archive;
  const inGauntlet = !!useGauntlet();
  const [practiceLevel, setPracticeLevel] = useState(1);
  const [game, setGame] = useState(() => newGame(date, 'daily', 1, archive));
  const [selected, setSelected] = useState(null);
  const [promotion, setPromotion] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [hintSquare, setHintSquare] = useState(null);
  const [drawMode, setDrawMode] = useState(false);
  // The review: which position is shown (null: the last), moves tried from
  // there, and whether Stockfish is on.
  const [cursor, setCursor] = useState(null);
  const [variation, setVariation] = useState([]);
  const [analysis, setAnalysis] = useState(false);
  const notified = useRef(false);
  const { puzzle, played } = game;
  const { positions, moves: playedMoves } = useMemo(() => replay(puzzle, played), [puzzle, played]);
  const step = played.length;
  const total = puzzle.moves.length;
  // Done when the line is played out, or a move ends the game (another mate).
  const finished = step >= total || (step > 1 && gameEnd(positions.at(-1)) === 'checkmate');
  const solved = finished && !game.gaveUp;
  const pos = positions.at(-1);
  const me = playerColor(puzzle);
  const myTurn = !finished && step % 2 === 1 && pos.turn === me;
  const level = game.mode === 'daily' ? dailyLevel(date) : levelOf(puzzle.rating);

  // What's on the board: the puzzle as it stands, or in the review the chosen
  // position plus any moves tried from it.
  const lastIndex = positions.length - 1;
  const base = finished ? Math.min(cursor ?? lastIndex, lastIndex) : lastIndex;
  const line = useMemo(() => {
    const list = [positions[base]];
    for (const move of variation) list.push(makeMove(list.at(-1), move));
    return list;
  }, [positions, base, variation]);
  const shown = line.at(-1);
  const shownEnd = useMemo(() => gameEnd(shown), [shown]);
  const side = finished ? shown.turn : me;
  const canMove = finished ? !shownEnd : myTurn;
  const fen = useMemo(() => toFen(shown), [shown]);
  const engine = useStockfish(fen, finished && analysis && !shownEnd);

  // The opponent's moves play themselves after a short pause.
  useEffect(() => {
    if (finished || step % 2 === 1) return undefined;
    const timer = setTimeout(() => setGame(current => current.played.length === step
      ? { ...current, played: [...current.played, current.puzzle.moves[step]] } : current), OPPONENT_DELAY);
    return () => clearTimeout(timer);
  }, [step, finished]);

  const clockOn = useClockRunning({ daily: game.mode === 'daily', moved: game.started, done: finished, promptOpen: false });
  useEffect(() => {
    if (!clockOn) return undefined;
    const timer = setInterval(() => setGame(current => ({ ...current, seconds: current.seconds + 1 })), 1000);
    return () => clearInterval(timer);
  }, [clockOn]);

  useEffect(() => {
    if (game.mode !== 'daily') return;
    writeLocal(saveKey(date, archive), { id: puzzle.id, played, mistakes: game.mistakes, hints: game.hints,
      seconds: game.seconds, started: game.started, gaveUp: game.gaveUp });
  }, [date, archive, game.mode, puzzle.id, played, game.mistakes, game.hints, game.seconds, game.started, game.gaveUp]);

  useEffect(() => {
    if (solved && game.started && !notified.current) { notified.current = true; onWin?.(); }
  }, [solved, game.started, onWin]);

  const moves = useMemo(() => (canMove ? legalMoves(shown) : []), [shown, canMove]);
  const lastMove = variation.length ? variation.at(-1) : base > 0 ? playedMoves[base - 1] : null;
  const history = useMemo(() => playedMoves.map((move, i) => san(positions[i], move)), [playedMoves, positions]);
  const tried = useMemo(() => variation.map((move, i) => (i === 0 || line[i].turn === 'w' ? moveLabel(line[i], move) : san(line[i], move))),
    [variation, line]);
  const targets = selected === null ? [] : [...new Set(moves.filter(m => m.from === selected).map(m => m.to))];
  function changeMode(mode, nextLevel = practiceLevel) {
    notified.current = false;
    setSelected(null); setPromotion(null); setFeedback(null); setHintSquare(null);
    setCursor(null); setVariation([]); setAnalysis(false);
    setGame(current => newGame(date, mode, nextLevel, archive, current.puzzle.id));
  }

  function attempt(move) {
    setSelected(null); setPromotion(null); setHintSquare(null);
    if (finished) { setVariation(current => [...current, move]); return; }
    if (judgeMove(puzzle, step, pos, move)) {
      setFeedback({ kind: 'good', text: 'Best move! Keep going.' });
      setGame(current => ({ ...current, played: [...current.played, uci(move)], started: true }));
    } else {
      setFeedback({ kind: 'bad', text: 'Not the best move. Try again.', square: move.to });
      setGame(current => ({ ...current, mistakes: current.mistakes + 1, started: true }));
    }
  }

  function tryMove(from, to) {
    const options = moves.filter(m => m.from === from && m.to === to);
    if (!options.length) return false;
    if (options.length > 1) { setPromotion({ from, to, options }); return true; }
    attempt(options[0]);
    return true;
  }

  function onSquare(sq) {
    if (!canMove || promotion) return;
    if (selected !== null && sq !== selected && tryMove(selected, sq)) return;
    setSelected(shown.board[sq] && colorOf(shown.board[sq]) === side && sq !== selected ? sq : null);
  }

  // Stepping through the review.
  function goTo(index) {
    setSelected(null); setPromotion(null);
    setVariation([]);
    setCursor(Math.max(0, Math.min(lastIndex, index)));
  }
  const atStart = base === 0 && !variation.length;
  const atEnd = base === lastIndex && !variation.length;
  function back() {
    if (variation.length) { setSelected(null); setPromotion(null); setVariation(current => current.slice(0, -1)); } else goTo(base - 1);
  }
  function forward() { if (variation.length) goTo(base); else goTo(base + 1); }
  // ← and → step through the review (re-attached each render, so it always
  // sees the current position).
  useEffect(() => {
    if (!finished) return undefined;
    const onKey = event => {
      if (event.target.closest?.('input, select, textarea') || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === 'ArrowLeft' && !atStart) { event.preventDefault(); back(); }
      if (event.key === 'ArrowRight' && !atEnd) { event.preventDefault(); forward(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  function playEngineMove(text) {
    const move = findUci(shown, text);
    if (move) attempt(move);
  }

  function hint() {
    if (!myTurn) return;
    const from = puzzle.moves[step].slice(0, 2);
    setHintSquare((8 - Number(from[1])) * 8 + 'abcdefgh'.indexOf(from[0]));
    setGame(current => ({ ...current, hints: current.hints + 1, started: true }));
  }

  function giveUp() {
    setSelected(null); setPromotion(null); setHintSquare(null);
    setFeedback({ kind: 'bad', text: 'Here is the solution.' });
    setGame(current => ({ ...current, played: current.puzzle.moves, gaveUp: true, started: true }));
  }

  const check = inCheck(shown) ? kingSquare(shown.board, shown.turn) : null;
  const sideName = me === 'w' ? 'White' : 'Black';
  const status = solved ? `Solved${game.mistakes ? ` with ${game.mistakes} wrong ${game.mistakes === 1 ? 'move' : 'moves'}` : ' cleanly'}!`
    : game.gaveUp ? 'Solution shown.'
      : !myTurn ? 'Your opponent is moving…'
        : feedback?.text ?? `${sideName} to move. Find the best move.`;

  // Engine read-outs. A finished game on the board is scored directly.
  const best = engine?.lines[0] ?? null;
  const bestMove = best && findUci(shown, best.pv[0]);
  const engineArrows = bestMove ? [{ from: bestMove.from, to: bestMove.to }] : [];
  const shownScore = shownEnd === 'checkmate' ? { mate: shown.turn === 'w' ? -1 : 1 } : shownEnd ? { cp: 0 } : engine?.score;
  const whiteShare = barShare(shownScore);
  const engineNote = shownEnd === 'checkmate' ? 'Checkmate' : shownEnd ? 'Stalemate' : !engine ? ''
    : engine.status === 'error' ? 'Stockfish couldn\'t load. Check your connection and switch Analysis on again.'
      : engine.status === 'loading' ? 'Loading Stockfish…'
        : `Depth ${engine.depth}${engine.status === 'done' ? '' : '…'}`;
  const placeLabel = variation.length ? `Your line, ${tried.length} ${tried.length === 1 ? 'move' : 'moves'} in`
    : base === 0 ? 'Start of the puzzle' : `After ${moveLabel(positions[base - 1], playedMoves[base - 1])}`;

  return <main className="ch-page">
    <Navbar />
    <header className="ch-heading"><p className="ch-eyebrow">CHESS PUZZLE</p><h1>{CHESS_TITLE}</h1><p>Find the best move.</p></header>
    <DailyResults gameId="chess" title={CHESS_TITLE} daily={game.mode === 'daily'} date={date} finished={finished} won={solved}
      seconds={game.seconds} started={game.started} hints={game.hints} assists={game.mistakes} />
    {!inGauntlet && <div className="ch-controls">
      <button aria-pressed={game.mode === 'daily'} onClick={() => changeMode('daily')}>{archive ? 'Archive puzzle' : 'Daily'}</button>
      <button aria-pressed={game.mode === 'practice'} onClick={() => changeMode('practice')}>Practice</button>
      {game.mode === 'practice' && <>
        <select aria-label="Practice difficulty" value={practiceLevel} onChange={event => { const next = Number(event.target.value); setPracticeLevel(next); changeMode('practice', next); }}>
          {LEVEL_NAMES.map((name, i) => <option key={name} value={i + 1}>{name}</option>)}
        </select>
        <button onClick={() => changeMode('practice')}>New puzzle</button>
      </>}
    </div>}
    <p className="ch-date">{game.mode === 'daily' ? `${date} · ${archive ? 'Archive' : 'Daily'}` : 'Practice'} · {LEVEL_NAMES[level - 1]} · you play {sideName}</p>
    <section className="ch-panel" aria-label={`${CHESS_TITLE} puzzle`}>
      <div className="ch-progress">
        <span>Move <strong>{finished ? total / 2 : Math.max(1, Math.ceil(step / 2))}</strong> of {total / 2}{game.mistakes ? ` · ${game.mistakes} wrong` : ''}</span>
        <span className="fixed-time">{Math.floor(game.seconds / 60)}:{String(game.seconds % 60).padStart(2, '0')}</span>
      </div>
      <div className={`ch-board-row${finished && analysis ? ' with-eval' : ''}`}>
      {finished && analysis && <div className={`ch-eval${me === 'b' ? ' flipped' : ''}`} role="img"
        aria-label={`Evaluation: ${shownEnd ? engineNote : formatScore(shownScore) || 'thinking'}`}>
        <div className="ch-eval-white" style={{ height: `${whiteShare * 100}%` }} />
      </div>}
      <div className="ch-board-wrap">
        <ChessBoard board={shown.board} flipped={me === 'b'} selected={selected} targets={targets} lastMove={lastMove}
          checkSquare={check} hintSquare={hintSquare} wrongSquare={feedback?.kind === 'bad' && !finished ? feedback.square : null}
          disabled={!canMove} drawMode={drawMode} arrows={finished && analysis ? engineArrows : []}
          movable={sq => shown.board[sq] && colorOf(shown.board[sq]) === side}
          onSquare={onSquare} onPick={sq => { if (myTurn && !promotion) setSelected(sq); }}
          onDrop={(from, to) => { if (!tryMove(from, to)) setSelected(null); }} />
        {promotion && <div className="ch-promotion" role="dialog" aria-label="Promote to">
          {promotion.options.map(option => <button key={option.promotion} type="button" onClick={() => attempt(option)}
            aria-label={`Promote to ${{ q: 'queen', r: 'rook', b: 'bishop', n: 'knight' }[option.promotion]}`}>
            <span className={`ch-piece ${side === 'w' ? 'white' : 'black'}`}>{PROMOTION_GLYPHS[option.promotion]}{'︎'}</span>
          </button>)}
        </div>}
      </div>
      </div>
      <p className={`ch-message${solved ? ' won' : feedback?.kind === 'bad' && !finished ? ' bad' : ''}`} role="status">{status}</p>
      {finished && <div className="ch-step" role="group" aria-label="Step through the moves">
        <button type="button" onClick={() => goTo(0)} disabled={atStart} aria-label="First position" title="First position">«</button>
        <button type="button" onClick={back} disabled={atStart} aria-label="Back one move" title="Back (←)">‹</button>
        <span className="ch-step-place" aria-live="polite">{placeLabel}</span>
        <button type="button" onClick={forward} disabled={atEnd} aria-label={variation.length ? 'Back to the puzzle line' : 'Forward one move'} title="Forward (→)">›</button>
        <button type="button" onClick={() => goTo(lastIndex)} disabled={atEnd} aria-label="Last position" title="Last position">»</button>
      </div>}
      <div className="ch-controls ch-tools">
        <button aria-pressed={drawMode} onClick={() => setDrawMode(!drawMode)}
          title="Draw arrows and circles to plan (or right-click and drag on the board)">Draw</button>
        {finished ? <button aria-pressed={analysis} onClick={() => setAnalysis(!analysis)}
          title="Have the Stockfish engine evaluate the position on the board">Analysis</button>
          : <>
            <button disabled={!myTurn} onClick={hint}>Hint</button>
            <button onClick={giveUp}>Show solution</button>
          </>}
      </div>
      {finished && analysis && <div className="ch-analysis" aria-label="Stockfish analysis">
        <div className="ch-analysis-head">
          <strong className="ch-score">{shownEnd === 'checkmate' ? '#' : formatScore(shownScore) || '…'}</strong>
          <span>{shownEnd ? engineNote : engine?.lines.length ? verdict(best.score) : ''}</span>
          {!shownEnd && <span className="ch-depth">{engineNote}</span>}
        </div>
        {!shownEnd && engine?.lines.length > 0 && <ol className="ch-lines">
          {engine.lines.map((entry, i) => <li key={i}>
            <button type="button" onClick={() => playEngineMove(entry.pv[0])} title="Play this move on the board">
              <b>{formatScore(entry.score)}</b> <span>{lineText(shown, entry.pv)}</span>
            </button>
          </li>)}
        </ol>}
      </div>}
      {history.length > 0 && <ol className="ch-moves" aria-label="Moves">
        {history.map((text, i) => <li key={i} className={i % 2 ? 'mine' : 'theirs'}>
          {finished ? <button type="button" aria-current={base === i + 1 && !variation.length ? 'step' : undefined}
            onClick={() => goTo(i + 1)}>{text}</button> : text}
        </li>)}
      </ol>}
      {finished && tried.length > 0 && <p className="ch-variation">
        <span>Your line: {tried.join(' ')}</span>
        <button type="button" onClick={() => goTo(base)}>Back to the puzzle</button>
      </p>}
    </section>
    <p className="ch-help">Tap a piece, then where it goes, or drag it. Your opponent replies on their own.<br />
      When you're done, step through the moves with the arrows (or ← and →), try other moves for either side, and switch on Analysis for Stockfish's view.<br />
      To plan, right-click and drag for an arrow or right-click a square for a circle (on a phone, switch on Draw).<br />A wrong move doesn't end the puzzle, but it's counted. Hint lights up the piece to move.</p>
    <p className="ch-credit">Puzzles from the <a href="https://database.lichess.org/#puzzles" target="_blank" rel="noreferrer">Lichess puzzle database</a>.
      Analysis by <a href={STOCKFISH_SOURCE} target="_blank" rel="noreferrer">Stockfish</a> (free software, GPLv3).</p>
  </main>;
}
