// src/games/nerdle/Nerdle.jsx
import React, { useState, useEffect } from 'react';
import './Nerdle.css';
import Navbar from '../../components/Navbar';

const EQUATION_LENGTH = 10;
const MAX_ATTEMPTS = 6;

const KEYBOARD_ROWS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['+', '-', '*', '/', '=', 'x²', 'x³', '(', ')'],
  ['ENTER', 'DELETE'],
];

const evaluate = (expr) => {
  try {
    const jsExpr = expr.replace(/²/g, '**2').replace(/³/g, '**3');
    return Function(`'use strict'; return (${jsExpr})`)();
  } catch {
    return null;
  }
};

const hasValidParentheses = (expr) => {
  let i = 0;
  let foundNeededParentheses = false;

  while (i < expr.length) {
    if (expr[i] === '(') {
      let depth = 1;
      let j = i + 1;
      while (j < expr.length && depth > 0) {
        if (expr[j] === '(') depth++;
        if (expr[j] === ')') depth--;
        j++;
      }

      const leftPart = expr.split('=')[0];
      if (i === 0 && j === leftPart.length) return false;
      foundNeededParentheses = true;
      i = j;
    } else {
      i++;
    }
  }

  if (foundNeededParentheses) {
    try {
      const withoutParens = expr.replace(/[()]/g, '');
      const valWith = evaluate(expr.split('=')[0]);
      const valWithout = evaluate(withoutParens.split('=')[0]);
      if (valWith === valWithout) return false;
    } catch {
      return false;
    }
  }

  return true;
};

// Simple seeded pseudo-random number generator for Daily Mode
const createSeededRNG = (seed) => {
  let s = seed;
  return () => {
    s = Math.sin(s) * 10000;
    return s - Math.floor(s);
  };
};

const getDailySeedNumber = (dateString = null) => {
  const dateStr = dateString || new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash << 5) - hash + dateStr.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const recentSignatures = [];
let countWithoutEarlyDiv = 0;
let countWithoutEarlySub = 0;

const getStructureSignature = (expr) => {
  return expr.replace(/[0-9²³]/g, 'N');
};

