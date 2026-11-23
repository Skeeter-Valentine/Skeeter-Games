import { collection, doc, getCountFromServer, getDoc, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { firebaseServices } from './firebase.js';
import { boardEnabled } from './gauntletBoard.js';
import { puzzleLoggingEnabled } from './puzzleResults.js';

// Fastest solve times for one game's daily puzzle. The server writes them when
// a player first solves today's puzzle (functions/dailyBoard.js).
export const dailyBoardEnabled = boardEnabled && puzzleLoggingEnabled;
export const DAILY_BOARD_SIZE = 20;
const entries = (game, date) => collection(firebaseServices().db, 'dailyBoard', `${game}_${date}`, 'entries');

const MOCK_NAMES = ['PepperQueen', 'Skeetmaster', 'HotHashi', 'NonoNinja', 'GridLocked', 'Chili Dog', 'LogicLlama', 'Sk3dle_Pro', 'BulbBrain', 'MapMaven', 'QuadWordy', 'PipeDream'];
export const mockBoard = () => MOCK_NAMES.map((nickname, index) => ({ uid: `mock-${index}`, nickname, seconds: 48 + index * 17 + (index * index) % 11 }));
export const showMockBoard = () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('leaders') === 'mock';

// Games whose board ranks by wrong moves first (fewest first), then time.
// Entries carry `mistakes` (missing on entries from before it was recorded).
export const MISTAKE_GAMES = ['chess'];
const byMistakes = (a, b) => (a.mistakes ?? 0) - (b.mistakes ?? 0) || a.seconds - b.seconds;

// Top times (players without a nickname are left out) plus, when you're on
// the board but outside the top, your own entry and place.
export async function readDailyBoard(game, date, uid) {
  if (showMockBoard()) return { entries: mockBoard().map((entry, i) => (MISTAKE_GAMES.includes(game) ? { ...entry, mistakes: i % 4 === 3 ? 1 : 0 } : entry)).sort(MISTAKE_GAMES.includes(game) ? byMistakes : () => 0), mine: null };
  if (MISTAKE_GAMES.includes(game)) {
    // A day's board is small enough to read whole and rank here.
    const snapshot = await getDocs(query(entries(game, date), orderBy('seconds'), limit(1000)));
    const ranked = snapshot.docs.map(item => ({ uid: item.id, ...item.data() })).filter(entry => entry.nickname).sort(byMistakes);
    const list = ranked.slice(0, DAILY_BOARD_SIZE);
    const index = uid ? ranked.findIndex(entry => entry.uid === uid) : -1;
    return { entries: list, mine: index >= DAILY_BOARD_SIZE ? { ...ranked[index], rank: index + 1 } : null };
  }
  const snapshot = await getDocs(query(entries(game, date), orderBy('seconds'), limit(60)));
  const list = snapshot.docs.map(item => ({ uid: item.id, ...item.data() })).filter(entry => entry.nickname).slice(0, DAILY_BOARD_SIZE);
  let mine = null;
  if (uid && !list.some(entry => entry.uid === uid)) {
    const own = await getDoc(doc(entries(game, date), uid));
    if (own.exists() && own.data().nickname) {
      const faster = await getCountFromServer(query(entries(game, date), where('seconds', '<', own.data().seconds)));
      mine = { uid, ...own.data(), rank: faster.data().count + 1 };
    }
  }
  return { entries: list, mine };
}
