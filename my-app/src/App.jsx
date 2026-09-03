import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import LandingPage from './pages/LandingPage';
import Minesweeper from './games/minesweeper/Minesweeper';
import Quordle from './games/quordle/Quordle';
import Word500 from './games/word500/Word500';
import Sudoku from './games/sudoku/Sudoku';
import Game2048 from './games/2048/Game2048';
import Shikaku from './games/shikaku/shikaku';
import Pipes from './games/pipes/pipes';
import Hashi from './games/hashi/Hashi';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/minesweeper" element={<Minesweeper />} />
        <Route path="/quordle" element={<Quordle />} />
        <Route path="/word500" element={<Word500 />} />
        <Route path="/sudoku" element={<Sudoku />} />
        <Route path="/2048" element={<Game2048 />} />
        <Route path="/shikaku" element={<Shikaku />} />
        <Route path="/pipes" element={<Pipes />} />
        <Route path="/hashi" element={<Hashi />} />
        <Route path="*" element={<div>404 - Game Not Found</div>} />
      </Routes>
    </BrowserRouter>
  );
}