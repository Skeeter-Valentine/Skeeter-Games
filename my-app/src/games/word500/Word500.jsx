import React, { useState, useEffect } from 'react';

const WORD_LENGTH = 5;
const MAX_ATTEMPTS = 8;

// A sample list of 5-letter target words
const WORD_LIST = [
  'REACT', 'PLANT', 'SHARK', 'BRAIN', 'CLOUD',
  'GRAPE', 'LIGHT', 'MONEY', 'OCEAN', 'FLAME',
  'TRAIN', 'SMART', 'GHOST', 'BREAD', 'MUSIC',
  'CANDY', 'WATER', 'DREAM', 'EARTH', 'FRUIT'
];

export default function Word500() {
  const [targetWord, setTargetWord] = useState('');
  const [guesses, setGuesses] = useState([]);
  const [currentGuess, setCurrentGuess] = useState('');
  const [gameStatus, setGameStatus] = useState('IN_PROGRESS'); // IN_PROGRESS, WON, LOST
  const [message, setMessage] = useState('');

  // Start a new game
  const startNewGame = () => {
    const randomWord = WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)];
    setTargetWord(randomWord);
    setGuesses([]);
    setCurrentGuess('');
    setGameStatus('IN_PROGRESS');
    setMessage('');
  };

  useEffect(() => {
    startNewGame();
  }, []);

  // Calculate Green, Yellow, and Red counts for a guess
  const evaluateGuess = (guess, target) => {
    let green = 0;
    let yellow = 0;

    const targetArr = target.split('');
    const guessArr = guess.split('');

    const targetVisited = Array(WORD_LENGTH).fill(false);
    const guessVisited = Array(WORD_LENGTH).fill(false);

    // 1. First Pass: Find exact matches (Green)
    for (let i = 0; i < WORD_LENGTH; i++) {
      if (guessArr[i] === targetArr[i]) {
        green++;
        targetVisited[i] = true;
        guessVisited[i] = true;
      }
    }

    // 2. Second Pass: Find misplaced matches (Yellow)
    for (let i = 0; i < WORD_LENGTH; i++) {
      if (!guessVisited[i]) {
        for (let j = 0; j < WORD_LENGTH; j++) {
          if (!targetVisited[j] && guessArr[i] === targetArr[j]) {
            yellow++;
            targetVisited[j] = true;
            break;
          }
        }
      }
    }

    const red = WORD_LENGTH - (green + yellow);
    return { green, yellow, red };
  };

  // Keyboard input handlers
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (gameStatus !== 'IN_PROGRESS') return;

      const key = e.key.toUpperCase();

      if (key === 'ENTER') {
        submitGuess();
      } else if (key === 'BACKSPACE') {
        setCurrentGuess((prev) => prev.slice(0, -1));
      } else if (/^[A-Z]$/.test(key) && currentGuess.length < WORD_LENGTH) {
        setCurrentGuess((prev) => prev + key);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentGuess, gameStatus, targetWord]);

  const handleVirtualKey = (key) => {
    if (gameStatus !== 'IN_PROGRESS') return;

    if (key === 'ENTER') {
      submitGuess();
    } else if (key === 'DELETE') {
      setCurrentGuess((prev) => prev.slice(0, -1));
    } else if (currentGuess.length < WORD_LENGTH) {
      setCurrentGuess((prev) => prev + key);
    }
  };

  const submitGuess = () => {
    if (currentGuess.length !== WORD_LENGTH) {
      setMessage('Word must be 5 letters!');
      setTimeout(() => setMessage(''), 2000);
      return;
    }

    const result = evaluateGuess(currentGuess, targetWord);
    const newGuesses = [...guesses, { word: currentGuess, ...result }];
    setGuesses(newGuesses);
    setCurrentGuess('');

    if (result.green === WORD_LENGTH) {
      setGameStatus('WON');
      setMessage('🎉 Congratulations! You guessed the word!');
    } else if (newGuesses.length >= MAX_ATTEMPTS) {
      setGameStatus('LOST');
      setMessage(`Game Over! The word was: ${targetWord}`);
    }
  };

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
      padding: '20px',
      boxSizing: 'border-box',
    },
    header: {
      fontSize: '32px',
      fontWeight: 'bold',
      letterSpacing: '2px',
      marginBottom: '10px',
      borderBottom: '1px solid #3a3a3c',
      paddingBottom: '10px',
      width: '100%',
      maxWidth: '500px',
      textAlign: 'center',
    },
    board: {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      marginBottom: '20px',
      width: '100%',
      maxWidth: '420px',
    },
    row: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '10px',
    },
    lettersContainer: {
      display: 'flex',
      gap: '5px',
    },
    tile: {
      width: '45px',
      height: '45px',
      border: '2px solid #3a3a3c',
      backgroundColor: '#121213',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '20px',
      fontWeight: 'bold',
      borderRadius: '4px',
      textTransform: 'uppercase',
    },
    statsContainer: {
      display: 'flex',
      gap: '6px',
      minWidth: '130px',
    },
    statBadge: (bgColor) => ({
      backgroundColor: bgColor,
      color: '#fff',
      padding: '4px 8px',
      borderRadius: '4px',
      fontSize: '14px',
      fontWeight: 'bold',
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
    }),
    message: {
      minHeight: '24px',
      fontSize: '18px',
      fontWeight: 'bold',
      color: '#538d4e',
      marginBottom: '15px',
      textAlign: 'center',
    },
    resetBtn: {
      backgroundColor: '#538d4e',
      color: '#fff',
      border: 'none',
      padding: '10px 20px',
      fontSize: '16px',
      fontWeight: 'bold',
      borderRadius: '4px',
      cursor: 'pointer',
      marginBottom: '20px',
    },
    keyboard: {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      width: '100%',
      maxWidth: '500px',
    },
    kbRow: {
      display: 'flex',
      justifyContent: 'center',
      gap: '6px',
    },
    keyBtn: {
      backgroundColor: '#818384',
      color: '#ffffff',
      border: 'none',
      borderRadius: '4px',
      padding: '12px 10px',
      fontWeight: 'bold',
      cursor: 'pointer',
      fontSize: '14px',
      flex: 1,
      maxWidth: '40px',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
    },
    wideKeyBtn: {
      backgroundColor: '#818384',
      color: '#ffffff',
      border: 'none',
      borderRadius: '4px',
      padding: '12px 10px',
      fontWeight: 'bold',
      cursor: 'pointer',
      fontSize: '12px',
      flex: 1.5,
      maxWidth: '65px',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
    },
  };

  const keyboardRows = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'DELETE'],
  ];

  return (
    <div style={styles.container}>
      <div style={styles.header}>WORD500</div>

      <div style={styles.message}>{message}</div>

      {gameStatus !== 'IN_PROGRESS' && (
        <button style={styles.resetBtn} onClick={startNewGame}>
          Play Again
        </button>
      )}

      {/* Game Board */}
      <div style={styles.board}>
        {Array.from({ length: MAX_ATTEMPTS }).map((_, rIdx) => {
          const guessData = guesses[rIdx];
          const isCurrentRow = rIdx === guesses.length && gameStatus === 'IN_PROGRESS';

          let rowLetters = Array(WORD_LENGTH).fill('');
          if (guessData) {
            rowLetters = guessData.word.split('');
          } else if (isCurrentRow) {
            rowLetters = currentGuess
              .padEnd(WORD_LENGTH, ' ')
              .split('')
              .map((char) => (char === ' ' ? '' : char));
          }

          return (
            <div key={rIdx} style={styles.row}>
              {/* Letters */}
              <div style={styles.lettersContainer}>
                {rowLetters.map((letter, cIdx) => (
                  <div key={cIdx} style={styles.tile}>
                    {letter}
                  </div>
                ))}
              </div>

              {/* Feedback Badges */}
              <div style={styles.statsContainer}>
                {guessData ? (
                  <>
                    <span style={styles.statBadge('#538d4e')}>
                      🟢 {guessData.green}
                    </span>
                    <span style={styles.statBadge('#b59f3b')}>
                      🟡 {guessData.yellow}
                    </span>
                    <span style={styles.statBadge('#3a3a3c')}>
                      🔴 {guessData.red}
                    </span>
                  </>
                ) : (
                  <span style={{ color: '#3a3a3c', fontSize: '14px' }}>
                    ---
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* On-screen Keyboard */}
      <div style={styles.keyboard}>
        {keyboardRows.map((row, rIdx) => (
          <div key={rIdx} style={styles.kbRow}>
            {row.map((key) => {
              const isWide = key === 'ENTER' || key === 'DELETE';
              return (
                <button
                  key={key}
                  style={isWide ? styles.wideKeyBtn : styles.keyBtn}
                  onClick={() => handleVirtualKey(key)}
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