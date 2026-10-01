import { useEffect, useState } from 'react';
import { readPuzzleRate, puzzleLoggingEnabled } from '../services/puzzleResults.js';
import { resultSummary } from '../utils/archive.js';

export default function PuzzleRate({ gameId, date, mode, refresh }) {
  const [result, setResult] = useState(null);
  useEffect(() => {
    if (!puzzleLoggingEnabled) return;
    let active = true;
    setResult(null);
    readPuzzleRate(gameId, date, mode).then(value => {
      if (active) setResult({ counts: resultSummary(value) });
    }).catch(() => { if (active) setResult({ error: true }); });
    return () => { active = false; };
  }, [gameId, date, mode, refresh]);
  if (!puzzleLoggingEnabled) return null;
  return <div className="daily-results-note">
    <h3>{mode === 'archive' ? 'Archive players' : 'Daily players'} · {date}</h3>
    {!result ? <p>Loading community results…</p> : result.error ? <p>Community results are temporarily unavailable.</p> : <>
      <p>{result.counts.winRate === null ? 'No attempts yet' : `${result.counts.winRate}% win rate`} · {result.counts.starts} started · {result.counts.wins} won · {result.counts.losses} lost · {result.counts.unfinished} unfinished</p>
      <p>Win rate is wins divided by started attempts. Each player’s first result counts.</p>
    </>}
  </div>;
}
