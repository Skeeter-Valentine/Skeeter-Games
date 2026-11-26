import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { PICKS_PER_WEEK, currentMatchday, friendlyPoolError, loadMembers, loadSeason, matchdays, poolAdmin, teamCounts, watchPoolMember } from '../services/eplPool.js';
import { WeekPicker } from './EplPool.jsx';
import './EplPool.css';

// /eplpool/admin: for pool admins (the site owner, and members made admins).
const OWNER_UID = 'QtQwYuCN4vWR1XNyz9K6fe9G7jl1';
const inviteLink = code => `${window.location.origin}/eplpool?invite=${code}`;

function Fixtures({ season, onChange }) {
  const [key, setKey] = useState('');
  const [status, setStatus] = useState('');
  async function run(action, data) {
    setStatus('Loading fixtures from football-data.org…');
    try {
      const { count } = await poolAdmin(action, data);
      setStatus(`Loaded ${count} matches.`);
      setKey('');
      onChange();
    } catch (error) { setStatus(friendlyPoolError(error)); }
  }
  const synced = season?.syncedAt?.toDate?.();
  return <section className="epl-card epl-admin-section">
    <h2>Fixtures</h2>
    <p className="epl-note">{season?.fixtures?.length ? `${season.fixtures.length} matches loaded${synced ? `, last updated ${synced.toLocaleString()}` : ''}. They update every 3 hours by themselves.` : 'No fixtures yet.'}</p>
    <form className="epl-row" onSubmit={event => { event.preventDefault(); if (key.trim()) run('setKey', { key }); }}>
      <input type="password" value={key} onChange={event => setKey(event.target.value)} placeholder="football-data.org API key" autoComplete="off" aria-label="football-data.org API key" />
      <button type="submit" disabled={!key.trim()}>Save key</button>
      <button type="button" onClick={() => run('sync')}>Update now</button>
    </form>
    {status && <p className="epl-note" role="status">{status}</p>}
  </section>;
}

function Import({ onChange }) {
  const [status, setStatus] = useState(null);
  async function upload(file) {
    if (!file) return;
    setStatus({ text: 'Importing…' });
    try {
      const data = JSON.parse(await file.text());
      const result = await poolAdmin('importPlayers', { players: data.players });
      setStatus({ text: `Imported: ${result.updated} updated, ${result.created} new invites.`, problems: result.problems });
      onChange();
    } catch (error) { setStatus({ text: error instanceof SyntaxError ? "That file isn't a pool import file." : friendlyPoolError(error) }); }
  }
  return <section className="epl-card epl-admin-section">
    <h2>Import picks</h2>
    <p className="epl-note">Load players and their picks from an import file (made from the pool spreadsheet). Each player who isn't a member yet gets an invite
      that brings their picks with it. Importing again updates the same players.</p>
    <input type="file" accept=".json,application/json" onChange={event => upload(event.target.files[0])} />
    {status && <p className="epl-note" role="status">{status.text}</p>}
    {status?.problems?.length > 0 && <details open><summary>{status.problems.length} picks need a look</summary>
      <ul className="epl-problems">{status.problems.map(problem => <li key={problem}>{problem}</li>)}</ul></details>}
  </section>;
}

function Invites({ invites, onChange }) {
  const [name, setName] = useState('');
  const [admin, setAdmin] = useState(false);
  const [copied, setCopied] = useState('');
  const open = invites.filter(invite => !invite.usedBy).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  async function create(event) {
    event.preventDefault();
    await poolAdmin('createInvite', { name, admin });
    setName('');
    setAdmin(false);
    onChange();
  }
  const copy = code => navigator.clipboard?.writeText(inviteLink(code)).then(() => setCopied(code)).catch(() => {});
  return <section className="epl-card epl-admin-section">
    <h2>Invites</h2>
    <p className="epl-note">Each invite link works once. Send it to one player; they sign in and join.</p>
    <form className="epl-row" onSubmit={create}>
      <input value={name} onChange={event => setName(event.target.value)} placeholder="Player's name" maxLength={40} aria-label="Player's name" />
      <label className="epl-check"><input type="checkbox" checked={admin} onChange={event => setAdmin(event.target.checked)} /> Admin</label>
      <button type="submit" disabled={!name.trim()}>Make invite</button>
    </form>
    {open.length > 0 && <ul className="epl-invites">{open.map(invite => <li key={invite.code}>
      <strong>{invite.name || 'Unnamed'}</strong>
      {invite.weeks && <span className="epl-note">{Object.keys(invite.weeks).length} weeks of picks</span>}
      <label className="epl-check"><input type="checkbox" checked={!!invite.admin}
        onChange={event => poolAdmin('setInviteAdmin', { code: invite.code, admin: event.target.checked }).then(onChange)} /> Joins as admin</label>
      <code>{inviteLink(invite.code)}</code>
      <button type="button" onClick={() => copy(invite.code)}>{copied === invite.code ? 'Copied' : 'Copy link'}</button>
      <button type="button" className="epl-link" onClick={() => poolAdmin('deleteInvite', { code: invite.code }).then(onChange)}>Delete</button>
    </li>)}</ul>}
  </section>;
}

