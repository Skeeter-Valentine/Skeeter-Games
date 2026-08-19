import React from 'react';

const KEYBOARD_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BACKSPACE']
];

export default function Keyboard({ onKeyPress }) {
  return (
    <div className="word500-keyboard">
      {KEYBOARD_ROWS.map((row, rowIdx) => (
        <div key={rowIdx} className="word500-keyboard-row">
          {row.map((key) => {
            const isWide = key === 'ENTER' || key === 'BACKSPACE';
            const keyLabel = key === 'BACKSPACE' ? '⌫' : key;

            return (
              <button
                key={key}
                className={`word500-key ${isWide ? 'wide' : ''}`}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onKeyPress(key);
                }}
              >
                <span className="key-label">{keyLabel}</span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}