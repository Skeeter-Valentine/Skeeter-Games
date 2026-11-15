import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { onIdTokenChanged, signOut } from 'firebase/auth';
import { firebaseConfigured, firebaseServices } from '../services/firebase.js';
import { redeemCreatorInvite, watchCreator } from '../services/creator.js';
import { watchOwner } from '../services/gauntletPar.js';
import { friendlyError } from '../services/gauntletBoard.js';
import { previewDays } from '../utils/creatorAccess.js';
import { useCustomGauntlets } from '../services/customGauntlets.js';
import { addDays, customGauntlet, gauntletDay, gauntletLaunched, gauntletLineup, gauntletOpensAt } from '../gauntlet/gauntlet.js';
import ChiliRating from '../components/ChiliRating';
import Navbar from '../components/Navbar';
import SignInDialog from '../components/SignInDialog';
import './AdminArchive.css';
import './AdminCreators.css';

// The creator page (/creator), for people invited from /admin/creators.
// An invite link (/creator?invite=…) turns the signed-in account into a
// creator; after that this page lists the gauntlets they can open early.
const DAYS_AHEAD = 60;
const dayLabel = day => new Date(`${day}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });

export default function CreatorHome() {
  const [params, setParams] = useSearchParams();
  const invite = params.get('invite');
  const [user, setUser] = useState(firebaseConfigured ? undefined : null);
  const [creator, setCreator] = useState(undefined);
  const [owner, setOwner] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [redeem, setRedeem] = useState({ state: 'idle' }); // idle | working | done | error
  const tried = useRef('');
  const custom = useCustomGauntlets();

  useEffect(() => {
    if (!firebaseConfigured) return undefined;
    return onIdTokenChanged(firebaseServices().auth, next => setUser(next && !next.isAnonymous ? next : null));
  }, []);
  useEffect(() => watchCreator(setCreator), []);
  useEffect(() => watchOwner(setOwner), []);

  // Signed in with an invite link: accept it once.
  useEffect(() => {
    if (!invite || !user || tried.current === `${user.uid}:${invite}`) return;
    tried.current = `${user.uid}:${invite}`;
    setRedeem({ state: 'working' });
    redeemCreatorInvite(invite)
      .then(() => { setRedeem({ state: 'done' }); setParams({}, { replace: true }); })
      .catch(error => setRedeem({ state: 'error', message: error?.message && !/internal/i.test(error.code || '') ? error.message : friendlyError(error) }));
  }, [invite, user, setParams]);

  const today = gauntletDay();
  const upcoming = Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(today, i + 1)).filter(day => gauntletLaunched(day));
  const days = creator ? previewDays(creator, upcoming) : [];
  const opensAt = new Date(gauntletOpensAt(today)).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  let body;
  if (!firebaseConfigured) body = <p>Accounts aren't set up on this build.</p>;
  else if (user === undefined || (user && creator === undefined && !invite) || custom.state === 'loading') body = <p>Checking sign-in…</p>;
  else if (!user) body = <section className="creator-panel">
    <h2>{invite ? 'You\'re invited' : 'Creators'}</h2>
    <p>{invite ? 'Sign in to accept your creator invite. Use the account you\'ll film with: the invite is tied to it.'
      : 'This page is for creators invited to film with Skeeter Games. Sign in with the account you accepted your invite with.'}</p>
    <button type="button" className="creator-primary" onClick={() => setSigningIn(true)}>Sign in</button>
  </section>;
  else if (redeem.state === 'working') body = <p>Accepting your invite…</p>;
  else if (!creator) body = <section className="creator-panel">
    {redeem.state === 'error' ? <p role="alert" className="creator-error">{redeem.message}</p>
      : <p>This account isn't a creator account. {owner ? <>You're the owner: invite creators from <Link to="/admin/creators">Creators admin</Link>.</>
        : 'Creator access is by invite: open the invite link you were sent, or ask for a new one.'}</p>}
    <p className="admin-archive-note">Signed in as {user.email || user.displayName || 'this account'}.{' '}
      <button type="button" onClick={() => signOut(firebaseServices().auth)}>Use another account</button></p>
  </section>;
  else body = <>
    {redeem.state === 'done' && <p className="creator-made" role="status">Invite accepted. Welcome aboard!</p>}
    {redeem.state === 'error' && <p role="alert" className="creator-error">{redeem.message}</p>}
    <p>Welcome, <strong>{creator.name}</strong><span className="creator-tag">Creator</span></p>
    <section className="creator-panel" aria-labelledby="creator-days">
      <h2 id="creator-days">Gauntlets you can play early</h2>
      {!days.length ? <p className="admin-archive-note">None right now. When you're given a gauntlet to film, it'll show up here.</p>
        : <div className="admin-archive-scroll admin-gauntlets"><table>
          <thead><tr><th>Day</th><th>Lineup</th><th /></tr></thead>
          <tbody>{days.map(day => <tr key={day}>
            <td><strong>{dayLabel(day)}</strong><br /><small>Goes live {new Date(gauntletOpensAt(day)).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</small></td>
            <td>{customGauntlet(day) && <p className="custom-title">{customGauntlet(day).title}</p>}
              <ol className="admin-gauntlet-lineup">{gauntletLineup(day).map(game => <li key={game.id}>{game.title} <ChiliRating level={game.level} /></li>)}</ol></td>
            <td><Link className="admin-gauntlet-play" to={`/gauntlet?day=${day}`}>Play</Link></td>
          </tr>)}</tbody>
        </table></div>}
      <p className="admin-archive-note">Today's gauntlet is open to everyone: <Link to="/gauntlet">play today's gauntlet</Link>. A new one opens every day at {opensAt} your time.</p>
    </section>
    <section className="creator-panel" aria-labelledby="creator-filming">
      <h2 id="creator-filming">Filming tips</h2>
      <ul className="creator-tools">
        <li><strong>Line up your recording</strong>Before you start a gauntlet, press "Show playing area for filming": it shows the bar and the box every game appears
          in, so you can frame your capture. Press Start there when you're ready.</li>
        <li><strong>Your runs stay private</strong>Early runs are timed on your device and aren't published or ranked. On the day, the gauntlet you played
          counts as your attempt on that device.</li>
        <li><strong>Practice freely</strong><Link to="/gauntlet?test=1">Test gauntlets</Link> can be replayed as often as you like: good for a warm-up or
          checking your setup.</li>
        <li><strong>Don't spoil it</strong>Please don't share an early gauntlet's puzzles or lineup before it goes live.</li>
      </ul>
    </section>
    <p className="admin-archive-note">Signed in as {creator.email || user.email || 'this account'}.{' '}
      <button type="button" onClick={() => signOut(firebaseServices().auth)}>Sign out</button></p>
  </>;

  return <main className="admin-archive creator-home">
    <Navbar />
    <h1>Creator corner</h1>
    {body}
    {signingIn && <SignInDialog onClose={() => setSigningIn(false)} reason={invite ? 'Sign in to accept your creator invite.' : 'Sign in to your creator account.'} />}
  </main>;
}
