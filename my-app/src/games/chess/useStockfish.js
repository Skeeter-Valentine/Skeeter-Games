import { useEffect, useRef, useState } from 'react';
import { Engine } from './stockfish.js';

// Analyses `fen` with Stockfish while `on` is true. The engine is started the
// first time it's needed and shut down when the page closes.
// Returns null while off, otherwise { status, depth, lines, score } where
// status is 'loading' | 'thinking' | 'done' | 'error', lines are the engine's
// best lines ([{ score, pv }]) and score is the latest evaluation (kept while
// the next position loads, so the bar doesn't jump back to the middle).
export default function useStockfish(fen, on) {
  const engine = useRef(null);
  const [result, setResult] = useState(null);

  useEffect(() => () => { engine.current?.terminate(); engine.current = null; }, []);

  useEffect(() => {
    if (!on || !fen) { engine.current?.stop(); return undefined; }
    engine.current ??= new Engine();
    let live = true;
    engine.current.analyse(fen, {}, update => {
      if (!live) return;
      setResult(update.error ? { fen, status: 'error', depth: 0, lines: [] }
        : { fen, status: update.done ? 'done' : 'thinking', depth: update.depth, lines: update.lines });
    });
    return () => { live = false; };
  }, [fen, on]);

  if (!on) return null;
  const score = result?.lines[0]?.score ?? null;
  if (result?.fen === fen) return { ...result, score };
  if (result?.status === 'error') return { ...result, fen, score: null };
  return { fen, status: result ? 'thinking' : 'loading', depth: 0, lines: [], score };
}
