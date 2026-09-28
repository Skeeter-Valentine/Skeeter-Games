import Parshle from './games/parshle/Parshle';
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import LandingPage from './pages/LandingPage';
import Seo from './seo/Seo';
import GameFeedback from './components/GameFeedback';
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
      <Routes>
        <Route path="/nerdle" element={<Navigate to="/skeedlemath" replace />} />
        <Route path="/parshle" element={<Parshle />} />
        <Route path="/" element={<LandingPage />} />
        <Route path="/minesweeper" element={<Minesweeper />} />
        <Route path="/quordle" element={<Quordle />} />
        <Route path="/word500" element={<Word500 />} />
        <Route path="/sudoku" element={<Sudoku />} />
        <Route path="/2048" element={<Game2048 />} />
        <Route path="/shikaku" element={<Shikaku />} />
        <Route path="/pipes" element={<Pipes />} />
        <Route path="/hashi" element={<Hashi />} />
        <Route path="/stitches" element={<Stitches />} />
        <Route path="/skeedlemath" element={<Skeedlemath />} />
        <Route path="/nonograms" element={<Nonograms />} />
        {/* <Route path="/nurikabe" element={<Nurikabe />} /> */}
        <Route path="/map" element={<Map />} />
        <Route path="/skeedle-marathon" element={<SkeedleMarathon />} />
        <Route path="*" element={<div>404 - Game Not Found</div>} />
      </Routes>
      <GameFeedback />
      <Seo />
    </BrowserRouter>
  );
}
