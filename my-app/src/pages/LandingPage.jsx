import { watchDailyDate } from '../utils/dailyClock.js';
import cartograskeetImg from '../assets/cartograskeet.png';
import parshleImg from '../assets/parshle-blend.webp';
import skeedleBeadleImg from '../assets/skeedle-beadle3.webp';
import skeeluminateImg from '../assets/skeeluminate.webp';
import ChiliRating from '../components/ChiliRating';
import AccountMenu from '../components/AccountMenu';
import PepperBoard from '../components/PepperBoard';
// src/pages/LandingPage.jsx
import React, { useEffect, useState } from 'react';
import { dailyDate, dailyDifficulty } from '../utils/dailyDifficulty.js';
import { Link } from 'react-router-dom';
import './LandingPage.css';
import logoImg from '../assets/logoFog.webp';
import mineskeeterImg from '../assets/mineskeeter2-blend.webp';
import ske4dleImg from '../assets/ske4dle2-blend.webp';
import skeedle500Img from '../assets/skeedle5002-blend.webp';
import game2048Img from '../assets/20482-blend.webp';
import shikakuImg from '../assets/shikaku2-blend.webp';
import pipesImg from '../assets/pipes2-blend.webp';
import hashiImg from '../assets/hashkeet2-blend.webp';
import sudokuImg from '../assets/skeedoku2-blend.webp';
import skeedlemathImg from '../assets/skeedlemath2-blend.webp';
import nonogramsImg from '../assets/skeedograms2-blend.webp';
import skeedlemarathonImg from '../assets/skeedlemarathon-blend.webp';
import stitchesImg from '../assets/skitches.webp';
import pepperPlacerImg from '../assets/pepper-placer.webp';
import kakurasuImg from '../assets/add-em-up.webp';
import gauntletBannerImg from '../assets/gauntlet-banner.webp';
import gauntletBannerNarrowImg from '../assets/gauntlet-banner-narrow.webp';

import { PAR_NAME, gauntletLaunched, STORAGE_PREFIX, formatClock, gauntletDay, restoreRun, runTotal, validPar } from '../gauntlet/gauntlet.js';
import { readPar, watchOwner } from '../services/gauntletPar.js';
import GauntletCountdown from '../components/GauntletCountdown';
import { readLocal } from '../utils/dailyStats.js';

