// src/components/LandingPage.jsx
import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import './LandingPage.css';
import logoImg from '../assets/logoFog.png';
import mineskeeterImg from '../assets/mineskeeter.png';
import ske4dleImg from '../assets/ske4dle.png';
import skeedle500Img from '../assets/skeedle500.png';
import game2048Img from '../assets/2048.png';
import shikakuImg from '../assets/shikaku.png';
import pipesImg from '../assets/pipes.png';
import hashiImg from '../assets/hashkeet.png';
import sudokuImg from '../assets/skeedoku.png';
import nerdleImg from '../assets/nerdle.png';
import nonogramsImg from '../assets/skeedograms.png';

const GAMES = [
   { id: 'nonograms', title: 'Skeedograms', path: '/nonograms', image: nonogramsImg, isNew: true },
  { id: 'nerdle', title: 'Nerdle', path: '/nerdle', image: nerdleImg, isNew: true },
  { id: 'pipes', title: 'Skeeter Piper (net)', path: '/pipes', image: pipesImg },
  { id: 'shikaku', title: 'Shikaku', path: '/shikaku', image: shikakuImg },
  { id: 'quordle', title: 'Ske4dle', path: '/quordle', image: ske4dleImg },
  { id: 'word500', title: 'Skeedle500', path: '/word500', image: skeedle500Img },
  { id: 'minesweeper', title: 'Mineskeeter', path: '/minesweeper', image: mineskeeterImg },
  { id: '2048', title: '2048', path: '/2048', image: game2048Img },
  { id: 'hashi', title: 'Hashi', path: '/hashi', image: hashiImg },
  { id: 'sudoku', title: 'Skeedoku', path: '/sudoku', image: sudokuImg },
  ];

export default function LandingPage() {
  useEffect(() => {
    // 1. Create and inject the external gtag script
    const gtagScript = document.createElement('script');
    gtagScript.src = 'https://www.googletagmanager.com/gtag/js?id=G-9TBQNYQE6V';
    gtagScript.async = true;
    document.head.appendChild(gtagScript);

    // 2. Initialize dataLayer and gtag config
    window.dataLayer = window.dataLayer || [];
    function gtag() {
      window.dataLayer.push(arguments);
    }
    gtag('js', new Date());
    gtag('config', 'G-9TBQNYQE6V');

    // Cleanup script on unmount
    return () => {
      document.head.removeChild(gtagScript);
    };
  }, []);

  return (
    <div className="landing-container">
      {/* Header */}
      <header className="landing-header">
        <div className="landing-header-content">
          <Link to="/" className="landing-logo">
            <img 
              src={logoImg} 
              alt="Skeeter Games Logo" 
              className="landing-logo-image" 
            />
            <span className="landing-logo-text">Skeeter Games</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="landing-main">
        <div className="landing-grid">
          {GAMES.map((game) => (
            <Link key={game.id} to={game.path} className="landing-card" aria-label={game.title}>
              {game.isNew && <span className="new-badge">NEW</span>}
              <img 
                src={game.image} 
                alt={game.title} 
                className="landing-card-image" 
              />
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}