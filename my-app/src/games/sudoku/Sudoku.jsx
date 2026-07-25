import React, { useState, useEffect } from 'react';

const EQUATION_LENGTH = 10;
const MAX_ATTEMPTS = 6;

// Predefined list of valid 10-character equations
const EQUATION_LIST = [
  '12+34-10=36',
  '100/5+10=30',
  '45*2-10=80',
  '15+25*2=65',
  '90-30/3=80',
  '12*8-16=80',
  '50+50/2=75',
  '10*10-1=99',
  '24/3+12=20',
  '30*3+10=100',
];

export default function MaxiNerdle() {
  const [targetEquation, setTargetEquation] = useState('');
  const [guesses, setGuesses] = useState([]);
  const [currentGuess, setCurrentGuess] = useState('');
  const [gameStatus, setGameStatus] = useState('IN_PROGRESS'); // IN_PROGRESS, WON, LOST
  const [message, setMessage] = useState('');

  const startNewGame = () => {
    const randomEq = EQUATION_LIST[Math.floor(Math.random() * EQUATION_LIST.length)];
    setTargetEquation(randomEq);
    setGuesses([]);
    setCurrentGuess('');
    setGameStatus('IN_PROGRESS');
    setMessage('');
  };

  useEffect(() => {
    startNewGame();
  }, []);

  // Evaluate guess character by character (Green, Purple, Gray)
  const evaluateGuess = (guess, target) => {
    const colors = Array(EQUATION_LENGTH).fill('#3a3a3c'); // Default Dark Gray
    const targetArr = target.split('');
    const guessArr = guess.split('');

    const targetVisited = Array(EQUATION_LENGTH).fill(false);
    const guessVisited = Array(EQUATION_LENGTH).fill(false);

    // First pass: Exact matches (Green)
    for (let i = 0; i < EQUATION_LENGTH; i++) {
      if (guessArr[i] === targetArr[i]) {
        colors[i] = '#398874'; // Green
        targetVisited[i] = true;
        guessVisited[i] = true;
      }
    }

    // Second pass: Misplaced matches (Purple)
    for (let i = 0; i < EQUATION_LENGTH; i++) {
      if (!guessVisited[i]) {
        for (let j = 0; j < EQUATION_LENGTH; j++) {
          if (!targetVisited[j] && guessArr[i] === targetArr[j]) {
            colors[i] = '#820458'; // Purple
            targetVisited[j] = true;
            break;
          }
        }
      }
    }

    return colors;
  };

  // Basic math validation to check if equal sign exists and left side equals right side
  const isValidEquation = (str) => {
    if (!str.includes('=')) return false;
    const parts = str.split('=');
    if (parts.length !== 2 || !parts[0] || !parts[1]) return false;

    try {
      // Evaluate left side and right side safely
      const leftVal = Function(`'use strict'; return (${parts[0]})`)();
      const rightVal = Function(`'use strict'; return (${parts[1]})`)();
      return leftVal === rightVal;
    } catch {
      return false;
    }
  };

  const handleInput = (char) => {
    if (gameStatus !== 'IN_PROGRESS') return;

    if (char === 'ENTER') {
      submitGuess();
    } else if (char === 'DELETE' || char === 'BACKSPACE') {
      setCurrentGuess((prev) => prev.slice(0, -1));
    } else if (currentGuess.length < EQUATION_LENGTH) {
      if (/^[0-9+\-*/=]$/.test(char)) {
        setCurrentGuess((prev) => prev + char);
      }
    }
  };

  const submitGuess = () => {
    if (currentGuess.length !== EQUATION_LENGTH) {
      showMessage('Guess must be 10 characters long!');
      return;
    }

    if (!isValidEquation(currentGuess)) {
      showMessage('That does not compute!');
      return;
    }

    const colors = evaluateGuess(currentGuess, targetEquation);
    const newGuesses = [...guesses, { guess: currentGuess, colors }];
    setGuesses(newGuesses);
    setCurrentGuess('');

    if (currentGuess === targetEquation) {
      setGameStatus('WON');
      showMessage('🎉 Great job! You solved the Maxi Nerdle!');
    } else if (newGuesses.length >= MAX_ATTEMPTS) {
      setGameStatus('LOST');
      showMessage(`Game Over! The target was: ${targetEquation}`);
    }
  };

  const showMessage = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  };

  // Keyboard Event Listeners
  useEffect(() => {
    const handleKeyDown = (e) => {
      const key = e.key.toUpperCase();
      if (key === 'ENTER') {
        handleInput('ENTER');
      } else if (key === 'BACKSPACE') {
        handleInput('DELETE');
      } else {
        handleInput(key);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentGuess, gameStatus, targetEquation]);

  // Keyboard button status colors
  const getKeyColor = (key) => {
    let color = '#818384';
    guesses.forEach(({ guess, colors }) => {
      guess.split('').forEach((char, idx) => {
        if (char === key) {
          if (colors[idx] === '#398874') color = '#398874';
          else if (colors[idx] === '#820458' && color !== '#398874') color = '#820458';
          else if (colors[idx] === '#3a3a3c' && color === '#818384') color = '#3a3a3c';
        }
      });
    });
    return color;
  };

  const keyboardKeys = [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['+', '-', '*', '/', '=', 'ENTER', 'DELETE'],
  ];

  // Inline CSS Styles
  const styles = {
    container: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      minHeight: '100vh',
      backgroundColor: '#121213',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif',
      padding: '20px 10px',
      boxSizing: 'border-box',
    },
    header: {
      fontSize: '28px',
      fontWeight: 'bold',
      letterSpacing: '2px',
      marginBottom: '10px',
      borderBottom: '1px solid #3a3a3c',
      paddingBottom: '10px',
      width: '100%',
      maxWidth: '600px',
      textAlign: 'center',
    },
    message: {
      minHeight: '24px',
      fontSize: '16px',
      fontWeight: 'bold',
      color: '#00d2d3',
      marginBottom: '15px',
      textAlign: 'center',
    },
    board: {
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      marginBottom: '20px',
    },
    row: {
      display: 'flex',
      gap: '4px',
      justifyContent: 'center',
    },
    tile: (bgColor, hasBorder) => ({
      width: '42px',
      height: '42px',
      border: hasBorder ? '2px solid #565758' : 'none',
      backgroundColor: bgColor || '#121213',
      color: '#ffffff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '20px',
      fontWeight: 'bold',
      borderRadius: '4px',
    }),
    resetBtn: {
      backgroundColor: '#398874',
      color: '#fff',
      border: 'none',
      padding: '10px 20px',
      fontSize: '16px',
      fontWeight: 'bold',
      borderRadius: '4px',
      cursor: 'pointer',
      marginBottom: '15px',
    },
    keyboard: {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      width: '100%',
      maxWidth: '600px',
    },
    kbRow: {
      display: 'flex',
      justifyContent: 'center',
      gap: '5px',
    },
    keyBtn: (bgColor, isWide) => ({
      backgroundColor: bgColor,
      color: '#ffffff',
      border: 'none',
      borderRadius: '4px',
      padding: '12px 6px',
      fontWeight: 'bold',
      cursor: 'pointer',
      fontSize: '14px',
      flex: isWide ? 1.5 : 1,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
    }),
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>MAXI NERDLE</div>

      <div style={styles.message}>{message}</div>

      {gameStatus !== 'IN_PROGRESS' && (
        <button style={styles.resetBtn} onClick={startNewGame}>
          Play Again
        </button>
      )}

      {/* Grid */}
      <div style={styles.board}>
        {Array.from({ length: MAX_ATTEMPTS }).map((_, rIdx) => {
          const guessObj = guesses[rIdx];
          const isCurrentRow = rIdx === guesses.length && gameStatus === 'IN_PROGRESS';

          let chars = Array(EQUATION_LENGTH).fill('');
          if (guessObj) {
            chars = guessObj.guess.split('');
          } else if (isCurrentRow) {
            chars = currentGuess
              .padEnd(EQUATION_LENGTH, ' ')
              .split('')
              .map((c) => (c === ' ' ? '' : c));
          }

          return (
            <div key={rIdx} style={styles.row}>
              {chars.map((char, cIdx) => {
                let bgColor = '#121213';
                let hasBorder = true;

                if (guessObj) {
                  bgColor = guessObj.colors[cIdx];
                  hasBorder = false;
                } else if (char) {
                  hasBorder = true;
                }

                return (
                  <div key={cIdx} style={styles.tile(bgColor, hasBorder)}>
                    {char}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Keyboard */}
      <div style={styles.keyboard}>
        {keyboardRows.map((row, rIdx) => (
          <div key={rIdx} style={styles.kbRow}>
            {row.map((key) => {
              const isWide = key === 'ENTER' || key === 'DELETE';
              const keyBg = getKeyColor(key);
              return (
                <button
                  key={key}
                  style={styles.keyBtn(keyBg, isWide)}
                  onClick={() => handleInput(key)}
                >
                  {key}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

const keyboardRows = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['+', '-', '*', '/', '=', 'ENTER', 'DELETE'],
];