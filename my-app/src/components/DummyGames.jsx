import React from 'react';

// A simple mock game where the user just clicks a button to "win"
export function MockGame1({ onWin }) {
  return (
    <div style={{ padding: '40px', textAlign: 'center', color: '#fff' }}>
      <h3>Game 1: Quick Click Challenge</h3>
      <p>Click the button below to solve this game instantly!</p>
      <button onClick={onWin} className="gauntlet-btn" style={{ padding: '10px 20px', cursor: 'pointer' }}>
        SOLVE GAME 1
      </button>
    </div>
  );
}

export function MockGame2({ onWin }) {
  return (
    <div style={{ padding: '40px', textAlign: 'center', color: '#fff' }}>
      <h3>Game 2: Speed Reaction</h3>
      <p>Hit the button to move to the next stage.</p>
      <button onClick={onWin} className="gauntlet-btn" style={{ padding: '10px 20px', cursor: 'pointer' }}>
        SOLVE GAME 2
      </button>
    </div>
  );
}