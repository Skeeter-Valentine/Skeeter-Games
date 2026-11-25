import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import SignInDialog from '../components/SignInDialog';
import { signOutPlayer } from '../services/gauntletBoard.js';
import { MAX_PER_TEAM, MIN_PER_TEAM, PICKS_PER_WEEK, currentMatchday, friendlyPoolError, isLocked, joinPool, loadManagedTeams, loadPicks, loadSeason,
  matchdays, savePicks, teamCounts, teamsOf, watchPoolMember } from '../services/eplPool.js';
import './EplPool.css';

const OWNER_UID = 'QtQwYuCN4vWR1XNyz9K6fe9G7jl1';
const kickoff = fixture => new Date(fixture.utcDate).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const dayLabel = fixture => new Date(fixture.utcDate).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

function Crest({ team }) {
  return team.crest ? <img className="epl-crest" src={team.crest} alt="" loading="lazy" /> : <span className="epl-crest epl-crest-blank">{team.tla}</span>;
}

// One game week's matches. `picks` are this week's chosen { team, match };
// `counts` are season totals (with this week's picks) for the badges.
// `admin` (fixing someone's picks) ignores the kickoff locks.
export function WeekPicker({ fixtures, matchday, saved, counts, onSave, admin = false, now = Date.now() }) {
  const week = fixtures.filter(fixture => fixture.matchday === matchday).sort((a, b) => a.utcDate.localeCompare(b.utcDate));
  const [picks, setPicks] = useState(saved);
  const [status, setStatus] = useState({ busy: false, error: '', note: '' });
  const savedKey = JSON.stringify(saved), changed = JSON.stringify(picks) !== savedKey;
  // A new week or a fresh save: start from what's saved.
  useEffect(() => { setPicks(JSON.parse(savedKey)); }, [matchday, savedKey]);
  useEffect(() => { setStatus({ busy: false, error: '', note: '' }); }, [matchday]);
  const locked = fixture => !admin && isLocked(fixture, now);
  // Season counts with the unsaved changes.
  const live = new Map(counts);
  for (const pick of saved) live.set(pick.team, (live.get(pick.team) ?? 1) - 1);
  for (const pick of picks) live.set(pick.team, (live.get(pick.team) ?? 0) + 1);

  function choose(fixture, team) {
    if (locked(fixture)) return;
    const current = picks.find(pick => pick.match === fixture.id);
    let next = picks.filter(pick => pick.match !== fixture.id);
    if (current?.team !== team.id) {
      if (next.length >= PICKS_PER_WEEK) { setStatus({ busy: false, error: `You can pick ${PICKS_PER_WEEK} teams a week. Unpick one first.`, note: '' }); return; }
      next = [...next, { team: team.id, match: fixture.id }];
    }
    setPicks(next);
    setStatus({ busy: false, error: '', note: '' });
  }
  async function save() {
    setStatus({ busy: true, error: '', note: '' });
    try {
      await onSave(picks);
      setStatus({ busy: false, error: '', note: picks.length === PICKS_PER_WEEK ? 'Picks saved.' : `Saved ${picks.length} of ${PICKS_PER_WEEK}. Come back for the rest before their matches start.` });
    } catch (error) { setStatus({ busy: false, error: friendlyPoolError(error), note: '' }); }
  }

  let lastDay = '';
  return <section className="epl-week" aria-label={`Game week ${matchday}`}>
    <p className="epl-count"><strong>{picks.length}</strong> of {PICKS_PER_WEEK} picked{admin && ' · admin fix: kickoff locks and season limits are off'}</p>
    <ul className="epl-matches">
      {week.map(fixture => {
        const day = dayLabel(fixture), heading = day !== lastDay && day;
        lastDay = day;
        const isLockedNow = locked(fixture);
        const pick = picks.find(entry => entry.match === fixture.id);
        return <li key={fixture.id} className={isLockedNow ? 'locked' : ''}>
          {heading && <h3 className="epl-day">{heading}</h3>}
          <div className="epl-match">
            {[fixture.home, fixture.away].map((team, side) => {
              const count = live.get(team.id) ?? 0;
              const chosen = pick?.team === team.id;
              return <button key={side} type="button" className={`epl-team${chosen ? ' chosen' : ''}`} aria-pressed={chosen}
                disabled={isLockedNow} onClick={() => choose(fixture, team)}>
                <Crest team={team} />
                <span className="epl-team-name">{team.name}</span>
                <span className={`epl-badge${count >= MAX_PER_TEAM ? ' max' : count < MIN_PER_TEAM ? ' low' : ''}`} title={`Picked ${count} of ${MAX_PER_TEAM} times this season`}>{count}/{MAX_PER_TEAM}</span>
              </button>;
            })}
            <span className="epl-kickoff">{isLockedNow
              ? fixture.score?.home != null ? `${fixture.score.home}–${fixture.score.away}` : 'Locked'
              : new Date(fixture.utcDate).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span>
          </div>
        </li>;
      })}
    </ul>
    <div className="epl-actions">
      <button type="button" className="epl-primary" onClick={save} disabled={!changed || status.busy}>{status.busy ? 'Saving…' : 'Save picks'}</button>
      {changed && <button type="button" onClick={() => setPicks(saved)} disabled={status.busy}>Undo changes</button>}
    </div>
    {status.error && <p className="epl-error" role="alert">{status.error}</p>}
    {status.note && <p className="epl-note" role="status">{status.note}</p>}
  </section>;
}

// The season so far: how many times each team has been picked.
export function SeasonTracker({ teams, counts }) {
  const needed = teams.reduce((sum, team) => sum + Math.max(0, MIN_PER_TEAM - (counts.get(team.id) ?? 0)), 0);
  return <section className="epl-tracker" aria-label="Season picks by team">
    <h2>Your season</h2>
    <p className="epl-note">Pick every team {MIN_PER_TEAM} to {MAX_PER_TEAM} times. {needed ? `${needed} more ${needed === 1 ? 'pick is' : 'picks are'} needed to reach ${MIN_PER_TEAM} for every team.` : `Every team has ${MIN_PER_TEAM}.`}</p>
    <ul>{teams.map(team => {
      const count = counts.get(team.id) ?? 0;
      return <li key={team.id} className={count >= MAX_PER_TEAM ? 'max' : count < MIN_PER_TEAM ? 'low' : 'ok'}>
        <Crest team={team} /><span>{team.name}</span><strong>{count}</strong>
      </li>;
    })}</ul>
  </section>;
}

export default function EplPool() {
  const [params] = useSearchParams();
  const invite = params.get('invite') || '';
  const [state, setState] = useState({ user: undefined, member: undefined });
  const [signingIn, setSigningIn] = useState(false);
  const [season, setSeason] = useState(null);
  const [weeks, setWeeks] = useState(null);
  const [matchday, setMatchday] = useState(null);
  const [joinStatus, setJoinStatus] = useState('');
  // Teams this player picks for: their own, and any they manage for others.
  const [teams, setTeams] = useState([]);
  const [team, setTeam] = useState(null);
  const { user, member } = state;
  useEffect(() => watchPoolMember(setState), []);
  useEffect(() => {
    if (!member) return;
    let active = true;
    setTeam(current => current ?? member.uid);
    loadManagedTeams(member.uid).then(managed => { if (active) setTeams([{ uid: member.uid, name: member.name }, ...managed]); }).catch(() => {});
    return () => { active = false; };
  }, [member?.uid, member?.name]);
  useEffect(() => {
    if (!member || !team) return;
    let active = true;
    setWeeks(null);
    Promise.all([loadSeason(), loadPicks(team)])
      .then(([loadedSeason, loadedWeeks]) => { if (active) { setSeason(loadedSeason); setWeeks(loadedWeeks); setMatchday(current => current ?? currentMatchday(loadedSeason.fixtures)); } })
      .catch(() => { if (active) setSeason({ error: true }); });
    return () => { active = false; };
  }, [member?.uid, team]);
  const counts = useMemo(() => teamCounts(weeks), [weeks]);
  const fixtures = season?.fixtures ?? [];
  const days = matchdays(fixtures);

  async function join() {
    setJoinStatus('Joining…');
    try { await joinPool(invite); setJoinStatus(''); } catch (error) { setJoinStatus(friendlyPoolError(error)); }
  }

  let body;
  if (user === undefined || (user && member === undefined)) body = <p className="epl-note">Loading…</p>;
  else if (!user) body = <div className="epl-card">
    <p>The pool is invite-only. Sign in to {invite ? 'accept your invite' : 'make your picks'}.</p>
    <button type="button" className="epl-primary" onClick={() => setSigningIn(true)}>Sign in</button>
  </div>;
  else if (!member) body = <div className="epl-card">
    {invite || user.uid === OWNER_UID
      ? <><p>{invite ? "You've been invited to the pool." : 'You run this site, so you can join without an invite.'}</p>
        <button type="button" className="epl-primary" onClick={join} disabled={joinStatus === 'Joining…'}>Join the pool</button></>
      : <p>The pool is invite-only. Ask the organizer for an invite link, then open it while signed in.</p>}
    {joinStatus && <p className="epl-error" role="alert">{joinStatus}</p>}
    <p className="epl-note">Signed in as {user.email || user.displayName}. <button type="button" className="epl-link" onClick={signOutPlayer}>Sign out</button></p>
  </div>;
  else if (!season || !weeks) body = <p className="epl-note">Loading the fixtures…</p>;
  else if (season.error) body = <p className="epl-error">The fixtures couldn't be loaded. Refresh to try again.</p>;
  else if (!fixtures.length) body = <p className="epl-note">The fixtures haven't been loaded yet. An admin can load them from the admin page.</p>;
  else {
    const index = days.indexOf(matchday);
    body = <>
      <nav className="epl-weeks" aria-label="Game week">
        <button type="button" onClick={() => setMatchday(days[index - 1])} disabled={index <= 0} aria-label="Previous game week">‹</button>
        <select value={matchday} onChange={event => setMatchday(Number(event.target.value))} aria-label="Game week">
          {days.map(day => <option key={day} value={day}>Game week {day}{weeks?.[day]?.length ? ` (${weeks[day].length}/${PICKS_PER_WEEK})` : ''}</option>)}
        </select>
        <button type="button" onClick={() => setMatchday(days[index + 1])} disabled={index >= days.length - 1} aria-label="Next game week">›</button>
      </nav>
      <WeekPicker fixtures={fixtures} matchday={matchday} saved={weeks?.[matchday] ?? []} counts={counts}
        onSave={async picks => { const result = await savePicks(matchday, picks, team === member.uid ? null : team); setWeeks(current => ({ ...current, [matchday]: result.picks })); }} />
      <SeasonTracker teams={teamsOf(fixtures)} counts={counts} />
    </>;
  }

  return <main className="epl-page">
    <Navbar />
    <header className="epl-header">
      <p className="epl-eyebrow">Premier League {SEASON_LABEL}</p>
      <h1>EPL Pool</h1>
      {member && <p className="epl-note">Picking for {teams.length > 1
        ? <select className="epl-team-switch" value={team ?? member.uid} onChange={event => setTeam(event.target.value)} aria-label="Team">
          {teams.map(entry => <option key={entry.uid} value={entry.uid}>{entry.name}{entry.uid === member.uid ? ' (you)' : ''}</option>)}
        </select>
        : <strong>{member.name}</strong>}
        {' · '}<Link to="/eplpool/standings">Standings</Link>
        {(member.admin || member.uid === OWNER_UID) && <> · <Link to="/eplpool/admin">Pool admin</Link></>}</p>}
    </header>
    {body}
    {member && <p className="epl-note epl-rules">Pick {PICKS_PER_WEEK} teams each game week, each from a different match. A pick locks when its match kicks off;
      until then you can change it. Times are shown in your time zone.</p>}
    {signingIn && <SignInDialog onClose={() => setSigningIn(false)} reason="Sign in to make your picks in the EPL pool." />}
  </main>;
}
const SEASON_LABEL = '2026/27';
