import { useState } from 'react';
import GameModal from './GameModal';
import { PROVIDERS, authProviders, createEmailAccount, friendlyError, sendPasswordReset, signInWithEmail, signInWithProvider } from '../services/gauntletBoard.js';
import './SignInDialog.css';

const ICONS = {
  google: <svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" /><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" /><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" /><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" /></svg>,
  apple: <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16.4 12.6c0-2.5 2-3.7 2.1-3.8-1.2-1.7-3-1.9-3.6-2-1.5-.2-3 .9-3.8.9-.8 0-2-.9-3.3-.9-1.7 0-3.3 1-4.2 2.5-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8s2 .8 3.3.8c1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9 0 0-2.8-1.1-2.8-4.1zM13.9 5.2c.7-.9 1.2-2 1-3.2-1 0-2.3.7-3 1.6-.7.8-1.2 2-1.1 3.1 1.2.1 2.3-.6 3.1-1.5z" /></svg>,
  microsoft: <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#F25022" d="M2 2h9.5v9.5H2z" /><path fill="#7FBA00" d="M12.5 2H22v9.5h-9.5z" /><path fill="#00A4EF" d="M2 12.5h9.5V22H2z" /><path fill="#FFB900" d="M12.5 12.5H22V22h-9.5z" /></svg>,
  facebook: <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#1877F2" /><path fill="#fff" d="M13.4 22.9v-7.7H16l.4-3h-3v-1.9c0-.9.3-1.5 1.5-1.5h1.6V6.1c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H7.8v3h2.6v7.7c1 .1 2 .1 3 0z" /></svg>,
  github: <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 1.5a10.5 10.5 0 0 0-3.3 20.5c.5.1.7-.2.7-.5v-1.8c-2.9.6-3.5-1.3-3.5-1.3-.5-1.2-1.2-1.5-1.2-1.5-.9-.6.1-.6.1-.6 1 .1 1.6 1.1 1.6 1.1.9 1.6 2.5 1.1 3.1.9.1-.7.4-1.1.7-1.4-2.3-.3-4.8-1.2-4.8-5.2 0-1.1.4-2.1 1.1-2.8-.1-.3-.5-1.3.1-2.8 0 0 .9-.3 2.9 1.1a10 10 0 0 1 5.3 0c2-1.4 2.9-1.1 2.9-1.1.6 1.5.2 2.5.1 2.8.7.7 1.1 1.7 1.1 2.8 0 4-2.5 4.9-4.8 5.2.4.3.7 1 .7 2v2.9c0 .3.2.6.7.5A10.5 10.5 0 0 0 12 1.5z" /></svg>,
};

// The sign-in box: one button per enabled provider, plus email and password
// (sign in, create an account, or reset a forgotten password).
export default function SignInDialog({ onClose, reason = 'Sign in to save your name on the Skeeter Gauntlet leaderboard.' }) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const buttons = authProviders.filter(id => id !== 'email');
  const emailEnabled = authProviders.includes('email');

  async function run(label, action) {
    setBusy(label); setError(''); setNote('');
    try { await action(); return true; } catch (failure) { setError(friendlyError(failure)); return false; } finally { setBusy(''); }
  }
  const withProvider = id => run(id, () => signInWithProvider(id)).then(ok => ok && onClose());
  async function submit(event) {
    event.preventDefault();
    if (mode === 'reset') {
      if (await run('email', () => sendPasswordReset(email))) setNote('If there is an account for that email, a reset link is on its way. Check your inbox.');
      return;
    }
    const ok = await run('email', () => mode === 'create' ? createEmailAccount(email, password) : signInWithEmail(email, password));
    if (ok) onClose();
  }

  return <GameModal titleId="signin-title" onClose={onClose} closeLabel="Not now">
    <p className="daily-results-eyebrow">Skeeter Games</p>
    <h2 id="signin-title">{mode === 'create' ? 'Create an account' : mode === 'reset' ? 'Reset your password' : 'Sign in'}</h2>
    {mode !== 'reset' && <p className="signin-reason">{reason}</p>}
    {mode !== 'reset' && buttons.length > 0 && <div className="signin-providers">
      {buttons.map(id => <button key={id} type="button" className={`signin-provider signin-${id}`} disabled={!!busy} onClick={() => withProvider(id)}>
        <span className="signin-icon">{ICONS[id]}</span>{busy === id ? 'Opening…' : `Continue with ${PROVIDERS[id].label}`}
      </button>)}
    </div>}
    {emailEnabled && <>
      {mode !== 'reset' && buttons.length > 0 && <p className="signin-or"><span>or use email</span></p>}
      <form className="signin-form" onSubmit={submit}>
        <label>Email<input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required /></label>
        {mode !== 'reset' && <label>Password<input type="password" value={password} onChange={event => setPassword(event.target.value)}
          autoComplete={mode === 'create' ? 'new-password' : 'current-password'} minLength={mode === 'create' ? 6 : undefined} required /></label>}
        <button type="submit" className="signin-submit" disabled={!!busy}>
          {busy === 'email' ? 'One moment…' : mode === 'create' ? 'Create account' : mode === 'reset' ? 'Send reset link' : 'Sign in'}</button>
      </form>
      <p className="signin-switch">
        {mode === 'signin' && <><button type="button" onClick={() => { setMode('create'); setError(''); setNote(''); }}>New here? Create an account</button>
          <button type="button" onClick={() => { setMode('reset'); setError(''); setNote(''); }}>Forgot password?</button></>}
        {mode !== 'signin' && <button type="button" onClick={() => { setMode('signin'); setError(''); setNote(''); }}>Back to sign in</button>}
      </p>
    </>}
    {error && <p className="signin-error" role="alert">{error}</p>}
    {note && <p className="signin-note" role="status">{note}</p>}
  </GameModal>;
}
