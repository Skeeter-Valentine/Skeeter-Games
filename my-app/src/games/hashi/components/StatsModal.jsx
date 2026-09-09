// src/games/hashi/components/StatsModal.jsx
import React from 'react';

export default function StatsModal({ isOpen, onClose, stats, time }) {
    if (!isOpen) return null;

    const { played, wins, currentStreak, maxStreak } = stats;
    const winPercentage = played > 0 ? Math.round((wins / played) * 100) : 0;

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

                {time && (
                    <div className="stats-time-container" style={{ marginTop: '20px', textAlign: 'center' }}>
                        <span className="stat-label">Time</span>
                        <div className="stat-value" style={{ fontSize: '20px', marginTop: '4px' }}>{time}</div>
                    </div>
                )}
            </div>
        </div>
    );
}