const GAMES = [
  { id: 'kakurasu', title: 'Add ’em Up', path: '/kakurasu', image: kakurasuImg, isNew: true },
  { id: 'pepper-placer', title: 'Pepper Placer', path: '/pepper-placer', image: pepperPlacerImg, isNew: true },
  { id: 'akari', title: 'Skeeluminate', path: '/akari', image: skeeluminateImg, isNew: true },
  { id: 'skeedle-beadle', title: 'Skeedle Beadle', path: '/skeedle-beadle', image: skeedleBeadleImg },
  { id: 'map', title: 'Cartograskeet', path: '/map', image: cartograskeetImg },
  { id: 'parshle', title: 'Parshle', path: '/parshle', image: parshleImg },
  { id: 'stitches', title: 'Skitches', path: '/stitches', image: stitchesImg },
  { id: 'skeedlemarathon', title: 'Skeedlemarathon', path: '/skeedle-marathon', image: skeedlemarathonImg },
  { id: 'nonograms', title: 'Skeedograms', path: '/nonograms', image: nonogramsImg },
  { id: 'skeedlemath', title: 'Skeedle+', path: '/skeedlemath', image: skeedlemathImg },
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
  const [date, setDate] = useState(dailyDate);

  useEffect(() => watchDailyDate(setDate), []);

  // Skeeter Gauntlet banner: today's progress and the owner's time to beat.
  // Gauntlet days start at 4am Mountain Time, not at the puzzles' UTC midnight.
  const gauntletDate = gauntletDay();
  const gauntletOpen = gauntletLaunched(gauntletDate);
  const gauntletRun = gauntletOpen ? restoreRun(readLocal(`${STORAGE_PREFIX}run:${gauntletDate}`, null), gauntletDate) : null;
  const [par, setPar] = useState(null);
  // The owner's account (and only it) gets a link to the admin pages.
  const [owner, setOwner] = useState(false);
  useEffect(() => watchOwner(setOwner), []);
  useEffect(() => {
    if (!gauntletOpen) return;
    let active = true;
    readPar(gauntletDate).then(value => { if (active) setPar(validPar(value, gauntletDate)); }).catch(() => {});
    return () => { active = false; };
  }, [gauntletOpen, gauntletDate]);
  // Under the banner: "Beat Skeet!", the owner's time for today's gauntlet,
  // your own progress and, once you've finished, the countdown to the next one.
  const parText = par ? `${PAR_NAME}'s time today: ${formatClock(par.total)}` : `${PAR_NAME}'s time today: not posted yet`;
  const progressText = !gauntletRun ? '' : gauntletRun.finishedAt ? `Your time: ${formatClock(runTotal(gauntletRun))}`
    : `In progress · game ${gauntletRun.index + 1} of ${gauntletRun.lineup.length}`;
  const gauntletAction = !gauntletOpen ? 'Try a test gauntlet' : !gauntletRun ? 'Play today’s gauntlet' : gauntletRun.finishedAt ? 'See results' : 'Continue';
  const gauntletStatus = !gauntletOpen ? 'Coming soon' : ['Beat Skeet!', parText, progressText].filter(Boolean).join(' · ');

  return (
    <div className="landing-container">
      <header className="landing-header">
        <div className="landing-header-content" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <Link to="/" className="landing-logo">
            <img src={logoImg} alt="Skeeter Games Logo" width="40" height="40" className="landing-logo-image" />
            <span className="landing-logo-text">Skeeter Games</span>
          </Link>

          <section className="difficulty-guide" aria-labelledby="difficulty-title">
            <h2 id="difficulty-title">Today’s spice level</h2>
            <div className="difficulty-scale">
              <span><ChiliRating level={1} /> Mild</span>
              <span><ChiliRating level={2} /> Medium</span>
              <span><ChiliRating level={3} /> Picante</span>
            </div>
          </section>
          {owner && <Link to="/admin" className="landing-admin-link" aria-label="Admin pages" title="Admin pages"><span aria-hidden="true">⚙</span><span className="landing-admin-text">Admin</span></Link>}
          <AccountMenu inline />
        </div>
      </header>

      <main className="landing-main">
        <PepperBoard />
        {/* Until launch the banner opens the test gauntlets. */}
        <Link to={gauntletOpen ? '/gauntlet' : '/gauntlet?test=1'} className="gauntlet-feature"
          aria-label={`The Skeeter Gauntlet: the daily six game obstacle course for fame, fortune, and glory. ${gauntletStatus}`}>
          <picture>
            <source media="(max-width: 600px)" srcSet={gauntletBannerNarrowImg} width="1280" height="760" />
            <img src={gauntletBannerImg} alt="" width="2022" height="640" loading="eager" decoding="async" className="gauntlet-feature-image" />
          </picture>
          {gauntletOpen ? <span className="gauntlet-feature-status" aria-hidden="true">
            <span className="gauntlet-beat">Beat Skeet!</span>
            <span className="gauntlet-par-line">{par ? <>{PAR_NAME}'s time today: <b>{formatClock(par.total)}</b></> : parText}</span>
            {progressText && <span className="gauntlet-progress-line">{progressText}</span>}
            {gauntletRun?.finishedAt && <GauntletCountdown label="Next gauntlet in" />}
            <strong>{gauntletAction} →</strong>
          </span>
            : <span className="gauntlet-feature-status" aria-hidden="true">{gauntletStatus} · <strong>{gauntletAction} →</strong></span>}
        </Link>
        <div className="landing-grid">
          {GAMES.map((game, index) => (
            <Link key={game.id} to={game.path} className="landing-card" aria-label={`${game.title}, daily difficulty ${dailyDifficulty(game.id, date)} of 3 chilis`}>
              {game.isNew && <span className="new-badge">NEW</span>}
              <img src={game.image} alt={game.title} width="640" height="640" loading={index < 3 ? "eager" : "lazy"} decoding="async" className="landing-card-image" />
              <span className="difficulty-badge" aria-hidden="true" title={`Today's difficulty: ${dailyDifficulty(game.id, date)} of 3 chilis`}>
                <ChiliRating level={dailyDifficulty(game.id, date)} />
              </span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}

