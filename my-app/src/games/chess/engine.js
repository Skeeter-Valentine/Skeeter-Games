// A small, complete chess rules engine for the puzzles: FEN in and out, every
// legal move (castling, en passant, promotion), check, checkmate and
// stalemate, and move names in UCI ("e2e4") and SAN ("Nxf7+").
//
// Squares are 0-63 in FEN order: a8 = 0, h8 = 7, a1 = 56, h1 = 63. Pieces are
// FEN letters: uppercase white, lowercase black, null for empty.

export const FILES = 'abcdefgh';
export const squareName = sq => `${FILES[sq % 8]}${8 - Math.floor(sq / 8)}`;
export const squareIndex = name => (8 - Number(name[1])) * 8 + FILES.indexOf(name[0]);
export const colorOf = piece => piece ? (piece === piece.toUpperCase() ? 'w' : 'b') : null;
const rankOf = sq => Math.floor(sq / 8), fileOf = sq => sq % 8;
const onBoard = (r, f) => r >= 0 && r < 8 && f >= 0 && f < 8;

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export function parseFen(fen) {
  const [placement, turn = 'w', castling = '-', ep = '-', half = '0', full = '1'] = String(fen).trim().split(/\s+/);
  const rows = placement.split('/');
  if (rows.length !== 8) throw new Error(`Bad FEN: ${fen}`);
  const board = [];
  for (const row of rows) {
    for (const char of row) {
      if (/[1-8]/.test(char)) for (let i = 0; i < Number(char); i++) board.push(null);
      else if (/[pnbrqkPNBRQK]/.test(char)) board.push(char);
      else throw new Error(`Bad FEN: ${fen}`);
    }
    if (board.length % 8) throw new Error(`Bad FEN: ${fen}`);
  }
  if (board.length !== 64 || !['w', 'b'].includes(turn)) throw new Error(`Bad FEN: ${fen}`);
  return { board, turn, castling: castling === '-' ? '' : castling, ep: ep === '-' ? -1 : squareIndex(ep),
    half: Number(half) || 0, full: Number(full) || 1 };
}

export function toFen(pos) {
  const rows = [];
  for (let r = 0; r < 8; r++) {
    let row = '', empty = 0;
    for (let f = 0; f < 8; f++) {
      const piece = pos.board[r * 8 + f];
      if (!piece) { empty++; continue; }
      if (empty) { row += empty; empty = 0; }
      row += piece;
    }
    rows.push(row + (empty || ''));
  }
  return `${rows.join('/')} ${pos.turn} ${pos.castling || '-'} ${pos.ep >= 0 ? squareName(pos.ep) : '-'} ${pos.half} ${pos.full}`;
}

const KNIGHT = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
const KING = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const ROOK = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const BISHOP = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

// Is `sq` attacked by any piece of color `by`?
export function attacked(board, sq, by) {
  const r = rankOf(sq), f = fileOf(sq);
  const own = p => p && colorOf(p) === by;
  // Pawns attack diagonally forward (white moves toward rank index 0).
  const pr = by === 'w' ? r + 1 : r - 1;
  for (const df of [-1, 1]) if (onBoard(pr, f + df)) { const p = board[pr * 8 + f + df]; if (own(p) && p.toLowerCase() === 'p') return true; }
  for (const [dr, df] of KNIGHT) if (onBoard(r + dr, f + df)) { const p = board[(r + dr) * 8 + f + df]; if (own(p) && p.toLowerCase() === 'n') return true; }
  for (const [dr, df] of KING) if (onBoard(r + dr, f + df)) { const p = board[(r + dr) * 8 + f + df]; if (own(p) && p.toLowerCase() === 'k') return true; }
  const slide = (dirs, kinds) => dirs.some(([dr, df]) => {
    for (let rr = r + dr, ff = f + df; onBoard(rr, ff); rr += dr, ff += df) {
      const p = board[rr * 8 + ff];
      if (!p) continue;
      return own(p) && kinds.includes(p.toLowerCase());
    }
    return false;
  });
  return slide(ROOK, 'rq') || slide(BISHOP, 'bq');
}

export const kingSquare = (board, color) => board.indexOf(color === 'w' ? 'K' : 'k');
export const inCheck = pos => attacked(pos.board, kingSquare(pos.board, pos.turn), pos.turn === 'w' ? 'b' : 'w');