// Other members who can make picks for this member's team.
function Managers({ member, members, onChange }) {
  const managers = member.managers ?? [];
  const others = members.filter(other => other.uid !== member.uid && !managers.includes(other.uid));
  return <div className="epl-managers">
    {managers.map(uid => <span key={uid} className="epl-chip">{members.find(other => other.uid === uid)?.name ?? 'Former member'}
      <button type="button" className="epl-link" aria-label="Remove" onClick={() => poolAdmin('removeManager', { uid: member.uid, manager: uid }).then(onChange)}>×</button></span>)}
    <select value="" aria-label={`Let someone else pick for ${member.name}`}
      onChange={event => event.target.value && poolAdmin('addManager', { uid: member.uid, manager: event.target.value }).then(onChange)}>
      <option value="">Add…</option>
      {others.map(other => <option key={other.uid} value={other.uid}>{other.name}</option>)}
    </select>
  </div>;
}

// Enter or fix any team's picks for any week: members, and imported players
// who haven't joined yet. Not held to the lock or the season limits.
function EnterPicks({ members, invites, fixtures, onChange }) {
  const teams = [
    ...members.map(member => ({ key: `m:${member.uid}`, name: member.name, weeks: member.weeks, target: { uid: member.uid } })),
    ...invites.filter(invite => !invite.usedBy).map(invite => ({ key: `i:${invite.code}`, name: invite.name || 'Unnamed invite', weeks: invite.weeks ?? {},
      target: { invite: invite.code }, pending: true })),
  ].sort((a, b) => a.name.localeCompare(b.name));
  const [key, setKey] = useState('');
  const [matchday, setMatchday] = useState(() => currentMatchday(fixtures));
  const team = teams.find(entry => entry.key === key);
  const days = matchdays(fixtures);
  return <section className="epl-card epl-admin-section">
    <h2>Enter picks</h2>
    <p className="epl-note">Pick for any team, any week, including players who haven't joined yet (their picks come with them when they do).
      This isn't held to the lock or the 4–7 limits, so double-check before saving.</p>
    <div className="epl-row">
      <select value={key} onChange={event => setKey(event.target.value)} aria-label="Team">
        <option value="">Choose a team…</option>
        {teams.map(entry => <option key={entry.key} value={entry.key}>{entry.name}{entry.pending ? ' (not joined yet)' : ''}</option>)}
      </select>
      <select value={matchday} onChange={event => setMatchday(Number(event.target.value))} aria-label="Game week">
        {days.map(day => <option key={day} value={day}>Game week {day}{team ? ` (${team.weeks[day]?.length ?? 0}/${PICKS_PER_WEEK})` : ''}</option>)}
      </select>
    </div>
    {team && <WeekPicker key={team.key} admin fixtures={fixtures} matchday={matchday} saved={team.weeks[matchday] ?? []} counts={teamCounts(team.weeks)}
      onSave={picks => poolAdmin('setPicks', { ...team.target, matchday, picks }).then(onChange)} />}
  </section>;
}

