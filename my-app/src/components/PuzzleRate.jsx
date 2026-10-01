import { useEffect, useState } from 'react';
import { readPuzzleRate, puzzleLoggingEnabled } from '../services/puzzleResults.js';
import { resultSummary } from '../utils/archive.js';
import { formatDuration } from '../utils/dailyStats.js';

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
      {result.counts.winRate === null ? <p>No attempts yet</p> : <div className="daily-results-community">
        <div><strong>{result.counts.winRate}%</strong><span>Completed</span></div>
        <div><strong>{result.counts.averageSeconds === null ? '—' : formatDuration(result.counts.averageSeconds)}</strong><span>Average time</span></div>
        <div><strong>{result.counts.starts}</strong><span>Players</span></div>
      </div>}
      <p>{result.counts.wins} won · {result.counts.losses} lost · {result.counts.unfinished} unfinished. Completed counts players who solved it out of everyone who started; average time counts winning solves. Each player’s first result counts.</p>
    </>}
  </div>;
}