// Moves that obey how pieces move, before checking the king is safe.
function pseudoMoves(pos) {
  const { board, turn } = pos;
  const moves = [];
  const enemy = turn === 'w' ? 'b' : 'w';
  const add = (from, to, extra = {}) => moves.push({ from, to, piece: board[from], captured: board[to], ...extra });
  for (let from = 0; from < 64; from++) {
    const piece = board[from];
    if (!piece || colorOf(piece) !== turn) continue;
    const r = rankOf(from), f = fileOf(from), kind = piece.toLowerCase();
    if (kind === 'p') {
      const dir = turn === 'w' ? -1 : 1, startRank = turn === 'w' ? 6 : 1, lastRank = turn === 'w' ? 0 : 7;
      const pawnTo = (to, extra = {}) => {
        if (rankOf(to) === lastRank) for (const promotion of 'qrbn') add(from, to, { ...extra, promotion });
        else add(from, to, extra);
      };
      const one = from + dir * 8;
      if (onBoard(r + dir, f) && !board[one]) {
        pawnTo(one);
        const two = from + dir * 16;
        if (r === startRank && !board[two]) add(from, two, { double: true });
      }
      for (const df of [-1, 1]) {
        if (!onBoard(r + dir, f + df)) continue;
        const to = (r + dir) * 8 + f + df;
        if (board[to] && colorOf(board[to]) === enemy) pawnTo(to);
        else if (to === pos.ep) add(from, to, { enPassant: true, captured: turn === 'w' ? 'p' : 'P' });
      }
      continue;
    }
    const steps = kind === 'n' ? KNIGHT : kind === 'k' ? KING : null;
    if (steps) {
      for (const [dr, df] of steps) {
        if (!onBoard(r + dr, f + df)) continue;
        const to = (r + dr) * 8 + f + df;
        if (!board[to] || colorOf(board[to]) === enemy) add(from, to);
      }
    } else {
      const dirs = kind === 'r' ? ROOK : kind === 'b' ? BISHOP : [...ROOK, ...BISHOP];
      for (const [dr, df] of dirs) {
        for (let rr = r + dr, ff = f + df; onBoard(rr, ff); rr += dr, ff += df) {
          const to = rr * 8 + ff;
          if (!board[to]) { add(from, to); continue; }
          if (colorOf(board[to]) === enemy) add(from, to);
          break;
        }
      }
    }
    if (kind === 'k') {
      // Castling: rights, empty squares between, and the king may not start,
      // pass through or land on an attacked square.
      const home = turn === 'w' ? 60 : 4;
      if (from === home) {
        const rights = turn === 'w' ? pos.castling.replace(/[a-z]/g, '') : pos.castling.replace(/[A-Z]/g, '').toUpperCase();
        const rook = turn === 'w' ? 'R' : 'r';
        if (rights.includes('K') && !board[home + 1] && !board[home + 2] && board[home + 3] === rook
          && ![home, home + 1, home + 2].some(sq => attacked(board, sq, enemy))) add(from, home + 2, { castle: 'K' });
        if (rights.includes('Q') && !board[home - 1] && !board[home - 2] && !board[home - 3] && board[home - 4] === rook
          && ![home, home - 1, home - 2].some(sq => attacked(board, sq, enemy))) add(from, home - 2, { castle: 'Q' });
      }
    }
  }
  return moves;
}

// The position after a move (the move is assumed to come from legalMoves).
export function makeMove(pos, move) {
  const board = pos.board.slice();
  const { from, to } = move;
  const piece = board[from];
  board[to] = move.promotion ? (pos.turn === 'w' ? move.promotion.toUpperCase() : move.promotion) : piece;
  board[from] = null;
  if (move.enPassant) board[to + (pos.turn === 'w' ? 8 : -8)] = null;
  if (move.castle) {
    const [rookFrom, rookTo] = move.castle === 'K' ? [from + 3, from + 1] : [from - 4, from - 1];
    board[rookTo] = board[rookFrom];
    board[rookFrom] = null;
  }
  let castling = pos.castling;
  const strip = letters => { castling = [...castling].filter(c => !letters.includes(c)).join(''); };
  if (piece === 'K') strip('KQ');
  if (piece === 'k') strip('kq');
  for (const sq of [from, to]) {
    if (sq === 63) strip('K'); if (sq === 56) strip('Q'); if (sq === 7) strip('k'); if (sq === 0) strip('q');
  }
  return {
    board, turn: pos.turn === 'w' ? 'b' : 'w', castling,
    ep: move.double ? (from + to) / 2 : -1,
    half: piece.toLowerCase() === 'p' || move.captured ? 0 : pos.half + 1,
    full: pos.turn === 'b' ? pos.full + 1 : pos.full,
  };
}

export function legalMoves(pos) {
  return pseudoMoves(pos).filter(move => {
    const next = makeMove(pos, move);
    return !attacked(next.board, kingSquare(next.board, pos.turn), next.turn);
  });
}

// 'checkmate', 'stalemate', or null while the game goes on.
export function gameEnd(pos) {
  if (legalMoves(pos).length) return null;
  return inCheck(pos) ? 'checkmate' : 'stalemate';
}

export const uci = move => `${squareName(move.from)}${squareName(move.to)}${move.promotion || ''}`;
export function findUci(pos, text) {
  return legalMoves(pos).find(move => uci(move) === text) || null;
}

// Standard algebraic notation, with + or # on the end.
export function san(pos, move) {
  let text;
  if (move.castle) text = move.castle === 'K' ? 'O-O' : 'O-O-O';
  else {
    const kind = move.piece.toUpperCase();
    const capture = move.captured ? 'x' : '';
    if (kind === 'P') {
      text = `${capture ? FILES[fileOf(move.from)] : ''}${capture}${squareName(move.to)}${move.promotion ? `=${move.promotion.toUpperCase()}` : ''}`;
    } else {
      // Say which piece when two of the same kind could go there.
      const rivals = legalMoves(pos).filter(m => m.to === move.to && m.from !== move.from && m.piece === move.piece);
      let which = '';
      if (rivals.length) {
        const sameFile = rivals.some(m => fileOf(m.from) === fileOf(move.from));
        const sameRank = rivals.some(m => rankOf(m.from) === rankOf(move.from));
        which = !sameFile ? FILES[fileOf(move.from)] : !sameRank ? String(8 - rankOf(move.from)) : squareName(move.from);
      }
      text = `${kind}${which}${capture}${squareName(move.to)}`;
    }
  }
  const next = makeMove(pos, move);
  const end = gameEnd(next);
  return text + (end === 'checkmate' ? '#' : inCheck(next) ? '+' : '');
}

// Counts move paths to a depth (for testing the rules against known totals).
export function perft(pos, depth) {
  if (depth === 0) return 1;
  const moves = legalMoves(pos);
  if (depth === 1) return moves.length;
  return moves.reduce((sum, move) => sum + perft(makeMove(pos, move), depth - 1), 0);
}
