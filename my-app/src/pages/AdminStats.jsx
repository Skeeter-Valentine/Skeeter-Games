import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { firebaseConfigured, firebaseServices } from '../services/firebase.js';
import { friendlyError, readAdminStats } from '../services/gauntletBoard.js';
import { GAME_TITLES } from '../utils/adminArchive.js';
import Navbar from '../components/Navbar';
import './AdminArchive.css';
import './AdminStats.css';

// Hidden admin page: who plays, what they play, and how each game is trending.
// The numbers come from the adminStats Cloud Function (owner only). Puzzles
// count once each time a player starts a daily or archive puzzle; practice
// games aren't recorded. ?mock=1 shows sample data.
const ADMIN_UIDS = (import.meta.env.VITE_ADMIN_UIDS || '').split(',').map(id => id.trim()).filter(Boolean);
const gameName = id => GAME_TITLES[id] || id;
const shortDate = date => date ? new Date(`${date}T12:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' }) : '—';
const percent = value => value === null || value === undefined ? '—' : `${Math.round(value * 100)}%`;

// One line, one hue: plays per day, with a hover read-out.
function DailyChart({ days }) {
  const [hover, setHover] = useState(null);
  const width = 760, height = 200, left = 36, right = 26, top = 14, bottom = 26;
  const max = Math.max(4, ...days.map(day => day.plays));
  const step = Math.pow(10, Math.floor(Math.log10(max))) * (max / Math.pow(10, Math.floor(Math.log10(max))) > 5 ? 2 : 1);
  const top_ = Math.ceil(max / step) * step;
  const x = i => left + (i / Math.max(1, days.length - 1)) * (width - left - right);
  const y = value => top + (1 - value / top_) * (height - top - bottom);
  const path = days.map((day, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(day.plays).toFixed(1)}`).join('');
  const ticks = Array.from({ length: Math.round(top_ / step) + 1 }, (_, i) => i * step);
  const pick = event => {
    const box = event.currentTarget.getBoundingClientRect();
    const px = (event.clientX - box.left) / box.width * width;
    setHover(Math.max(0, Math.min(days.length - 1, Math.round((px - left) / (width - left - right) * (days.length - 1)))));
  };
  const point = hover === null ? null : days[hover];
  return <figure className="stats-chart">
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Puzzles played per day, ${shortDate(days[0]?.date)} to ${shortDate(days.at(-1)?.date)}`}
      onPointerMove={pick} onPointerLeave={() => setHover(null)}>
      {ticks.map(tick => <g key={tick}>
        <line x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} className="stats-grid" />
        <text x={left - 6} y={y(tick) + 4} textAnchor="end" className="stats-axis">{tick}</text>
      </g>)}
      {days.map((day, i) => i % 7 === (days.length - 1) % 7 && <text key={day.date} x={x(i)} y={height - 6} textAnchor="middle" className="stats-axis">{shortDate(day.date)}</text>)}
      <path d={path} className="stats-line" />
      {point && <>
        <line x1={x(hover)} x2={x(hover)} y1={top} y2={height - bottom} className="stats-crosshair" />
        <circle cx={x(hover)} cy={y(point.plays)} r="5" className="stats-dot" />
      </>}
    </svg>
    {point && <div className="stats-tooltip" style={{ left: `${x(hover) / width * 100}%` }}><strong>{point.plays}</strong> {point.plays === 1 ? 'puzzle' : 'puzzles'}<span>{shortDate(point.date)}</span></div>}
  </figure>;
}

function Sparkline({ values, label }) {
  const width = 120, height = 30, max = Math.max(1, ...values);
  const points = values.map((value, i) => `${(i / Math.max(1, values.length - 1) * (width - 4) + 2).toFixed(1)},${(height - 3 - value / max * (height - 6)).toFixed(1)}`);
  return <svg className="stats-spark" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
    <polyline points={points.join(' ')} />
    <circle cx={points.at(-1)?.split(',')[0]} cy={points.at(-1)?.split(',')[1]} r="2.5" />
  </svg>;
}

function Change({ value, last7 }) {
  if (value === null) return last7 ? <span className="stats-up">new</span> : <span className="stats-flat">—</span>;
  if (Math.abs(value) < 0.005) return <span className="stats-flat">0%</span>;
  return value > 0 ? <span className="stats-up">▲ {percent(value)}</span> : <span className="stats-down">▼ {percent(-value)}</span>;
}

function mockStats() {
  const games = Object.keys(GAME_TITLES);
  const today = new Date().toISOString().slice(0, 10);
  const day = i => new Date(Date.parse(`${today}T00:00:00Z`) - i * 86400000).toISOString().slice(0, 10);
  const names = ['PepperQueen', 'Skeetmaster', 'HotHashi', 'NonoNinja', 'GridLocked', 'Chili Dog', 'LogicLlama', 'Sk3dle_Pro', 'BulbBrain', 'MapMaven'];
  const users = names.map((nickname, n) => {
    const mine = games.filter((_, g) => (g * 7 + n * 3) % 5 < 2).map((game, g) => ({ game, plays: 30 - g * 6 - n, wins: 25 - g * 6 - n })).filter(g => g.plays > 0);
    return { uid: `mock-${n}`, nickname, plays: mine.reduce((s, g) => s + g.plays, 0), wins: mine.reduce((s, g) => s + g.wins, 0), games: mine,
      favorite: mine[0]?.game ?? null, lastPlayed: day(n % 4), firstPlayed: day(40 + n), gauntlets: 9 - n, gauntletsFinished: 8 - n };
  }).concat([{ uid: 'anon-1', nickname: null, plays: 6, wins: 4, games: [{ game: 'parshle', plays: 6, wins: 4 }], favorite: 'parshle', lastPlayed: day(2), gauntlets: 0, gauntletsFinished: 0 }]);
  const weekStarts = Array.from({ length: 8 }, (_, i) => day(7 * (7 - i)));
  const list = games.map((game, g) => {
    const weekly = weekStarts.map((_, w) => Math.max(0, Math.round(20 + 15 * Math.sin(g + w / 2) + w * (g % 3 - 1) * 3)));
    return { game, weekly, plays: weekly.reduce((s, v) => s + v, 0) * 2, wins: weekly.reduce((s, v) => s + v, 0), last7: weekly[7], prev7: weekly[6],
      change: weekly[6] ? (weekly[7] - weekly[6]) / weekly[6] : null, winRate: 0.5 + (g % 4) / 10, daily: weekly[7] * 6, archive: weekly[7] };
  }).sort((a, b) => b.last7 - a.last7);
  return { today, weekStarts, users, unnamedTotal: 1, games: list,
    daily: Array.from({ length: 30 }, (_, i) => ({ date: day(29 - i), plays: Math.round(60 + 25 * Math.sin(i / 3) + i * 2) })),
    summary: { nicknamed: names.length, recordedPlayers: 57, activeNicknamed7: 7, active7: 31, active30: 48, plays: 4210, plays7: 812, gauntlets: 96 } };
}

export default function AdminStats() {
  const mock = new URLSearchParams(window.location.search).get('mock') === '1';
  const [user, setUser] = useState(undefined);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showUnnamed, setShowUnnamed] = useState(false);
  const [open, setOpen] = useState(null);
  const [sort, setSort] = useState('plays');
  const allowed = mock || (!!user && !user.isAnonymous && ADMIN_UIDS.includes(user.uid));

  useEffect(() => {
    if (!firebaseConfigured) return undefined;
    return onAuthStateChanged(firebaseServices().auth, setUser);
  }, []);
  const load = () => {
    setError(''); setStats(null);
    if (mock) { setStats(mockStats()); return; }
    readAdminStats().then(setStats).catch(failure => setError(`Could not load the statistics. ${friendlyError(failure)} If this is the first time, deploy the functions (firebase deploy --only functions).`));
  };
  useEffect(() => { if (allowed) load(); }, [allowed]);

  const users = useMemo(() => {
    if (!stats) return [];
    const term = search.trim().toLowerCase();
    return stats.users.filter(entry => (showUnnamed || entry.nickname) && (!term || (entry.nickname ?? '').toLowerCase().includes(term)
      || entry.games.some(game => gameName(game.game).toLowerCase().includes(term))))
      .sort((a, b) => sort === 'recent' ? (b.lastPlayed ?? '').localeCompare(a.lastPlayed ?? '') : sort === 'gauntlets' ? b.gauntlets - a.gauntlets : b.plays - a.plays);
  }, [stats, search, showUnnamed, sort]);

  let body;
  if (!firebaseConfigured && !mock) body = <p>Firebase is not configured for this build.</p>;
  else if (!mock && user === undefined) body = <p>Checking sign-in…</p>;
  else if (!mock && (!user || user.isAnonymous)) body = <>
    <p>Sign in to view this page.</p>
    <button type="button" onClick={() => signInWithPopup(firebaseServices().auth, new GoogleAuthProvider()).catch(() => {})}>Sign in with Google</button>
  </>;
  else if (!allowed) body = <>
    <p>This account does not have access.</p>
    <button type="button" onClick={() => signOut(firebaseServices().auth)}>Sign out</button>
  </>;
  else if (error) body = <><p role="alert">{error}</p><button type="button" onClick={load}>Try again</button></>;
  else if (!stats) body = <p role="status">Counting players and puzzles…</p>;
  else {
    const { summary } = stats;
    const weekLabel = `${shortDate(stats.weekStarts[0])} – ${shortDate(stats.weekStarts.at(-1))}`;
    body = <>
      <section className="stats-hero" aria-label="Summary">
        <div className="stats-hero-main"><strong>{summary.nicknamed.toLocaleString()}</strong><span>players with nicknames</span>
          <small>{summary.activeNicknamed7} played in the last 7 days</small></div>
        <dl className="stats-tiles">
          <div><dt>Players with recorded puzzles</dt><dd>{summary.recordedPlayers.toLocaleString()}</dd><small>including players who never signed in</small></div>
          <div><dt>Active last 7 days</dt><dd>{summary.active7.toLocaleString()}</dd><small>{summary.active30} in the last 30</small></div>
          <div><dt>Puzzles played, last 7 days</dt><dd>{summary.plays7.toLocaleString()}</dd><small>{summary.plays.toLocaleString()} all time</small></div>
          <div><dt>Gauntlet runs</dt><dd>{summary.gauntlets.toLocaleString()}</dd><small>by signed-in players</small></div>
        </dl>
      </section>

      <h2>Puzzles played per day</h2>
      <p className="admin-archive-note">Every daily and archive puzzle started, all players, last 30 days.</p>
      <DailyChart days={stats.daily} />

      <h2>Game popularity</h2>
      <p className="admin-archive-note">Ranked by puzzles played in the last 7 days. Change compares with the 7 days before. Trend: puzzles per week, {weekLabel}.</p>
      <div className="admin-archive-scroll">
        <table className="stats-table">
          <thead><tr><th>#</th><th>Game</th><th>Last 7 days</th><th>Change</th><th>8-week trend</th><th>All time</th><th>Solved</th><th>Daily / archive</th></tr></thead>
          <tbody>{stats.games.map((game, index) => <tr key={game.game}>
            <td>{index + 1}</td>
            <td><strong>{gameName(game.game)}</strong></td>
            <td className="stats-num">{game.last7.toLocaleString()}</td>
            <td><Change value={game.change} last7={game.last7} /></td>
            <td><Sparkline values={game.weekly} label={`${gameName(game.game)} per week: ${game.weekly.join(', ')}`} /></td>
            <td className="stats-num">{game.plays.toLocaleString()}</td>
            <td className="stats-num">{percent(game.winRate)}</td>
            <td className="stats-num">{game.daily.toLocaleString()} / {game.archive.toLocaleString()}</td>
          </tr>)}</tbody>
        </table>
      </div>

      <h2>Players</h2>
      <div className="admin-archive-controls">
        <label>Search <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Nickname or game" /></label>
        <label>Sort <select value={sort} onChange={event => setSort(event.target.value)}>
          <option value="plays">Most puzzles</option><option value="recent">Most recent</option><option value="gauntlets">Most gauntlets</option>
        </select></label>
        <label><input type="checkbox" checked={showUnnamed} onChange={event => setShowUnnamed(event.target.checked)} /> Show players without nicknames ({stats.unnamedTotal})</label>
      </div>
      <div className="admin-archive-scroll">
        <table className="stats-table stats-players">
          <thead><tr><th>Player</th><th>Puzzles</th><th>Solved</th><th>Gauntlets</th><th>Last played</th><th>Favorite games</th></tr></thead>
          <tbody>{users.map(entry => {
            const expanded = open === entry.uid;
            const top = Math.max(1, ...entry.games.map(game => game.plays));
            return [<tr key={entry.uid} className={`stats-player${expanded ? ' open' : ''}`} onClick={() => setOpen(expanded ? null : entry.uid)}>
              <td><button type="button" className="stats-name" aria-expanded={expanded}>{entry.nickname ?? <em>No nickname · {entry.uid.slice(0, 6)}</em>}</button></td>
              <td className="stats-num">{entry.plays}</td>
              <td className="stats-num">{entry.plays ? percent(entry.wins / entry.plays) : '—'}</td>
              <td className="stats-num">{entry.gauntlets ? `${entry.gauntletsFinished} / ${entry.gauntlets}` : '—'}</td>
              <td>{shortDate(entry.lastPlayed)}</td>
              <td className="stats-chips">{entry.games.slice(0, 3).map(game => <span key={game.game} className="stats-chip">{gameName(game.game)} <b>{game.plays}</b></span>)}
                {entry.games.length > 3 && <span className="stats-more">+{entry.games.length - 3}</span>}
                {!entry.games.length && <span className="stats-flat">No puzzles yet</span>}</td>
            </tr>,
            expanded && <tr key={`${entry.uid}-games`} className="stats-breakdown"><td colSpan={6}>
              <p className="admin-archive-note">{entry.nickname ?? 'This player'} has played since {shortDate(entry.firstPlayed)}. Puzzles per game (bar) and how many were solved:</p>
              <ul>{entry.games.map(game => <li key={game.game}>
                <span>{gameName(game.game)}</span>
                <span className="stats-bar"><span style={{ width: `${game.plays / top * 100}%` }} /></span>
                <span className="stats-num">{game.plays} played · {game.wins} solved</span>
              </li>)}</ul>
            </td></tr>];
          })}</tbody>
        </table>
      </div>
      {!users.length && <p>No players match.</p>}
      <p className="admin-archive-note">Puzzles count each daily or archive puzzle a player starts (practice games aren't recorded). Players who never sign in still get an anonymous ID, so they appear without a nickname; the same person on two devices counts twice. <button type="button" onClick={load}>Refresh</button></p>
    </>;
  }

  return <main className="admin-archive admin-stats">
    <Navbar />
    <nav className="stats-nav" aria-label="Admin pages"><Link to="/admin">Admin home</Link><Link to="/admin/gauntlets">Upcoming gauntlets</Link><Link to="/admin/archive">Puzzle archive</Link></nav>
    <h1>Player stats</h1>
    {body}
  </main>;
}
