import { useState } from 'react';
import GameModal from './GameModal';
import { gameInstructions } from './gameInstructions.js';
import './GameToolbar.css';

export default function GameToolbar({ gameId, title, onStats, children }) {
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  return <>
    <div className="game-utility-bar" aria-label={`${title} game tools`}>
      {children && <span className="game-utility-time">{children}</span>}
      <button type="button" className="game-utility-icon" aria-label={`${title} statistics`} title="Statistics"
        aria-haspopup="dialog" onClick={onStats}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h16" /><rect x="5" y="12" width="3" height="6" rx=".5" /><rect x="10.5" y="5" width="3" height="13" rx=".5" /><rect x="16" y="9" width="3" height="9" rx=".5" /></svg>
      </button>
      <button type="button" className="game-utility-icon" aria-label={`${title} instructions`} title="How to play"
        aria-haspopup="dialog" onClick={() => setInstructionsOpen(true)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6C9 4 6 4 3 5v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1Zm0 0v14M6 8h3M6 11h3M15 8h3M15 11h3" /></svg>
      </button>
    </div>
    {instructionsOpen && <GameModal titleId={`instructions-${gameId}`} onClose={() => setInstructionsOpen(false)}>
      <p className="daily-results-eyebrow">{title}</p>
      <h2 id={`instructions-${gameId}`}>How to play</h2>
      <ol className="game-instructions-list">{gameInstructions[gameId].map(rule => <li key={rule}>{rule}</li>)}</ol>
    </GameModal>}
  </>;
}
