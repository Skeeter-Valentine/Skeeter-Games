import { useState } from 'react';
import GameModal from './GameModal';
import { gameInstructions } from './gameInstructions.js';
import './GameToolbar.css';
import useBoardAlignment from './useBoardAlignment';
import PuzzleArchive from './PuzzleArchive';
import ColorblindToggle from './ColorblindToggle';
import { COLORBLIND_GAMES } from './colorblind.js';

const SPLIT_ROW_GAMES = ['parshle'];

// onLearn: the game has a "Learn to play" walkthrough; the How to play pop-up
// links to it.
export default function GameToolbar({ gameId, title, onStats, onBoard, onLearn, children }) {
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const toolbarRef = useBoardAlignment(gameId);
  // Games with a narrow board put the timer and colorblind switch on their own
  // row under the buttons, so the top row isn't crowded.
  const split = SPLIT_ROW_GAMES.includes(gameId);
  const time = children && <span className="game-utility-time">{children}</span>;
  const colorblind = COLORBLIND_GAMES.includes(gameId) && <ColorblindToggle />;
  return <>
    <div ref={toolbarRef} className={`game-utility-bar${split ? ' game-utility-split' : ''}`} aria-label={`${title} game tools`}>
      {!split && time}
      {!split && colorblind}
      <PuzzleArchive gameId={gameId} title={title} />
      {onBoard && <button type="button" className="game-utility-icon" aria-label={`${title} fastest times today`} title="Fastest today"
        aria-haspopup="dialog" onClick={onBoard}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" /><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M9 20h6M10 17h4" /></svg>
      </button>}
      <button type="button" className="game-utility-icon" aria-label={`${title} statistics`} title="Statistics"
        aria-haspopup="dialog" onClick={onStats}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h16" /><rect x="5" y="12" width="3" height="6" rx=".5" /><rect x="10.5" y="5" width="3" height="13" rx=".5" /><rect x="16" y="9" width="3" height="9" rx=".5" /></svg>
      </button>
      <button type="button" className="game-utility-icon" aria-label={`${title} instructions`} title="How to play"
        aria-haspopup="dialog" onClick={() => setInstructionsOpen(true)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6C9 4 6 4 3 5v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1Zm0 0v14M6 8h3M6 11h3M15 8h3M15 11h3" /></svg>
      </button>
      {split && (time || colorblind) && <div className="game-utility-row">{time}{colorblind}</div>}
    </div>
    {instructionsOpen && <GameModal titleId={`instructions-${gameId}`} onClose={() => setInstructionsOpen(false)}>
      <p className="daily-results-eyebrow">{title}</p>
      <h2 id={`instructions-${gameId}`}>How to play</h2>
      {onLearn && <div className="game-instructions-learn">
        <p>Rather learn by doing? A short walkthrough solves a small puzzle with you, one step at a time.</p>
        <button type="button" onClick={() => { setInstructionsOpen(false); onLearn(); }}>Try the walkthrough</button>
      </div>}
      <ol className="game-instructions-list">{gameInstructions[gameId].map(rule => <li key={rule}>{rule}</li>)}</ol>
    </GameModal>}
  </>;
}