const generateEquation = (isDaily = false, customDateStr = null) => {
  let rng = Math.random;
  if (isDaily) {
    rng = createSeededRNG(getDailySeedNumber(customDateStr));
  }

  const standardTemplates = [
    (r) => {
      const n1 = Math.floor(r() * 9) + 1;
      const n2 = Math.floor(r() * 9) + 1;
      const n3 = Math.floor(r() * 9) + 1;
      const leftExpr = `${n1}*${n2}+${n3}`;
      return { leftExpr, leftVal: evaluate(leftExpr) };
    },
    (r) => {
      const n1 = Math.floor(r() * 8) + 2;
      const n2 = Math.floor(r() * 8) + 2;
      const n3 = Math.floor(r() * 10) + 1;
      const leftExpr = `${n1}*${n2}-${n3}`;
      return { leftExpr, leftVal: evaluate(leftExpr) };
    }
  ];

  const earlySubTemplates = [
    (r) => {
      const n1 = Math.floor(r() * 30) + 15;
      const n2 = Math.floor(r() * 10) + 1;
      const n3 = Math.floor(r() * 10) + 1;
      const leftExpr = `${n1}-${n2}+${n3}`;
      return { leftExpr, leftVal: evaluate(leftExpr) };
    },
    (r) => {
      const n1 = Math.floor(r() * 20) + 10;
      const n2 = Math.floor(r() * 5) + 1;
      const n3 = Math.floor(r() * 4) + 2;
      const leftExpr = `${n1}-${n2}*${n3}`;
      return { leftExpr, leftVal: evaluate(leftExpr) };
    }
  ];

  const earlyDivTemplates = [
    (r) => {
      const n3 = Math.floor(r() * 6) + 2;
      const multiplier = Math.floor(r() * 8) + 2;
      const n1 = n3 * multiplier;
      const n2 = Math.floor(r() * 10) + 1;
      const leftExpr = `${n1}/${n3}+${n2}`;
      return { leftExpr, leftVal: evaluate(leftExpr) };
    },
    (r) => {
      const n3 = Math.floor(r() * 5) + 2;
      const multiplier = Math.floor(r() * 5) + 2;
      const n1 = n3 * multiplier;
      const n2 = Math.floor(r() * 4) + 2;
      const leftExpr = `${n1}/${n3}*${n2}`;
      return { leftExpr, leftVal: evaluate(leftExpr) };
    }
  ];

  const parenTemplates = [
    (r) => {
      const n1 = Math.floor(r() * 5) + 2;
      const n2 = Math.floor(r() * 4) + 1;
      const n3 = Math.floor(r() * 4) + 1;
      const leftExpr = `${n1}*(${n2}+${n3})`;
      return { leftExpr, leftVal: evaluate(leftExpr) };
    },
    (r) => {
      const n1 = Math.floor(r() * 15) + 5;
      const n2 = Math.floor(r() * 4) + 1;
      const n3 = Math.floor(r() * 4) + 1;
      const leftExpr = `${n1}-(${n2}+${n3})`;
      return { leftExpr, leftVal: evaluate(leftExpr) };
    }
  ];

  for (let attempts = 0; attempts < 1500; attempts++) {
    let templatePool = standardTemplates;

    if (countWithoutEarlySub >= 6) {
      templatePool = earlySubTemplates;
    } else if (countWithoutEarlyDiv >= 6) {
      templatePool = earlyDivTemplates;
    } else {
      const roll = rng();
      if (roll < 0.25) templatePool = earlySubTemplates;
      else if (roll < 0.50) templatePool = earlyDivTemplates;
      else if (roll < 0.75) templatePool = parenTemplates;
      else templatePool = standardTemplates;
    }

    const randomTemplate = templatePool[Math.floor(rng() * templatePool.length)];
    const { leftExpr, leftVal } = randomTemplate(rng);

    if (leftVal !== null && Number.isInteger(leftVal) && leftVal >= 0 && leftVal <= 999) {
      const candidate = `${leftExpr}=${leftVal}`;
      
      if (!candidate.startsWith('(') && candidate.length === EQUATION_LENGTH && hasValidParentheses(candidate)) {
        const signature = getStructureSignature(candidate);

        if (!recentSignatures.includes(signature)) {
          recentSignatures.push(signature);
          if (recentSignatures.length > 3) recentSignatures.shift();

          const firstFive = candidate.substring(0, 5);
          if (firstFive.includes('/')) countWithoutEarlyDiv = 0;
          else countWithoutEarlyDiv++;

          if (firstFive.includes('-')) countWithoutEarlySub = 0;
          else countWithoutEarlySub++;

          return candidate;
        }
      }
    }
  }

  return '5*5+25=50';
};

