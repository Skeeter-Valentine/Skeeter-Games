import { useEffect, useState } from 'react';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { firebaseServices } from '../services/firebase.js';
import { boardEnabled } from '../services/gauntletBoard.js';
import { pepperWeek } from '../gauntlet/gauntlet.js';
import './PepperBoard.css';

// "This week's top pepper pickers": the top 20 players by peppers earned this
// week, scrolling right to left about five at a time.
//
// Peppers: a solved daily puzzle earns its chili rating, solved gauntlet games
// earn theirs, and finishing a gauntlet adds 5 (see functions/peppers.js).
// Real totals load once the leaderboard is on (VITE_GAUNTLET_BOARD_ENABLED);
// players without a nickname aren't listed. Mock players show instead with
// ?peppers=mock, or in local development while the leaderboard is off.

const MOCK_NAMES = ['PepperQueen', 'Skeetmaster', 'HotHashi', 'NonoNinja', 'GridLocked', 'Chili Dog', 'LogicLlama', 'Sk3dle_Pro',
  'BulbBrain', 'MapMaven', 'QuadWordy', 'PipeDream', 'MineFinder', 'Stitchy', 'Beadazzled', 'RectRanger', 'Ghost Pepper', 'Jalapeno Jo',
  'SudokuSam', 'Habanero'];
export function mockPepperBoard() {
  let total = 214;
  return MOCK_NAMES.map((nickname, index) => {
    total -= 3 + ((index * 7) % 9);
    return { uid: `mock-${index}`, nickname, peppers: total };
  });
}

function showMock() {
  if (typeof window === 'undefined') return false;
  return import.meta.env.DEV || new URLSearchParams(window.location.search).get('peppers') === 'mock';
}

async function readPepperBoard() {
  if (new URLSearchParams(window.location.search).get('peppers') === 'mock') return mockPepperBoard();
  if (!boardEnabled) return showMock() ? mockPepperBoard() : [];
  const snapshot = await getDocs(query(collection(firebaseServices().db, 'pepperWeeks', pepperWeek(), 'players'), orderBy('peppers', 'desc'), limit(100)));
  return snapshot.docs.map(item => ({ uid: item.id, ...item.data() })).filter(entry => entry.nickname && entry.peppers > 0);
}

function Chili() {
  return <svg className="pepper-chili" viewBox="0 0 32 40" aria-hidden="true" focusable="false">
    <path d="M19 11C25 9 29 13 28 20C26 30 17 36 4 37C13 32 14 27 14 20C14 16 15 12 19 11Z" fill="#ed383f" stroke="#251722" strokeWidth="2" strokeLinejoin="round" />
    <path d="M17 13L20 9C19 5 21 2 25 2L26 6C23 6 23 8 24 10L27 13L22 12L20 15Z" fill="#54a64b" stroke="#251722" strokeWidth="2" strokeLinejoin="round" />
  </svg>;
}

function Entry({ entry, rank }) {
  return <li className={`pepper-entry${rank <= 3 ? ` pepper-top pepper-top-${rank}` : ''}`}>
    <span className="pepper-rank">{rank}</span>
    <span className="pepper-name">{entry.nickname}</span>
    <span className="pepper-count"><Chili />{entry.peppers.toLocaleString()}</span>
  </li>;
}

export default function PepperBoard() {
  // null: loading or unavailable (hidden); []: nobody has peppers yet this week.
  const [entries, setEntries] = useState(null);
  useEffect(() => {
    let active = true;
    readPepperBoard().then(list => { if (active) setEntries(list.slice(0, 20)); }).catch(() => {});
    return () => { active = false; };
  }, []);
  if (!entries || (!entries.length && !boardEnabled)) return null;
  const heading = <h2 id="pepper-board-title"><Chili /> This week's top pepper pickers <Chili /></h2>;
  if (!entries.length) return <section className="pepper-board" aria-labelledby="pepper-board-title">
    {heading}
    <p className="pepper-empty">No peppers picked yet this week. Solve today's puzzles to claim the top spot!</p>
  </section>;
  const list = entries.map((entry, index) => <Entry key={entry.uid} entry={entry} rank={index + 1} />);
  // A short list sits still in the middle; five or more players scroll.
  const scrolls = entries.length >= 5;
  return <section className="pepper-board" aria-labelledby="pepper-board-title">
    {heading}
    <div className={`pepper-window${scrolls ? '' : ' pepper-still'}`}>
      {/* The list runs twice so the scroll loops without a gap; the copy is hidden from screen readers. */}
      <div className="pepper-track" style={{ '--pepper-count': entries.length }}>
        <ol className="pepper-list">{list}</ol>
        {scrolls && <ol className="pepper-list" aria-hidden="true">{list}</ol>}
      </div>
    </div>
  </section>;
}