function Members({ members, fixtures, me, onChange }) {
  const [fixing, setFixing] = useState(null);
  const [matchday, setMatchday] = useState(() => currentMatchday(fixtures));
  const week = currentMatchday(fixtures);
  const days = matchdays(fixtures);
  const person = members.find(member => member.uid === fixing);
  return <section className="epl-card epl-admin-section">
    <h2>Members ({members.length})</h2>
    <div className="epl-table-scroll"><table className="epl-table">
      <thead><tr><th>Name</th><th>Week {week}</th><th>Season picks</th><th>Admin</th><th>Also picked by</th><th /></tr></thead>
      <tbody>{members.map(member => {
        const total = [...teamCounts(member.weeks).values()].reduce((sum, n) => sum + n, 0);
        return <tr key={member.uid}>
          <td><strong>{member.name}</strong><br /><small>{member.email}</small></td>
          <td>{member.weeks[week]?.length ?? 0}/{PICKS_PER_WEEK}</td>
          <td>{total}</td>
          <td><input type="checkbox" checked={!!member.admin} disabled={member.uid === me}
            onChange={event => poolAdmin('setAdmin', { uid: member.uid, admin: event.target.checked }).then(onChange)} aria-label={`${member.name} is an admin`} /></td>
          <td><Managers member={member} members={members} onChange={onChange} /></td>
          <td className="epl-row">
            <button type="button" onClick={() => setFixing(fixing === member.uid ? null : member.uid)}>{fixing === member.uid ? 'Close' : 'Picks'}</button>
            <button type="button" className="epl-link" onClick={() => {
              const name = window.prompt(`New name for ${member.name}:`, member.name);
              if (name && name.trim() && name.trim() !== member.name) poolAdmin('rename', { uid: member.uid, name }).then(onChange);
            }}>Rename</button>
            {member.uid !== me && <button type="button" className="epl-link" onClick={() => {
              if (window.confirm(`Remove ${member.name} from the pool? Their picks are kept.`)) poolAdmin('removeMember', { uid: member.uid }).then(onChange);
            }}>Remove</button>}
          </td>
        </tr>;
      })}</tbody>
    </table></div>
    {person && <div className="epl-fix">
      <h3>{person.name}'s picks</h3>
      <select value={matchday} onChange={event => setMatchday(Number(event.target.value))} aria-label="Game week">
        {days.map(day => <option key={day} value={day}>Game week {day} ({person.weeks[day]?.length ?? 0}/{PICKS_PER_WEEK})</option>)}
      </select>
      <WeekPicker admin fixtures={fixtures} matchday={matchday} saved={person.weeks[matchday] ?? []} counts={teamCounts(person.weeks)}
        onSave={picks => poolAdmin('setPicks', { uid: person.uid, matchday, picks }).then(onChange)} />
    </div>}
  </section>;
}

export default function EplPoolAdmin() {
  const [state, setState] = useState({ user: undefined, member: undefined });
  const [data, setData] = useState(null);
  const [version, setVersion] = useState(0);
  const { user, member } = state;
  const allowed = !!user && (user.uid === OWNER_UID || !!member?.admin);
  useEffect(() => watchPoolMember(setState), []);
  useEffect(() => {
    if (!allowed) return;
    let active = true;
    Promise.all([loadSeason(), loadMembers()])
      .then(([season, people]) => { if (active) setData({ season, ...people }); })
      .catch(error => { if (active) setData({ error: friendlyPoolError(error) }); });
    return () => { active = false; };
  }, [allowed, version]);
  const reload = () => setVersion(count => count + 1);

  let body;
  if (user === undefined || (user && member === undefined)) body = <p className="epl-note">Loading…</p>;
  else if (!allowed) body = <p className="epl-note">This page is for pool admins. <Link to="/eplpool">Back to the pool</Link></p>;
  else if (!data) body = <p className="epl-note">Loading…</p>;
  else if (data.error) body = <p className="epl-error">{data.error}</p>;
  else body = <>
    <Fixtures season={data.season} onChange={reload} />
    {data.season.fixtures.length > 0 && <Import onChange={reload} />}
    {data.season.fixtures.length > 0 && <EnterPicks members={data.members} invites={data.invites} fixtures={data.season.fixtures} onChange={reload} />}
    <Invites invites={data.invites} onChange={reload} />
    <Members members={data.members} fixtures={data.season.fixtures} me={user.uid} onChange={reload} />
  </>;
  return <main className="epl-page epl-admin">
    <Navbar />
    <header className="epl-header"><p className="epl-eyebrow">EPL Pool</p><h1>Pool admin</h1><p className="epl-note"><Link to="/eplpool">Back to the pool</Link></p></header>
    {body}
  </main>;
}
