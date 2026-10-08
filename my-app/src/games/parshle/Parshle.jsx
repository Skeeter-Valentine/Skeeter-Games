import { useDailyDate, useArchive } from '../../components/DailyBoundary';
import { useEffect, useState } from 'react';
import Navbar from '../../components/Navbar';
import DailyResults from '../../components/DailyResults';
import { readLocal, writeLocal } from '../../utils/dailyStats';
import { getParshleDailyTargetWord, getRandomTargetWord, isValidWord } from '../word500/constants/wordBank';
import { hiddenPositions, keyboardFeedback, visibleFeedback } from './logic';
import './Parshle.css';
import { puzzleSnapshot } from '../../utils/archive.js';
import { useColorblind } from '../../components/colorblind.js';

export default function Parshle() {
  const [mode, setMode] = useState('daily');
  const [round, setRound] = useState(0);
  const date = useDailyDate();
  const archive = !!useArchive()?.archive;
  return <main className="parshle"><Navbar /><h1>PARSHLE</h1>
    <p className="parshle-tagline">Some clues stay in the dark.</p>
    <div className="parshle-controls">
      <button aria-pressed={mode === 'daily'} onClick={() => setMode('daily')}>{archive ? 'Archive puzzle' : 'Daily'}</button>
      <button aria-pressed={mode === 'random'} onClick={() => setMode('random')}>Random</button>
      {mode === 'random' && <button onClick={() => setRound(n => n + 1)}>New game</button>}
    </div>
    <Session key={`${mode}:${round}`} daily={mode === 'daily'} date={date} />
  </main>;
}

function Session({ daily, date }) {
  const [colorblind] = useColorblind();
  const archive = !!useArchive()?.archive;
  const storageKey = `${archive ? 'archive:v1:' : ''}parshle:v2:${date}`;
  const [puzzle] = useState(() => {
    const generate = () => {
      const seed = daily ? `parshle:${date}` : String(Math.random());
      return { answer: daily ? getParshleDailyTargetWord(date) : getRandomTargetWord(), seed,
        masks: Array.from({ length: 6 }, (_, row) => hiddenPositions(seed, row)) };
    };
    return daily ? puzzleSnapshot('parshle', date, generate) : generate();
  });
  const { answer, seed, masks } = puzzle;
  const [guesses, setGuesses] = useState(() => {
    const saved = daily ? readLocal(storageKey, []) : [];
    return Array.isArray(saved) && saved.length <= 6 && saved.every(word => typeof word === 'string' && /^[A-Z]{5}$/.test(word) && isValidWord(word)) ? saved : [];
  });
  const [input, setInput] = useState('');
  const [message, setMessage] = useState('');
  const [started, setStarted] = useState(() => guesses.length > 0);
  const won = guesses.includes(answer);
  const finished = won || guesses.length === 6;
  const keys = keyboardFeedback(guesses, answer, seed, masks);

  useEffect(() => { if (daily) writeLocal(storageKey, guesses); }, [daily, storageKey, guesses]);

  function press(key) {
    if (finished) return;
    if (/^[a-z]$/i.test(key)) {
      setStarted(true);
      setMessage('');
      setInput(value => (value + key.toUpperCase()).slice(0, 5));
    } else if (key === 'Backspace') setInput(value => value.slice(0, -1));
    else if (key === 'Enter') {
      if (input.length !== 5) return setMessage('Enter five letters.');
      if (!isValidWord(input)) return setMessage('That word is not in the word list.');
      setGuesses([...guesses, input]);
      setInput('');
      setMessage('');
    }
  }

  useEffect(() => {
    const listener = event => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.target.closest?.('input, textarea, select, [contenteditable="true"], [role="dialog"]') || document.querySelector('[role="dialog"]')) return;
      if (event.key === 'Enter' && event.target.closest?.('button, a')) return;
      if (/^[a-z]$/i.test(event.key) || ['Enter', 'Backspace'].includes(event.key)) {
        event.preventDefault();
        press(event.key);
      }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  });

  return <>
    <DailyResults gameId="parshle" title="Parshle" daily={daily} date={date} finished={finished} won={won} started={started} />
    <div className="parshle-board" aria-label="Parshle guess board">
      {Array.from({ length: 6 }, (_, row) => {
        const guess = guesses[row];
        const letters = guess || (row === guesses.length ? input : '');
        const hidden = masks[row];
        const winningRow = guess === answer;
        const colors = winningRow ? Array(5).fill('correct') : guess ? visibleFeedback(guess, answer, seed, row, masks)
          : Array.from({ length: 5 }, (_, col) => hidden.includes(col) ? 'hidden' : '');
        return <div className="parshle-row" key={row} aria-label={`Guess ${row + 1}`}>
          {Array.from({ length: 5 }, (_, col) => <span key={col} className={`parshle-tile ${colors[col] || ''}${winningRow && hidden.includes(col) ? ' formerly-hidden' : ''}`} aria-label={`${letters[col] || 'Empty'}${colors[col] ? `: ${colors[col] === 'hidden' ? 'feedback hidden' : colors[col]}` : ''}`}>{letters[col]}</span>)}
        </div>;
      })}
    </div>
    <p className="parshle-message" role="status">{finished ? won ? `You solved it in ${guesses.length}! The word was ${answer}.` : `The word was ${answer}. Try another in Random mode.` : message || 'Each board hides 5–12 cells across the first five guesses.'}</p>
    <div className="parshle-keyboard" aria-label="On-screen keyboard">
      {['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'].map((row, i) => <div key={row}>
        {i === 2 && <button disabled={finished} onClick={() => press('Enter')}>Enter</button>}
        {[...row].map(letter => <button key={letter} disabled={finished} className={keys[letter] || ''} aria-label={`${letter}${keys[letter] ? `: ${keys[letter]}` : ''}`} onClick={() => press(letter)}>{letter}</button>)}
        {i === 2 && <button disabled={finished} aria-label="Backspace" onClick={() => press('Backspace')}>⌫</button>}
      </div>)}
    </div>
    <p className="parshle-legend">{colorblind ? <>Orange: right spot · Blue: wrong spot<br />Gray: absent · Black: hidden feedback</> : <>Green: right spot · Yellow: wrong spot<br />Pink: absent · Black: hidden feedback</>}</p>
  </>;
}
