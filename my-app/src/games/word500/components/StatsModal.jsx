// src/games/word500/components/StatsModal.jsx
import React from 'react';

export default function StatsModal({ isOpen, onClose, stats }) {
  if (!isOpen) return null;

  const { played, wins, currentStreak, maxStreak, guessDistribution } = stats;
  const winPercentage = played > 0 ? Math.round((wins / played) * 100) : 0;
  const maxGuessesCount = Math.max(...Object.values(guessDistribution), 1);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        <h3>STATISTICS</h3>

        <div className="stats-grid">
          <div className="stat-box">
            <span className="stat-value">{played}</span>
            <span className="stat-label">Played</span>
          </div>
          <div className="stat-box">
            <span className="stat-value">{winPercentage}%</span>
            <span className="stat-label">Win %</span>
          </div>
          <div className="stat-box">
            <span className="stat-value">{currentStreak}</span>
            <span className="stat-label">Current Streak</span>
          </div>
          <div className="stat-box">
            <span className="stat-value">{maxStreak}</span>
            <span className="stat-label">Max Streak</span>
          </div>
        </div>

        <h4>GUESS DISTRIBUTION</h4>
        <div className="guess-distribution">
          {Object.keys(guessDistribution).map((guessNum) => {
            const count = guessDistribution[guessNum];
            const barWidth = Math.max((count / maxGuessesCount) * 100, 8);

            return (
              <div key={guessNum} className="dist-row">
                <span className="dist-num">{guessNum}</span>
                <div className="dist-bar-container">
                  <div className="dist-bar" style={{ width: `${barWidth}%` }}>
                    {count}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}