export default function Nerdle({ onWin }) {
  const [isDailyMode, setIsDailyMode] = useState(true);
  const [targetEquation, setTargetEquation] = useState('');
  const [guesses, setGuesses] = useState([]);
  const [currentGuess, setCurrentGuess] = useState(Array(EQUATION_LENGTH).fill(''));
  const [activeCellIndex, setActiveCellIndex] = useState(0);
  const [gameStatus, setGameStatus] = useState('IN_PROGRESS');
  const [message, setMessage] = useState('');

  const startNewGame = (daily = isDailyMode) => {
    const targetEq = generateEquation(daily);
    setTargetEquation(targetEq);
    setGuesses([]);
    setCurrentGuess(Array(EQUATION_LENGTH).fill(''));
    setActiveCellIndex(0);
    setGameStatus('IN_PROGRESS');
  };

  useEffect(() => {
    startNewGame(true);
  }, []);

  const switchMode = (daily) => {
    if (isDailyMode === daily) return;
    setIsDailyMode(daily);
    startNewGame(daily);
  };

  // Debug function to log 10 generated equations to the console
  const handleLogEquations = () => {
    console.log("--- 10 Generated Nerdle Equations ---");
    for (let i = 0; i < 10; i++) {
      console.log(`[${i + 1}]`, generateEquation(false));
    }
  };

  const evaluateGuess = (guess, target) => {
    const colors = Array(EQUATION_LENGTH).fill('default');
    const targetArr = target.split('');
    const guessArr = guess.split('');
    const targetVisited = Array(EQUATION_LENGTH).fill(false);
    const guessVisited = Array(EQUATION_LENGTH).fill(false);

    for (let i = 0; i < EQUATION_LENGTH; i++) {
      if (guessArr[i] === targetArr[i]) {
        colors[i] = 'green';
        targetVisited[i] = true;
        guessVisited[i] = true;
      }
    }

    for (let i = 0; i < EQUATION_LENGTH; i++) {
      if (!guessVisited[i]) {
        for (let j = 0; j < EQUATION_LENGTH; j++) {
          if (!targetVisited[j] && guessArr[i] === targetArr[j]) {
            colors[i] = 'yellow';
            targetVisited[j] = true;
            break;
          }
        }
      }
    }

    return colors;
  };

  const isValidEquation = (str) => {
    if (!str.includes('=')) return false;
    if (!hasValidParentheses(str)) return false;

    const parts = str.split('=');
    if (parts.length !== 2 || !parts[0] || !parts[1]) return false;

    try {
      const jsLeft = parts[0].replace(/²/g, '**2').replace(/³/g, '**3');
      const jsRight = parts[1].replace(/²/g, '**2').replace(/³/g, '**3');
      return Function(`'use strict'; return (${jsLeft})`)() === Function(`'use strict'; return (${jsRight})`)();
    } catch {
      return false;
    }
  };

  const handleInput = (key) => {
    if (gameStatus !== 'IN_PROGRESS') return;

    if (key === 'ENTER') {
      submitGuess();
    } else if (key === 'DELETE' || key === 'BACKSPACE') {
      const newGuess = [...currentGuess];
      if (newGuess[activeCellIndex]) {
        newGuess[activeCellIndex] = '';
      } else if (activeCellIndex > 0) {
        setActiveCellIndex(activeCellIndex - 1);
        newGuess[activeCellIndex - 1] = '';
      }
      setCurrentGuess(newGuess);
    } else {
      let charToInsert = key;
      if (key === 'x²') charToInsert = '²';
      if (key === 'x³') charToInsert = '³';

      if (/^[0-9+\-*/.=()²³]$/.test(charToInsert)) {
        const newGuess = [...currentGuess];
        newGuess[activeCellIndex] = charToInsert;
        setCurrentGuess(newGuess);

        if (activeCellIndex < EQUATION_LENGTH - 1) {
          setActiveCellIndex(activeCellIndex + 1);
        }
      }
    }
  };

  const submitGuess = () => {
    const guessString = currentGuess.join('');
    if (guessString.length !== EQUATION_LENGTH || currentGuess.some((c) => c === '')) {
      setMessage('Guess must be 10 characters long!');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    if (!isValidEquation(guessString)) {
      setMessage('Invalid equation or redundant parentheses!');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    const colors = evaluateGuess(guessString, targetEquation);
    const newGuesses = [...guesses, { guess: guessString, colors }];
    setGuesses(newGuesses);
    setCurrentGuess(Array(EQUATION_LENGTH).fill(''));
    setActiveCellIndex(0);

    if (guessString === targetEquation) {
      setGameStatus('WON');
      setMessage('🎉 Great job! You solved Skeedle+!');
      onWin?.();
    } else if (newGuesses.length >= MAX_ATTEMPTS) {
      setGameStatus('LOST');
      setMessage(`Game Over! The target was: ${targetEquation}`);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      const key = e.key.toUpperCase();
      if (key === 'ENTER') handleInput('ENTER');
      else if (key === 'BACKSPACE') handleInput('DELETE');
      else if (key === 'ARROWLEFT') setActiveCellIndex((prev) => Math.max(0, prev - 1));
      else if (key === 'ARROWRIGHT') setActiveCellIndex((prev) => Math.min(EQUATION_LENGTH - 1, prev + 1));
      else if (key === '2' && e.shiftKey) handleInput('x²');
      else if (key === '3' && e.shiftKey) handleInput('x³');
      else handleInput(key);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentGuess, activeCellIndex, gameStatus, targetEquation]);

  const getKeyColor = (key) => {
    let targetChar = key;
    if (key === 'x²') targetChar = '²';
    if (key === 'x³') targetChar = '³';

    let colorState = '';
    guesses.forEach(({ guess, colors }) => {
      guess.split('').forEach((char, idx) => {
        if (char === targetChar) {
          if (colors[idx] === 'green') colorState = 'green';
          else if (colors[idx] === 'yellow' && colorState !== 'green') colorState = 'yellow';
          else if (colors[idx] === 'default' && !colorState) colorState = 'used';
        }
      });
    });
    return colorState;
  };

  const getModeBtnStyle = (isActive) => ({
    padding: '6px 12px',
    borderRadius: '6px',
    fontSize: '0.85rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    border: '2px solid var(--neon-pink)',
    backgroundColor: isActive ? 'var(--neon-pink)' : 'transparent',
    color: isActive ? '#121212' : 'var(--neon-pink)',
    transition: 'all 0.2s ease',
  });

  return (
    <>
      <Navbar />
      <div className="word500-container">
        <div className="skeedle-header">
          <h1 className="skeedle-title-btn" style={{ cursor: 'default' }}>SKEEDLE+</h1>
          <div className="header-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button style={getModeBtnStyle(isDailyMode)} onClick={() => switchMode(true)}>
              Daily
            </button>
            <button style={getModeBtnStyle(!isDailyMode)} onClick={() => switchMode(false)}>
              Practice
            </button>
            {!isDailyMode && (
              <>
                {/* <button style={getModeBtnStyle(false)} onClick={handleLogEquations}>
                  Log 10 Eqs
                </button> */}
                {gameStatus !== 'IN_PROGRESS' && (
                  <button className="new-game-btn" onClick={() => startNewGame(false)}>
                    Play Again
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        <div style={{ minHeight: '24px', fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--neon-yellow)', marginBottom: '12px', textAlign: 'center' }}>
          {message}
        </div>

        {/* Grid */}
        <div className="word500-board">
          {Array.from({ length: MAX_ATTEMPTS }).map((_, rIdx) => {
            const guessObj = guesses[rIdx];
            const isCurrentRow = rIdx === guesses.length && gameStatus === 'IN_PROGRESS';

            let chars = Array(EQUATION_LENGTH).fill('');
            if (guessObj) chars = guessObj.guess.split('');
            else if (isCurrentRow) chars = currentGuess;

            return (
              <div key={rIdx} className="word500-row">
                <div className="word500-tiles">
                  {chars.map((char, cIdx) => {
                    let tileClass = 'word500-tile';
                    const isCellActive = isCurrentRow && cIdx === activeCellIndex;

                    if (guessObj) {
                      const colorType = guessObj.colors[cIdx];
                      if (colorType === 'green') tileClass += ' note-green';
                      else if (colorType === 'yellow') tileClass += ' note-yellow';
                      else tileClass += ' note-grey';
                    } else if (isCellActive) {
                      tileClass += ' clickable';
                    }

                    return (
                      <div
                        key={cIdx}
                        className={tileClass}
                        onClick={() => isCurrentRow && setActiveCellIndex(cIdx)}
                        style={isCellActive ? { borderColor: 'var(--neon-pink)', boxShadow: '0 0 8px rgba(255, 42, 133, 0.4)' } : {}}
                      >
                        {char}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Keyboard */}
        <div className="word500-keyboard">
          {KEYBOARD_ROWS.map((row, rIdx) => (
            <div key={rIdx} className="word500-keyboard-row">
              {row.map((key) => {
                const isWide = key === 'ENTER' || key === 'DELETE';
                const state = getKeyColor(key);
                let keyClass = `word500-key ${isWide ? 'wide' : ''}`;
                if (state === 'green') keyClass += ' note-green';
                else if (state === 'yellow') keyClass += ' note-yellow';
                else if (state === 'used') keyClass += ' used';

                return (
                  <button key={key} className={keyClass} onClick={() => handleInput(key)}>
                    {key}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}