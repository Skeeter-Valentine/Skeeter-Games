import DailyBoundary from './components/DailyBoundary';
import Akari from './games/akari/Akari';
import Parshle from './games/parshle/Parshle';
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import LandingPage from './pages/LandingPage';
import AdminArchive from './pages/AdminArchive';
import AdminGauntlets from './pages/AdminGauntlets';
import AdminStats from './pages/AdminStats';
import AdminHome from './pages/AdminHome';
import Gauntlet from './pages/Gauntlet';
import SkeedleBeadle from './games/skeedle-beadle/SkeedleBeadle';
import PepperPlacer from './games/pepper-placer/PepperPlacer';
import Kakurasu from './games/kakurasu/Kakurasu';
import Slitherlink from './games/slitherlink/Slitherlink';
import { isLaunched } from './utils/launch.js';
import Seo from './seo/Seo';
import GameFeedback from './components/GameFeedback';
import Navbar from './components/Navbar';
import { SiteAccount } from './components/AccountMenu';
import SiteFooter from './components/SiteFooter';
import PageAds from './ads/PageAds';
import { ads, openPrivacyChoices } from './ads/ads';
import Minesweeper from './games/minesweeper/Minesweeper';
import Quordle from './games/quordle/Quordle';
import Word500 from './games/word500/Word500';
import Sudoku from './games/sudoku/Sudoku';
import Game2048 from './games/2048/Game2048';
import Shikaku from './games/shikaku/shikaku';
import Pipes from './games/pipes/pipes';
import Hashi from './games/hashi/Hashi';
import Stitches from './games/stitches/Stitches';
import Skeedlemath from './games/skeedlemath/Skeedlemath';
import Nonograms from './games/nonograms/Nonograms';
import Map from './games/map/Map';
// import Nurikabe from './games/nurikabe/Nurikabe';
import SkeedleMarathon from './games/skeedle-marathon/SkeedleMarathon';


export default function App() {
  return (
    <BrowserRouter>
      <SiteAccount />
      <Routes>
        <Route path="/akari" element={<DailyBoundary><Akari /></DailyBoundary>} />
        <Route path="/light-up" element={<Navigate to="/akari" replace />} />
        <Route path="/nerdle" element={<Navigate to="/skeedlemath" replace />} />
        <Route path="/parshle" element={<DailyBoundary><Parshle /></DailyBoundary>} />
        <Route path="/" element={<LandingPage />} />
        <Route path="/gauntlet" element={<Gauntlet />} />
        <Route path="/minesweeper" element={<DailyBoundary><Minesweeper /></DailyBoundary>} />
        <Route path="/quordle" element={<DailyBoundary><Quordle /></DailyBoundary>} />
        <Route path="/word500" element={<DailyBoundary><Word500 /></DailyBoundary>} />
        <Route path="/sudoku" element={<DailyBoundary><Sudoku /></DailyBoundary>} />
        <Route path="/2048" element={<DailyBoundary><Game2048 /></DailyBoundary>} />
        <Route path="/shikaku" element={<DailyBoundary><Shikaku /></DailyBoundary>} />
        <Route path="/pipes" element={<DailyBoundary><Pipes /></DailyBoundary>} />
        <Route path="/hashi" element={<DailyBoundary><Hashi /></DailyBoundary>} />
        <Route path="/stitches" element={<DailyBoundary><Stitches /></DailyBoundary>} />
        <Route path="/skeedlemath" element={<DailyBoundary><Skeedlemath /></DailyBoundary>} />
        <Route path="/nonograms" element={<DailyBoundary><Nonograms /></DailyBoundary>} />
        {/* <Route path="/nurikabe" element={<Nurikabe />} /> */}
        <Route path="/skeedle-beadle" element={<DailyBoundary><SkeedleBeadle /></DailyBoundary>} />
        <Route path="/pepper-placer" element={<DailyBoundary><PepperPlacer /></DailyBoundary>} />
        <Route path="/kakurasu" element={<DailyBoundary><Kakurasu /></DailyBoundary>} />
        {/* Not launched yet (see utils/launch.js): only under npm run dev. */}
        {(isLaunched('slitherlink') || import.meta.env.DEV) && <Route path="/slitherlink" element={<DailyBoundary><Slitherlink /></DailyBoundary>} />}
        {/* About and Privacy: the page text comes from the SEO guide below (src/pages/info). */}
        <Route path="/about" element={<Navbar />} />
        <Route path="/privacy" element={<Navbar />} />
        <Route path="/map" element={<DailyBoundary><Map /></DailyBoundary>} />
        <Route path="/skeedle-marathon" element={<DailyBoundary><SkeedleMarathon /></DailyBoundary>} />
        {/* Hidden owner-only difficulty archive: unlinked, not prerendered, noindex. */}
        <Route path="/admin" element={<AdminHome />} />
        <Route path="/admin/archive" element={<AdminArchive />} />
        <Route path="/admin/gauntlets" element={<AdminGauntlets />} />
        <Route path="/admin/stats" element={<AdminStats />} />
        <Route path="*" element={<div>404 - Game Not Found</div>} />
      </Routes>
      <PageAds />
      <GameFeedback />
      <Seo />
      <SiteFooter onPrivacyChoices={ads.adsense ? openPrivacyChoices : null} />
    </BrowserRouter>
  );
}
