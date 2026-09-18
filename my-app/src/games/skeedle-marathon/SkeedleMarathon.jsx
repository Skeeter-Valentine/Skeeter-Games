import React, { useEffect, useMemo, useRef, useState } from "react";
import "./SkeedleMarathon.css";
import words from "../../constants/words.json";

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

function buildKeyboardStatuses(guesses, answers, solvedBoards) {
  const statuses = {};

  guesses.forEach((guess, guessIndex) => {
    answers.forEach((answer, boardIndex) => {
      // Ignore feedback after this particular board had already been solved.
      const priorGuesses = guesses.slice(0, guessIndex);
      if (priorGuesses.includes(answer)) return;

      const scores = scoreGuess(guess, answer);

      scores.forEach((status, index) => {
        const letter = guess[index];
        const previous = statuses[letter];

        if (!previous || STATUS_RANK[status] > STATUS_RANK[previous]) {
          statuses[letter] = status;
        }
      });
    });
  });

  return statuses;
}

export default function SkeedleMarathon() {
  const gameRef = useRef(null);
  const [gameId, setGameId] = useState(0);
  const [guesses, setGuesses] = useState([]);
  const [currentGuess, setCurrentGuess] = useState("");
  const [message, setMessage] = useState("");

  const answers = useMemo(() => {
    if (ANSWERS.length < BOARD_COUNT) {
      console.error(
        `Skeedle Marathon requires at least ${BOARD_COUNT} five-letter words in words.json -> answers.`
      );
    }

    return shuffle(ANSWERS).slice(0, BOARD_COUNT);
  }, [gameId]);

  const solvedBoards = useMemo(
    () => answers.map((answer) => guesses.includes(answer)),
    [answers, guesses]
  );

  const solvedCount = solvedBoards.filter(Boolean).length;
  const gameWon = answers.length === BOARD_COUNT && solvedCount === BOARD_COUNT;
  const gameLost = guesses.length >= MAX_GUESSES && !gameWon;
  const gameOver = gameWon || gameLost;

  const keyboardStatuses = useMemo(
    () => buildKeyboardStatuses(guesses, answers, solvedBoards),
    [guesses, answers, solvedBoards]
  );

  useEffect(() => {
    gameRef.current?.focus();
  }, []);

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

    setGuesses((previous) => [...previous, currentGuess]);
    setCurrentGuess("");
    setMessage("");
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

    const key = event.key.toUpperCase();

    if (/^[A-Z]$/.test(key)) {
      handleKey(key);
    }
  }

  function resetGame() {
    setGuesses([]);
    setCurrentGuess("");
    setMessage("");
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

  return (
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

          return (
            <article
              className={`marathon-board-card ${solved ? "is-solved" : ""}`}
              key={`${gameId}-${boardIndex}`}
            >
              <div className="marathon-board-heading">
                <span>BOARD {boardIndex + 1}</span>
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

                  {!solved && !gameOver && (
                    <div className="marathon-row current-row">
                      {Array.from({ length: WORD_LENGTH }).map((_, index) => (
                        <div
                          className={`marathon-tile current ${
                            currentGuess[index] ? "has-letter" : ""
                          }`}
                          key={index}
                        >
                          {currentGuess[index] || ""}
                        </div>
                      ))}
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
          <div className="current-guess">{currentGuess}</div>

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
              <strong>{guesses.length}</strong> guesses.
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
  );
}