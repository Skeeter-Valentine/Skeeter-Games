// src/pages/LandingPage.jsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import './LandingPage.css';
import logoImg from '../assets/logoFog.webp';
import mineskeeterImg from '../assets/mineskeeter2.webp';
import ske4dleImg from '../assets/ske4dle2.webp';
import skeedle500Img from '../assets/skeedle5002.webp';
import game2048Img from '../assets/20482.webp';
import shikakuImg from '../assets/shikaku2.webp';
import pipesImg from '../assets/pipes2.webp';
import hashiImg from '../assets/hashkeet2.webp';
import sudokuImg from '../assets/skeedoku2.webp';
import nerdleImg from '../assets/skeedle+2.webp';
import nonogramsImg from '../assets/skeedograms2.webp';
import skeedlemarathonImg from '../assets/skeedlemarathon.webp';
import stitchesImg from '../assets/skitches.webp';
import Stitches from '../games/stitches/Stitches';

// Import Skeeter Gauntlet and your game components
import SkeeterGauntlet from '../components/SkeeterGauntlet';
import Minesweeper from '../games/minesweeper/Minesweeper';
import Quordle from '../games/quordle/Quordle';
import Word500 from '../games/word500/Word500';
import Game2048 from '../games/2048/Game2048';
import Shikaku from '../games/shikaku/shikaku';
import Pipes from '../games/pipes/pipes';
import Hashi from '../games/hashi/Hashi';
import Nerdle from '../games/nerdle/Nerdle';
import Nonograms from '../games/nonograms/Nonograms';

const GAMES = [
  { id: 'stitches', title: 'Skitches', path: '/stitches', image: stitchesImg, isNew: true, component: Stitches },
  { id: 'skeedlemarathon', title: 'Skeedlemarathon', path: '/skeedle-marathon', image: skeedlemarathonImg, isNew: true, excludeFromGauntlet: true },
  { id: 'nonograms', title: 'Skeedograms', path: '/nonograms', image: nonogramsImg, isNew: true, component: Nonograms },
  { id: 'nerdle', title: 'Nerdle', path: '/nerdle', image: nerdleImg, component: Nerdle },
  { id: 'pipes', title: 'Skeeter Piper (net)', path: '/pipes', image: pipesImg, component: Pipes },
  { id: 'shikaku', title: 'Shikaku', path: '/shikaku', image: shikakuImg, component: Shikaku },
  { id: 'quordle', title: 'Ske4dle', path: '/quordle', image: ske4dleImg, component: Quordle },
  { id: 'word500', title: 'Skeedle500', path: '/word500', image: skeedle500Img, component: Word500 },
  { id: 'minesweeper', title: 'Mineskeeter', path: '/minesweeper', image: mineskeeterImg, component: Minesweeper },
  { id: '2048', title: '2048', path: '/2048', image: game2048Img, component: Game2048 },
  { id: 'hashi', title: 'Hashi', path: '/hashi', image: hashiImg, component: Hashi },
  // Sudoku stays on the landing page, but we flag it to be excluded from the gauntlet
  { id: 'sudoku', title: 'Skeedoku', path: '/sudoku', image: sudokuImg, excludeFromGauntlet: true },
];

export default function LandingPage() {
  const [inGauntletMode, setInGauntletMode] = useState(false);

  // Filter out games that have excludeFromGauntlet set to true
  const gauntletGames = GAMES.filter(game => !game.excludeFromGauntlet);

  if (inGauntletMode) {
    return (
      <div className="landing-container">
        <header className="landing-header">
          <div className="landing-header-content" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '0 10px' }}>
            <Link to="/" className="landing-logo">
              <img src={logoImg} alt="Skeeter Games Logo" width="40" height="40" className="landing-logo-image" />
              <span className="landing-logo-text">Skeeter Games</span>
            </Link>
            <button 
              onClick={() => setInGauntletMode(false)}
              style={{ 
                background: 'transparent', 
                border: '1px solid #ff2a85', 
                color: '#ff2a85', 
                padding: '6px 14px', 
                borderRadius: '6px', 
                cursor: 'pointer', 
                fontWeight: '900',
                letterSpacing: '0.05em'
              }}
            >
              EXIT GAUNTLET
            </button>
          </div>
        </header>
        <SkeeterGauntlet allGames={gauntletGames} />
      </div>
    );
  }

  return (
    <div className="landing-container">
      <header className="landing-header">
        <div className="landing-header-content" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <Link to="/" className="landing-logo">
            <img src={logoImg} alt="Skeeter Games Logo" width="40" height="40" className="landing-logo-image" />
            <span className="landing-logo-text">Skeeter Games</span>
          </Link>

          {/* <button
            onClick={() => setInGauntletMode(true)}
            className="gauntlet-launch-btn"
            style={{
              background: 'linear-gradient(135deg, #ff2a85, #d8ff00)',
              color: '#121212',
              border: 'none',
              padding: '10px 18px',
              borderRadius: '8px',
              fontWeight: '900',
              cursor: 'pointer',
              letterSpacing: '1px',
              boxShadow: '0 0 15px rgba(216, 255, 0, 0.3)'
            }}
          >
            ⚡ SKEETER GAUNTLET
          </button> */}
        </div>
      </header>

      <main className="landing-main">
        <div className="landing-grid">
          {GAMES.map((game, index) => (
            <Link key={game.id} to={game.path} className="landing-card" aria-label={game.title}>
              {game.isNew && <span className="new-badge">NEW</span>}
              <img src={game.image} alt={game.title} width="640" height="640" loading={index < 3 ? "eager" : "lazy"} decoding="async" className="landing-card-image" />
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
