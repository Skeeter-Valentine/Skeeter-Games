// src/pages/LandingPage.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './LandingPage.css';
import logoImg from '../assets/logoFog.png';
import mineskeeterImg from '../assets/mineskeeter2.png';
import ske4dleImg from '../assets/ske4dle2.png';
import skeedle500Img from '../assets/skeedle5002.png';
import game2048Img from '../assets/20482.png';
import shikakuImg from '../assets/shikaku2.png';
import pipesImg from '../assets/pipes2.png';
import hashiImg from '../assets/hashkeet2.png';
import sudokuImg from '../assets/skeedoku2.png';
import nerdleImg from '../assets/skeedle+2.png';
import nonogramsImg from '../assets/skeedograms2.png';

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
  { id: 'nonograms', title: 'Skeedograms', path: '/nonograms', image: nonogramsImg, isNew: true, component: Nonograms },
  { id: 'nerdle', title: 'Nerdle', path: '/nerdle', image: nerdleImg, isNew: true, component: Nerdle },
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

  useEffect(() => {
    const gtagScript = document.createElement('script');
    gtagScript.src = 'https://www.googletagmanager.com/gtag/js?id=G-9TBQNYQE6V';
    gtagScript.async = true;
    document.head.appendChild(gtagScript);

    window.dataLayer = window.dataLayer || [];
    function gtag() {
      window.dataLayer.push(arguments);
    }
    gtag('js', new Date());
    gtag('config', 'G-9TBQNYQE6V');

    return () => {
      document.head.removeChild(gtagScript);
    };
  }, []);

  // Filter out games that have excludeFromGauntlet set to true
  const gauntletGames = GAMES.filter(game => !game.excludeFromGauntlet);

  if (inGauntletMode) {
    return (
      <div className="landing-container">
        <header className="landing-header">
          <div className="landing-header-content" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '0 10px' }}>
            <Link to="/" className="landing-logo">
              <img src={logoImg} alt="Skeeter Games Logo" className="landing-logo-image" />
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
            <img src={logoImg} alt="Skeeter Games Logo" className="landing-logo-image" />
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
          {GAMES.map((game) => (
            <Link key={game.id} to={game.path} className="landing-card" aria-label={game.title}>
              {game.isNew && <span className="new-badge">NEW</span>}
              <img src={game.image} alt={game.title} className="landing-card-image" />
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}