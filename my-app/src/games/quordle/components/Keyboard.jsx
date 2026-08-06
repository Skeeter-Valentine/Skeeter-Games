import React from 'react';

const KEYBOARD_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BACKSPACE']
];

export default function Keyboard({ onKeyPress, letterStatuses }) {
  return (
    <div className="keyboard">
      {KEYBOARD_ROWS.map((row, rowIdx) => (
        <div key={rowIdx} className="keyboard-row">
          {row.map((key) => {
            const isWide = key === 'ENTER' || key === 'BACKSPACE';
            const keyLabel = key === 'BACKSPACE' ? '⌫' : key;
            const statuses = letterStatuses[key] || ['', '', '', ''];

            return (
              <button
                key={key}
                className={`key ${isWide ? 'wide' : ''}`}
                onClick={() => onKeyPress(key)}
              >
                {!isWide && (
                  <div className="key-quadrants">
                    <span className={`quadrant ${statuses[0]}`} />
                    <span className={`quadrant ${statuses[1]}`} />
                    <span className={`quadrant ${statuses[2]}`} />
                    <span className={`quadrant ${statuses[3]}`} />
                  </div>
                )}
                <span className="key-label">{keyLabel}</span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}