import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { accountsEnabled, authProviders, boardEnabled, friendlyError, saveNickname, signOutPlayer, watchPlayer } from '../services/gauntletBoard.js';
import SignInDialog from './SignInDialog';
import './AccountMenu.css';

function GoogleMark() {
  return <svg className="account-google" viewBox="0 0 48 48" aria-hidden="true" width="18" height="18">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>;
}

function PersonMark() {
  return <svg className="account-google" viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
    <circle cx="12" cy="8" r="4.2" fill="#d8ff00" /><path d="M3.5 21c.8-4.4 4.2-7 8.5-7s7.7 2.6 8.5 7z" fill="#ff2a85" />
  </svg>;
}

// Sign in from any page. Shows the player's nickname once signed
// in, with a menu to change it (when the leaderboard is on) or sign out.
export default function AccountMenu({ inline = false }) {
  const [mounted, setMounted] = useState(false);
  const [player, setPlayer] = useState(undefined);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const box = useRef(null);
  useEffect(() => { setMounted(true); return watchPlayer(setPlayer); }, []);
  // Right after someone signs in without a nickname, open the menu with the
  // nickname box so they don't have to find it.
  const previous = useRef(undefined);
  useEffect(() => {
    if (previous.current === null && player && boardEnabled && !player.nickname) { setOpen(true); setError(''); }
    previous.current = player;
  }, [player]);
  useEffect(() => {
    if (!open) return undefined;
    const away = event => { if (!box.current?.contains(event.target)) setOpen(false); };
    const escape = event => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', escape); };
  }, [open]);
  // Prerendered pages and the first render show nothing, so nothing jumps.
  if (!accountsEnabled || !mounted || player === undefined) return <div className={`account${inline ? ' account-inline' : ' account-corner'}`} aria-hidden="true" />;

  async function submitNickname(event) {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      const saved = await saveNickname(name);
      setPlayer(previous => previous && { ...previous, nickname: saved.nickname });
      setEditing(false);
    } catch (failure) { setError(friendlyError(failure)); } finally { setBusy(false); }
  }
  const needsNickname = boardEnabled && player && !player.nickname;
  const label = player ? (player.nickname || player.name.split(' ')[0] || player.email.split('@')[0] || 'Account') : '';

  return <div ref={box} className={`account${inline ? ' account-inline' : ' account-corner'}`}>
    {!player
      ? <button type="button" className="account-button account-signin" onClick={() => setSigningIn(true)} aria-label="Sign in">
          {authProviders.length === 1 && authProviders[0] === 'google' ? <GoogleMark /> : <PersonMark />}<span className="account-name">Sign in</span></button>
      : <button type="button" className="account-button" aria-haspopup="true" aria-expanded={open} onClick={() => { setOpen(value => !value); setError(''); }}>
          {player.photo ? <img className="account-avatar" src={player.photo} alt="" width="26" height="26" referrerPolicy="no-referrer" />
            : <span className="account-avatar account-initial">{label.charAt(0).toUpperCase()}</span>}
          <span className="account-name">{label}</span>
          {needsNickname && <span className="account-dot" aria-label="Choose a nickname" />}
        </button>}
    {open && <div className="account-menu" role="dialog" aria-label="Account">
      {!player ? <p className="account-error" role="alert">{error}</p> : <>
        <p className="account-who">Signed in{player.nickname ? <> as <strong>{player.nickname}</strong></> : player.email ? <> as {player.email}</> : ''}</p>
        {boardEnabled && (needsNickname || editing
          ? <form className="account-form" onSubmit={submitNickname}>
              <label htmlFor="account-nickname">{player.nickname ? 'New nickname' : 'Choose a leaderboard nickname'}</label>
              <input id="account-nickname" value={name} onChange={event => setName(event.target.value)} maxLength={16} placeholder="3–16 letters or numbers" autoComplete="nickname" />
              <button type="submit" className="account-action" disabled={busy || name.trim().length < 3}>Save</button>
            </form>
          : <button type="button" className="account-action" onClick={() => { setName(player.nickname); setEditing(true); }}>Change nickname</button>)}
        {error && <p className="account-error" role="alert">{error}</p>}
        <button type="button" className="account-action" onClick={() => { setOpen(false); setEditing(false); signOutPlayer().catch(() => {}); }}>Sign out</button>
      </>}
    </div>}
    {signingIn && <SignInDialog onClose={() => setSigningIn(false)} reason="Sign in to keep your nickname and play the Skeeter Gauntlet for the leaderboard." />}
  </div>;
}

// The corner button on every page except the homepage (which has it in its
// header) and the owner's archive page (which has its own sign-in).
export function SiteAccount() {
  const { pathname } = useLocation();
  if (pathname === '/' || pathname.startsWith('/admin')) return null;
  return <AccountMenu />;
}
