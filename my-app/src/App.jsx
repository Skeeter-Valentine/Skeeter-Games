import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import LandingPage from './pages/LandingPage';
import Minesweeper from './games/minesweeper/Minesweeper';
import Quordle from './games/quordle/Quordle';
import Word500 from './games/word500/Word500';
import Sudoku from './games/sudoku/Sudoku';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/minesweeper" element={<Minesweeper />} />
        <Route path="/quordle" element={<Quordle />} />
        <Route path="/word500" element={<Word500 />} />
        <Route path="/sudoku" element={<Sudoku />} />
        <Route path="*" element={<div>404 - Game Not Found</div>} />
      </Routes>
    </BrowserRouter>
  );
}