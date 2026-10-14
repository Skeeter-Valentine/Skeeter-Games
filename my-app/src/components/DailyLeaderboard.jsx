import { useEffect, useState } from 'react';
import { formatDuration } from '../utils/dailyStats.js';
import { readDailyBoard } from '../services/dailyBoard.js';
import { boardEnabled, watchPlayer } from '../services/gauntletBoard.js';
import SignInDialog from './SignInDialog';
import './DailyLeaderboard.css';

// "Fastest today": the quickest solves of this game's daily puzzle.
export default function DailyLeaderboard({ gameId, date, refresh, compact = false }) {
  const [player, setPlayer] = useState(undefined);
  const [board, setBoard] = useState(null);
  const [signingIn, setSigningIn] = useState(false);
  useEffect(() => watchPlayer(setPlayer), []);
  useEffect(() => {
    let active = true;
    // Give a just-finished result a moment to reach the server.
    const timer = setTimeout(() => {
      readDailyBoard(gameId, date, player?.uid).then(result => { if (active) setBoard(result); })
        .catch(() => { if (active) setBoard({ error: true }); });
    }, refresh ? 1500 : 0);
    return () => { active = false; clearTimeout(timer); };
  }, [gameId, date, player?.uid, refresh]);

  let body;
  if (!board) body = <p className="daily-board-note">Loading…</p>;
  else if (board.error) body = <p className="daily-board-note">The leaderboard couldn't be loaded right now.</p>;
  else if (!board.entries.length) body = <p className="daily-board-note">No one is on today's board yet. Solve it to set the time to beat!</p>;
  else {
    const rows = compact ? board.entries.slice(0, 5) : board.entries;
    body = <ol className="daily-board-list">
      {rows.map((entry, index) => <li key={entry.uid} className={entry.uid === player?.uid ? 'mine' : ''}>
        <span className={`daily-board-rank${index < 3 ? ` top-${index + 1}` : ''}`}>{index + 1}</span>
        <span className="daily-board-name">{entry.nickname}</span>
        <span className="daily-board-time">{formatDuration(entry.seconds)}</span>
      </li>)}
      {board.mine && <li className="mine daily-board-gap">
        <span className="daily-board-rank">{board.mine.rank}</span>
        <span className="daily-board-name">{board.mine.nickname}</span>
        <span className="daily-board-time">{formatDuration(board.mine.seconds)}</span>
      </li>}
    </ol>;
  }
  const signedOut = player === null, noNickname = player && boardEnabled && !player.nickname;
  return <section className={`daily-board${compact ? ' compact' : ''}`} aria-label="Fastest times today">
    <h3>Fastest today</h3>
    {body}
    {signedOut && <p className="daily-board-note">
      <button type="button" className="daily-board-link" onClick={() => setSigningIn(true)}>Sign in</button> and choose a nickname to put your time on the board.</p>}
    {noNickname && <p className="daily-board-note">Choose a nickname from the account button (top right) to appear on the board.</p>}
    {signingIn && <SignInDialog onClose={() => setSigningIn(false)} reason="Sign in and choose a nickname to put your daily solve times on the leaderboards." />}
  </section>;
}
