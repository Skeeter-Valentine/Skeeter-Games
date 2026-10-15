import { useEffect, useRef, useState } from 'react';
import { readLocal, writeLocal } from '../utils/dailyStats.js';
import GameModal from './GameModal';
import './Walkthrough.css';

// Shared "Learn to play" walkthrough: a small board solved one guided step at
// a time (used by Skeeluminate and Cartograskeet; Pepper Placer has its own
// version of the same layout).
//
// Each step is { title, text, targets: [ids], wrong?: string, ordered? }.
// Tapping every target finishes a step; an `ordered` step takes its targets
// one at a time in order (a two-tap move: pick up, then put down). A step
// without targets has a Next button. The board
// is drawn by the game from `applied`: every finished target so far, as
// { step, id } in order.

export const walkthroughSeen = key => !!readLocal(key, false);

export function useWalkthrough(steps, seenKey) {
  const [phase, setPhase] = useState('intro'); // intro | play | done
  const [index, setIndex] = useState(0);
  const [tapped, setTapped] = useState([]); // targets done in the current step
  const [nudge, setNudge] = useState('');
  const step = phase === 'play' ? steps[index] : null;
  const applied = [
    ...steps.slice(0, phase === 'done' ? steps.length : index).flatMap(done => done.targets.map(id => ({ step: done, id }))),
    ...(step ? tapped.map(id => ({ step, id })) : []),
  ];
  const remaining = !step ? [] : step.ordered ? step.targets.slice(tapped.length, tapped.length + 1)
    : step.targets.filter(id => !tapped.includes(id));
  const advance = () => {
    setTapped([]); setNudge('');
    if (index + 1 >= steps.length) { setPhase('done'); if (seenKey) writeLocal(seenKey, true); }
    else setIndex(index + 1);
  };
  return {
    phase, index, step, applied, remaining, nudge,
    start: () => setPhase('play'),
    restart: () => { setIndex(0); setTapped([]); setNudge(''); setPhase('play'); },
    next: advance,
    showMe: advance,
    tap(id) {
      if (!step) return;
      if (!remaining.includes(id)) {
        const done = step.ordered ? tapped.includes(id) : tapped.includes(id) || applied.some(entry => entry.id === id);
        if (!done) setNudge(step.wrong || 'Not that one. Look for the glowing squares.');
        return;
      }
      setNudge('');
      const next = [...tapped, id];
      if (next.length >= step.targets.length) advance();
      else setTapped(next);
    },
  };
}

// The text column and board side by side (stacked on phones).
export function WalkthroughPanel({ walk, steps, label, intro, done, doneActions, onExit, board, wide }) {
  const { phase, index, step, nudge } = walk;
  return <section className={`wt-panel${wide ? ' wt-wide' : ''}`} aria-label={label}>
    <div className="wt-text" aria-live="polite">
      {phase === 'intro' && <>
        <p className="wt-step">Learn to play · about a minute</p>
        {intro}
        <div className="wt-actions">
          <button type="button" className="wt-primary" onClick={walk.start}>Start the walkthrough</button>
          <button type="button" onClick={onExit}>Back to the puzzle</button>
        </div>
      </>}
      {phase === 'play' && <>
        <p className="wt-step">Step {index + 1} of {steps.length}</p>
        <h2>{step.title}</h2>
        <p>{step.text}</p>
        {nudge && <p className="wt-nudge" role="alert">{nudge}</p>}
        <div className="wt-actions">
          {step.targets.length ? <button type="button" onClick={walk.showMe}>Show me</button>
            : <button type="button" className="wt-primary" onClick={walk.next}>Next</button>}
          <button type="button" onClick={onExit}>Skip</button>
        </div>
      </>}
      {phase === 'done' && <>
        <p className="wt-step">Solved!</p>
        {done}
        <div className="wt-actions">
          {doneActions.map(action => <button key={action.label} type="button" className={action.primary ? 'wt-primary' : ''} onClick={action.onClick}>{action.label}</button>)}
          <button type="button" onClick={walk.restart}>Walk through again</button>
        </div>
      </>}
    </div>
    <div className="wt-board">{board}</div>
  </section>;
}

// Pop-up over the board when the game opens: "New to …? Learn to play".
// Skip closes it for this visit; "Don't show me this again" (or finishing the
// walkthrough) stops it for good in this browser.
export function WalkthroughPrompt({ game, seenKey, blurb, onStart, onDismiss }) {
  const id = `wt-prompt-${seenKey.replace(/[^a-z0-9]+/gi, '-')}`;
  const start = useRef(null);
  // The dialog focuses its close button when it opens; start on Learn to play.
  useEffect(() => { const timer = setTimeout(() => start.current?.focus(), 0); return () => clearTimeout(timer); }, []);
  return <GameModal titleId={id} onClose={onDismiss} closeLabel={null}>
    <div className="wt-modal">
      <p className="daily-results-eyebrow">{game}</p>
      <h2 id={id}>New to {game}?</h2>
      <p>{blurb || 'A short walkthrough solves a small puzzle with you, one step at a time. It takes about a minute.'}</p>
      <button ref={start} type="button" className="wt-modal-start" onClick={onStart}>Learn to play</button>
      <div className="wt-modal-row">
        <button type="button" onClick={onDismiss}>Skip</button>
        <button type="button" onClick={() => { writeLocal(seenKey, true); onDismiss(); }}>Don't show me this again</button>
      </div>
    </div>
  </GameModal>;
}
