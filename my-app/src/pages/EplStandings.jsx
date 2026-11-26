import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { friendlyPoolError, loadBoard, watchPoolMember } from '../services/eplPool.js';
import './EplPool.css';

// /eplpool/standings: the pool's spreadsheet on the site. Standings (3 points
// a win, 1 a tie), Survivor, and each player's season with what they still
// must and may pick. Worked out by the eplBoard function from the results.
const TABS = [['standings', 'Standings'], ['survivor', 'Survivor'], ['player', 'Player pages']];

// Places with ties: 1, T2, T2, 4...
function places(rows, key) {
  return rows.map((row, i) => {
    const first = rows.findIndex(other => key(other) === key(row));
    const tied = rows.filter(other => key(other) === key(row)).length > 1;
    return `${tied ? 'T' : ''}${first + 1}`;
  });
}

function Pick({ pick, teams }) {
  if (!pick) return <span className="epl-cell-empty">—</span>;
  if (pick.hidden) return <span className="epl-cell-hidden" title="Shows when the week's first match kicks off">🔒</span>;
  return <span className={`epl-pick-cell${pick.result ? ` r-${pick.result}` : ''}`}>
    {teams.get(pick.team)?.name ?? '?'}{pick.result && <b>{pick.result}</b>}
  </span>;
}

function Standings({ board, teams, onPlayer }) {
  const rows = [...board.players].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  const place = places(rows, row => row.total);
  const day = board.lastDay;
  return <div className="epl-table-scroll"><table className="epl-table epl-sheet">
    <thead><tr><th>Place</th><th>Player</th>{day && <><th colSpan={3}>Week {day} teams</th><th>Week {day}</th></>}<th>Total</th><th>W</th><th>T</th><th>L</th></tr></thead>
    <tbody>{rows.map((row, i) => {
      const week = row.weeks[day];
      return <tr key={row.id} className={row.id === board.me ? 'mine' : ''}>
        <td>{place[i]}</td>
        <td><button type="button" className="epl-link" onClick={() => onPlayer(row.id)}>{row.name}</button></td>
        {day && <>{[0, 1, 2].map(n => <td key={n}><Pick pick={week?.picks[n]} teams={teams} /></td>)}<td>{week?.points ?? 0}</td></>}
        <td><strong>{row.total}</strong></td><td>{row.wins}</td><td>{row.ties}</td><td>{row.losses}</td>
      </tr>;
    })}</tbody>
  </table></div>;
}

function Survivor({ board, onPlayer }) {
  const alive = board.players.filter(row => !row.survivor.out)
    .sort((a, b) => a.survivor.strikes - b.survivor.strikes || b.survivor.fourLeft - a.survivor.fourLeft || a.name.localeCompare(b.name));
  const out = board.players.filter(row => row.survivor.out).sort((a, b) => b.survivor.outAfter - a.survivor.outAfter || a.name.localeCompare(b.name));
  const place = places(alive, row => `${row.survivor.strikes}/${row.survivor.fourLeft}`);
  const { SURVIVE_POINTS, FOUR_POINT_WEEKS, STRIKES_OUT } = board.rules;
  return <>
    <p className="epl-note">Survive a week with {SURVIVE_POINTS}+ points from your 3 teams. Twice a season, 4 points is enough. A week short is a strike;
      {' '}{STRIKES_OUT} strikes and you're out. A postponed match counts for its original week.</p>
    <div className="epl-table-scroll"><table className="epl-table epl-sheet">
      <thead><tr><th>Place</th><th>Player</th><th>4-point weeks left</th><th>Strikes</th><th /></tr></thead>
      <tbody>
        {alive.map((row, i) => <tr key={row.id} className={row.id === board.me ? 'mine' : ''}>
          <td>{place[i]}</td><td><button type="button" className="epl-link" onClick={() => onPlayer(row.id)}>{row.name}</button></td>
          <td>{row.survivor.fourLeft} of {FOUR_POINT_WEEKS}</td><td>{'✕'.repeat(row.survivor.strikes) || '0'}</td><td>In</td>
        </tr>)}
        {out.map(row => <tr key={row.id} className={`epl-out${row.id === board.me ? ' mine' : ''}`}>
          <td>Out</td><td><button type="button" className="epl-link" onClick={() => onPlayer(row.id)}>{row.name}</button></td>
          <td>{row.survivor.fourLeft} of {FOUR_POINT_WEEKS}</td><td>{'✕'.repeat(row.survivor.strikes)}</td><td>Out after week {row.survivor.outAfter}</td>
        </tr>)}
      </tbody>
    </table></div>
  </>;
}

