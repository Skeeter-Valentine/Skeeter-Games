import DailyResults from '../../components/DailyResults';
import React, { useEffect, useMemo, useRef, useState } from "react";
import "./SkeedleMarathon.css";
import words from "../../constants/words.json";
import Navbar from '../../components/Navbar';

const BOARD_COUNT = 26;
const MAX_GUESSES = 31;
const WORD_LENGTH = 5;

const ANSWERS = (words.answers || [])
  .map((word) => String(word).toUpperCase())
  .filter((word) => word.length === WORD_LENGTH);

const VALID_GUESSES = new Set(
  [...(words.answers || []), ...(words.validGuesses || [])]
    .map((word) => String(word).toUpperCase())
    .filter((word) => word.length === WORD_LENGTH)
);

const KEYBOARD_ROWS = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "BACKSPACE"],
];

const STATUS_RANK = {
  absent: 1,
  present: 2,
  correct: 3,
};

function shuffle(array) {
  const copy = [...array];

  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

function getDaySeed() {
  const dateStr = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash << 5) - hash + dateStr.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function seededShuffle(array, seed) {
  const copy = [...array];
  let currentSeed = seed;

  for (let i = copy.length - 1; i > 0; i -= 1) {
    currentSeed = (currentSeed * 9301 + 49297) % 233280;
    const rnd = currentSeed / 233280;
    const j = Math.floor(rnd * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
}

// Duplicate-letter-safe Wordle scoring.
function scoreGuess(guess, answer) {
  const result = Array(WORD_LENGTH).fill("absent");
  const remaining = {};

  for (let i = 0; i < WORD_LENGTH; i += 1) {
    if (guess[i] === answer[i]) {
      result[i] = "correct";
    } else {
      remaining[answer[i]] = (remaining[answer[i]] || 0) + 1;
    }
  }

  for (let i = 0; i < WORD_LENGTH; i += 1) {
    if (result[i] === "correct") continue;

    const letter = guess[i];

    if ((remaining[letter] || 0) > 0) {
      result[i] = "present";
      remaining[letter] -= 1;
    }
  }

  return result;
}

function buildKeyboardStatusesForBoard(guesses, answer) {
  const statuses = {};

  guesses.forEach((guess) => {
    if (guesses.indexOf(answer) !== -1 && guesses.indexOf(guess) > guesses.indexOf(answer)) {
      return;
    }

    const scores = scoreGuess(guess, answer);

    scores.forEach((status, index) => {
      const letter = guess[index];
      const previous = statuses[letter];

      if (!previous || STATUS_RANK[status] > STATUS_RANK[previous]) {
        statuses[letter] = status;
      }
    });
  });

  return statuses;
}

export default function SkeedleMarathon() {
  const gameRef = useRef(null);
  const boardRefs = useRef({});
  const [gameId, setGameId] = useState(0);
  const [gameMode, setGameMode] = useState("daily"); // Starts on daily mode by default
  const [guesses, setGuesses] = useState([]);
  const [currentGuess, setCurrentGuess] = useState("");
  const [message, setMessage] = useState("");
  const [activeBoardIndex, setActiveBoardIndex] = useState(0);
  const [hiddenBoards, setHiddenBoards] = useState(new Set());
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  const answers = useMemo(() => {
    if (ANSWERS.length < BOARD_COUNT) {
      console.error(
        `Skeedle Marathon requires at least ${BOARD_COUNT} five-letter words in words.json -> answers.`
      );
    }

    if (gameMode === "daily") {
      const seed = getDaySeed();
      return seededShuffle(ANSWERS, seed).slice(0, BOARD_COUNT);
    } else {
      return shuffle(ANSWERS).slice(0, BOARD_COUNT);
    }
  }, [gameId, gameMode]);

  const solvedBoards = useMemo(
    () => answers.map((answer) => guesses.includes(answer)),
    [answers, guesses]
  );

  // Automatically track newly solved boards and hide them
  useEffect(() => {
    solvedBoards.forEach((solved, index) => {
      if (solved && !hiddenBoards.has(index)) {
        setHiddenBoards((prev) => new Set(prev).add(index));
      }
    });
  }, [solvedBoards]);

  const solvedCount = solvedBoards.filter(Boolean).length;
  const gameWon = answers.length === BOARD_COUNT && solvedCount === BOARD_COUNT;
  const gameLost = guesses.length >= MAX_GUESSES && !gameWon;
  const gameOver = gameWon || gameLost;

  // Run game timer (starts only after the first guess is entered)
  useEffect(() => {
    if (gameOver || guesses.length === 0) return;

    const timer = setInterval(() => {
      setSecondsElapsed((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [gameOver, guesses.length]);

  // Ensure activeBoardIndex points to an unsolved board if possible
  useEffect(() => {
    if (!solvedBoards[activeBoardIndex]) return;
    const firstUnsolved = solvedBoards.findIndex((solved) => !solved);
    if (firstUnsolved !== -1) {
      setActiveBoardIndex(firstUnsolved);
    }
  }, [solvedBoards, activeBoardIndex]);

  // Automatically scroll the active board so its bottom is visible above the keyboard shell
  useEffect(() => {
    const activeCard = boardRefs.current[activeBoardIndex];
    if (activeCard) {
      const cardRect = activeCard.getBoundingClientRect();
      const keyboardShell = document.querySelector(".marathon-keyboard-shell");
      const keyboardHeight = keyboardShell ? keyboardShell.offsetHeight : 200;
      
      const targetScrollY = window.scrollY + cardRect.bottom - window.innerHeight + keyboardHeight + 20;

      window.scrollTo({
        top: targetScrollY,
        behavior: "smooth",
      });
    }
  }, [activeBoardIndex]);

  const activeAnswer = answers[activeBoardIndex] || "";

  const keyboardStatuses = useMemo(
    () => buildKeyboardStatusesForBoard(guesses, activeAnswer),
    [guesses, activeAnswer]
  );

  useEffect(() => {
    gameRef.current?.focus();
  }, []);

  function navigateBoards(direction) {
    let nextIndex = activeBoardIndex;
    for (let i = 0; i < BOARD_COUNT; i++) {
      nextIndex = (nextIndex + direction + BOARD_COUNT) % BOARD_COUNT;
      if (!solvedBoards[nextIndex]) {
        setActiveBoardIndex(nextIndex);
        break;
      }
    }
  }

  function submitGuess() {
    if (gameOver) return;

    if (currentGuess.length !== WORD_LENGTH) {
      setMessage("Not enough letters");
      return;
    }

    if (!VALID_GUESSES.has(currentGuess)) {
      setMessage("Not in word list");
      return;
    }

    if (guesses.includes(currentGuess)) {
      setMessage("Already guessed");
      return;
    }

    const nextGuesses = [...guesses, currentGuess];
    setGuesses(nextGuesses);
    setCurrentGuess("");
    setMessage("");

    // If the currently active board was solved by this guess, move to the next unsolved board to the right
    const currentActiveAnswer = answers[activeBoardIndex];
    if (nextGuesses.includes(currentActiveAnswer)) {
      let nextIndex = activeBoardIndex;
      for (let i = 1; i <= BOARD_COUNT; i++) {
        const idx = (activeBoardIndex + i) % BOARD_COUNT;
        if (!nextGuesses.includes(answers[idx])) {
          nextIndex = idx;
          break;
        }
      }
      setActiveBoardIndex(nextIndex);
    }
  }

  function handleKey(key) {
    if (gameOver) return;

    if (key === "ENTER") {
      submitGuess();
      return;
    }

    if (key === "BACKSPACE") {
      setCurrentGuess((previous) => previous.slice(0, -1));
      setMessage("");
      return;
    }

    if (/^[A-Z]$/.test(key) && currentGuess.length < WORD_LENGTH) {
      setCurrentGuess((previous) => previous + key);
      setMessage("");
    }
  }

  function handlePhysicalKeyboard(event) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    if (event.key === "Enter") {
      event.preventDefault();
      handleKey("ENTER");
      return;
    }

    if (event.key === "Backspace") {
      event.preventDefault();
      handleKey("BACKSPACE");
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      navigateBoards(1);
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      navigateBoards(-1);
      return;
    }

    const key = event.key.toUpperCase();

    if (/^[A-Z]$/.test(key)) {
      handleKey(key);
    }
  }

  function resetGame() {
    setGuesses([]);
    setCurrentGuess("");
    setMessage("");
    setActiveBoardIndex(0);
    setHiddenBoards(new Set());
    setSecondsElapsed(0);
    setGameId((previous) => previous + 1);

    requestAnimationFrame(() => {
      gameRef.current?.focus();
    });
  }

  if (ANSWERS.length < BOARD_COUNT) {
    return (
      <main className="skeedle-marathon skeedle-marathon--error">
        <div className="error-card">
          <h1>Skeedle Marathon</h1>
          <p>
            Your word bank needs at least {BOARD_COUNT} five-letter entries in
            <code> words.json → answers</code>.
          </p>
        </div>
      </main>
    );
  }

  // Determine if any letter positions are already locked in as correct on the active board
  const lockedLetters = useMemo(() => {
    const locked = Array(WORD_LENGTH).fill("");
    guesses.forEach((guess) => {
      const scores = scoreGuess(guess, activeAnswer);
      scores.forEach((status, idx) => {
        if (status === "correct") {
          locked[idx] = guess[idx];
        }
      });
    });
    return locked;
  }, [guesses, activeAnswer]);

  return (
    <>
      <Navbar />
      <DailyResults gameId="skeedle-marathon" title="Skeedle Marathon" daily={gameMode === 'daily'} finished={gameOver} won={gameWon} seconds={secondsElapsed} ready={answers.length === BOARD_COUNT} />
      <main
        className="skeedle-marathon"
        ref={gameRef}
        tabIndex={0}
        onKeyDown={handlePhysicalKeyboard}
      >
        <header className="marathon-header">
          <div className="marathon-header__inner">
            <h1 className="marathon-title">
              <span>SKEEDLE</span> MARATHON
            </h1>

            <div className="marathon-mode-selector">
              <button
                type="button"
                className={`mode-btn ${gameMode === "daily" ? "is-active" : ""}`}
                onClick={() => {
                  setGameMode("daily");
                  resetGame();
                }}
              >
                Daily
              </button>
              <button
                type="button"
                className={`mode-btn ${gameMode === "practice" ? "is-active" : ""}`}
                onClick={() => {
                  setGameMode("practice");
                  resetGame();
                }}
              >
                Practice
              </button>
            </div>

            <div className="marathon-stats">
              <div>
                SOLVED{" "}
                <strong>
                  {solvedCount}/{BOARD_COUNT}
                </strong>
              </div>

              <div>
                GUESSES{" "}
                <strong>
                  {guesses.length}/{MAX_GUESSES}
                </strong>
              </div>

              <div>
                TIME{" "}
                <strong>
                  {formatTime(secondsElapsed)}
                </strong>
              </div>

              <div>
                LEFT <strong>{MAX_GUESSES - guesses.length}</strong>
              </div>
            </div>
          </div>

          <div className="marathon-message" aria-live="polite">
            {message}
          </div>
        </header>

        <section className="marathon-boards">
          {answers.map((answer, boardIndex) => {
            const solved = solvedBoards[boardIndex];

            if (hiddenBoards.has(boardIndex)) {
              return null;
            }

            const isActive = boardIndex === activeBoardIndex && !solved && !gameOver;

            return (
              <article
                className={`marathon-board-card ${solved ? "is-solved" : ""} ${
                  isActive ? "is-active-board" : ""
                }`}
                key={`${gameId}-${boardIndex}`}
                ref={(el) => {
                  if (el) boardRefs.current[boardIndex] = el;
                  else delete boardRefs.current[boardIndex];
                }}
                onClick={() => {
                  if (!solved && !gameOver) {
                    setActiveBoardIndex(boardIndex);
                  }
                }}
                style={{ cursor: !solved && !gameOver ? "pointer" : "default" }}
              >
                <div className="marathon-board-heading">
                  <span>
                    BOARD {boardIndex + 1} {isActive ? " (ACTIVE)" : ""}
                  </span>
                  {solved && <span className="solved-label">✓ SOLVED</span>}
                </div>

                <div className="marathon-board-scroll">
                  <div className="marathon-board">
                    {guesses.map((guess, guessIndex) => {
                      const wasAlreadySolved = guesses
                        .slice(0, guessIndex)
                        .includes(answer);

                      if (wasAlreadySolved) return null;

                      const scores = scoreGuess(guess, answer);

                      return (
                        <div
                          className="marathon-row"
                          key={`${guess}-${guessIndex}`}
                        >
                          {guess.split("").map((letter, letterIndex) => (
                            <div
                              className={`marathon-tile ${scores[letterIndex]}`}
                              key={`${letter}-${letterIndex}`}
                            >
                              {letter}
                            </div>
                          ))}
                        </div>
                      );
                    })}

                    {isActive && !gameOver && (
                      <div className="marathon-row current-row">
                        {Array.from({ length: WORD_LENGTH }).map((_, index) => {
                          const typedChar = currentGuess[index];
                          const lockedChar = lockedLetters[index];
                          const displayChar = typedChar || lockedChar;
                          const isLocked = !typedChar && lockedChar;

                          return (
                            <div
                              className={`marathon-tile current ${
                                displayChar ? "has-letter" : ""
                              } ${isLocked ? "ghost" : ""}`}
                              key={index}
                            >
                              {displayChar}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        {!gameOver && (
          <div className="marathon-keyboard-shell">
            <div className="current-guess">
              Active Board #{activeBoardIndex + 1}: {currentGuess}
            </div>

            <div className="marathon-keyboard">
              {KEYBOARD_ROWS.map((row, rowIndex) => (
                <div className="keyboard-row" key={rowIndex}>
                  {row.map((key) => {
                    const status =
                      key.length === 1 ? keyboardStatuses[key] || "" : "";
                    const label = key === "BACKSPACE" ? "⌫" : key;

                    return (
                      <button
                        type="button"
                        className={`keyboard-key ${
                          key.length > 1 ? "keyboard-key--wide" : ""
                        } ${status}`}
                        key={key}
                        onClick={() => handleKey(key)}
                        aria-label={key === "BACKSPACE" ? "Backspace" : key}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        {gameOver && (
          <div className="marathon-overlay">
            <section className="marathon-modal">
              <h2>{gameWon ? "MARATHON COMPLETE!" : "MARATHON OVER"}</h2>

              <p>
                You solved <strong>{solvedCount}</strong> of{" "}
                <strong>{BOARD_COUNT}</strong> boards in{" "}
                <strong>{guesses.length}</strong> guesses and{" "}
                <strong>{formatTime(secondsElapsed)}</strong>!
              </p>

              {!gameWon && (
                <>
                  <p className="answer-heading">The answers were:</p>

                  <div className="answer-list">
                    {answers.map((answer, index) => (
                      <span
                        className={`answer-chip ${
                          solvedBoards[index] ? "was-solved" : ""
                        }`}
                        key={`${answer}-${index}`}
                      >
                        {index + 1}. {answer}
                      </span>
                    ))}
                  </div>
                </>
              )}

              <button
                type="button"
                className="new-marathon-button"
                onClick={resetGame}
              >
                NEW MARATHON
              </button>
            </section>
          </div>
        )}
      </main>
    </>
  );
}