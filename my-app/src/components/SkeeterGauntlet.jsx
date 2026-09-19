// src/components/SkeeterGauntlet.jsx
import React, { useState, useEffect } from 'react';
import { getDailyGauntletGames } from '../utils/gauntletUtils';

export default function SkeeterGauntlet({ allGames }) {
  const [dailyGames, setDailyGames] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0); // in milliseconds
  const [isCompleted, setIsCompleted] = useState(false);
  const [splitTimes, setSplitTimes] = useState([]);

  // Initialize today's 5 games on mount
  useEffect(() => {
    const selected = getDailyGauntletGames(allGames);
    setDailyGames(selected);
  }, [allGames]);

  // Global stopwatch ticker
  useEffect(() => {
    let interval = null;
    if (isRunning && !isCompleted) {
      const startTime = performance.now() - elapsedTime;
      interval = setInterval(() => {
        setElapsedTime(performance.now() - startTime);
      }, 50);
    }
    return () => clearInterval(interval);
  }, [isRunning, isCompleted]);

  const handleStartGauntlet = () => {
    setIsRunning(true);
  };

  // Called by the current game when the player wins/finishes it
  const handleGameComplete = () => {
    const gameTime = elapsedTime;
    setSplitTimes((prev) => [...prev, gameTime]);

    if (currentIndex + 1 < dailyGames.length) {
      // Advance to next game
      setCurrentIndex((prev) => prev + 1);
    } else {
      // Gauntlet Finished!
      setIsRunning(false);
      setIsCompleted(true);
    }
  };

  // Format milliseconds into MM:SS.SS
  const formatTime = (ms) => {
    const totalSeconds = ms / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = (totalSeconds % 60).toFixed(2);
    return `${minutes}:${seconds.padStart(5, '0')}`;
  };

  if (dailyGames.length === 0) return <div>Loading Gauntlet...</div>;

  const ActiveGameComponent = dailyGames[currentIndex]?.component;

  return (
    <div className="skeeter-gauntlet">
      {/* Top HUD / Overlay Bar */}
      <div className="gauntlet-hud">
        <div className="gauntlet-progress">
          Game <strong>{currentIndex + 1}</strong> of 5
        </div>
        <div className="gauntlet-timer">
          TIME: <span>{formatTime(elapsedTime)}</span>
        </div>
      </div>

      {/* Start Screen Modal */}
      {!isRunning && !isCompleted && (
        <div className="gauntlet-overlay">
          <div className="gauntlet-modal">
            <h2>Skeeter Gauntlet</h2>
            <p>You will play 5 random daily games back-to-back. Your global timer won't stop until all 5 are conquered!</p>
            <button className="gauntlet-btn" onClick={handleStartGauntlet}>
              START GAUNTLET
            </button>
          </div>
        </div>
      )}

      {/* Active Game Container */}
      {isRunning && !isCompleted && ActiveGameComponent && (
        <div className="gauntlet-game-container">
          <ActiveGameComponent onWin={handleGameComplete} />
        </div>
      )}

      {/* Completion Modal */}
      {isCompleted && (
        <div className="gauntlet-overlay">
          <div className="gauntlet-modal">
            <h2>Gauntlet Conquered! 🎉</h2>
            <p>Total Time: <strong>{formatTime(elapsedTime)}</strong></p>
            <div className="split-times-list">
              {splitTimes.map((split, idx) => (
                <div key={idx} className="split-chip">
                  Game {idx + 1}: {formatTime(split)}
                </div>
              ))}
            </div>
            <button className="gauntlet-btn" onClick={() => window.location.reload()}>
              PLAY AGAIN TOMORROW
            </button>
          </div>
        </div>
      )}
    </div>
  );
}