function PlayerPage({ board, teams, player, onPlayer }) {
  const row = board.players.find(entry => entry.id === player) ?? board.players.find(entry => entry.id === board.me) ?? board.players[0];
  if (!row) return <p className="epl-note">No players yet.</p>;
  const { MIN_PER_TEAM, MAX_PER_TEAM } = board.rules;
  const names = [...board.players].sort((a, b) => a.name.localeCompare(b.name));
  return <>
    <select className="epl-player-select" value={row.id} onChange={event => onPlayer(event.target.value)} aria-label="Player">
      {names.map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
    </select>
    <p className="epl-note"><strong>{row.total}</strong> points · {row.wins} W, {row.ties} T, {row.losses} L · Survivor:{' '}
      {row.survivor.out ? `out after week ${row.survivor.outAfter}` : `${row.survivor.strikes} ${row.survivor.strikes === 1 ? 'strike' : 'strikes'}, ${row.survivor.fourLeft} four-point ${row.survivor.fourLeft === 1 ? 'week' : 'weeks'} left`}</p>
    <div className="epl-player-grid">
      <div className="epl-table-scroll"><table className="epl-table epl-sheet">
        <thead><tr><th>Week</th><th>Team 1</th><th>Team 2</th><th>Team 3</th><th>Pts</th><th>4-pt</th><th>Strike</th></tr></thead>
        <tbody>{board.days.map(day => {
          const week = row.weeks[day];
          return <tr key={day}>
            <td>{day}</td>
            {[0, 1, 2].map(n => <td key={n}><Pick pick={week?.picks[n]} teams={teams} /></td>)}
            <td>{week?.decided || week?.points ? week.points : ''}</td>
            <td>{week?.usedFour ? '✓' : ''}</td><td>{week?.strike ? '✕' : ''}</td>
          </tr>;
        })}</tbody>
      </table></div>
      <div className="epl-table-scroll"><table className="epl-table epl-sheet epl-must">
        <thead><tr><th>Team</th><th>Picked</th><th title={`Picks still needed to reach ${MIN_PER_TEAM}`}>Must</th><th title={`Most picks still allowed (${MAX_PER_TEAM} a season)`}>Most</th></tr></thead>
        <tbody>{board.teams.map(team => {
          const count = row.counts[team.id] ?? 0;
          const must = Math.max(0, MIN_PER_TEAM - count);
          return <tr key={team.id}><td>{team.name}</td><td>{count}</td><td className={must ? 'low' : ''}>{must}</td><td className={count >= MAX_PER_TEAM ? 'max' : ''}>{MAX_PER_TEAM - count}</td></tr>;
        })}</tbody>
      </table></div>
    </div>
  </>;
}

export default function EplStandings() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(([id]) => id === params.get('tab')) ? params.get('tab') : 'standings';
  const player = params.get('player');
  const [state, setState] = useState({ user: undefined, member: undefined });
  const [board, setBoard] = useState(null);
  const { user, member } = state;
  useEffect(() => watchPoolMember(setState), []);
  useEffect(() => {
    if (!user) return;
    let active = true;
    loadBoard().then(data => { if (active) setBoard(data); }).catch(error => { if (active) setBoard({ error: friendlyPoolError(error) }); });
    return () => { active = false; };
  }, [user?.uid]);
  const teams = useMemo(() => new Map((board?.teams ?? []).map(team => [team.id, team])), [board]);
  const go = (next, id) => setParams(id ? { tab: next, player: id } : { tab: next });

  let body;
  if (user === undefined || (user && member === undefined)) body = <p className="epl-note">Loading…</p>;
  else if (!user) body = <p className="epl-note">Sign in on the <Link to="/eplpool">pool page</Link> to see the standings.</p>;
  else if (!board) body = <p className="epl-note">Working out the standings…</p>;
  else if (board.error) body = <p className="epl-error">{board.error}</p>;
  else body = <>
    <nav className="epl-tabs" aria-label="Standings views">
      {TABS.map(([id, label]) => <button key={id} type="button" className={tab === id ? 'active' : ''} aria-pressed={tab === id} onClick={() => go(id)}>{label}</button>)}
    </nav>
    {tab === 'standings' && <Standings board={board} teams={teams} onPlayer={id => go('player', id)} />}
    {tab === 'survivor' && <Survivor board={board} onPlayer={id => go('player', id)} />}
    {tab === 'player' && <PlayerPage board={board} teams={teams} player={player} onPlayer={id => go('player', id)} />}
    <p className="epl-note epl-rules">3 points for a win, 1 for a tie. Picks lock, and everyone's show, when a week's first match kicks off.</p>
  </>;
  return <main className="epl-page epl-admin">
    <Navbar />
    <header className="epl-header"><p className="epl-eyebrow">EPL Pool</p><h1>Standings</h1><p className="epl-note"><Link to="/eplpool">Make picks</Link></p></header>
    {body}
  </main>;
}
