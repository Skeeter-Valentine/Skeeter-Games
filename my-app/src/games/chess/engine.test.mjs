import assert from 'node:assert/strict';
import test from 'node:test';
import { START_FEN, findUci, gameEnd, legalMoves, makeMove, parseFen, perft, san, toFen } from './engine.js';

// Known move-path counts (chessprogramming.org "Perft Results"). Any mistake in
// castling, en passant, promotion or check shows up here.
const PERFT = [
  [START_FEN, [20, 400, 8902, 197281]],
  ['r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', [48, 2039, 97862]],
  ['8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', [14, 191, 2812, 43238]],
  ['r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', [6, 264, 9467]],
  ['rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', [44, 1486, 62379]],
];

test('legal moves match the standard perft totals', () => {
  for (const [fen, counts] of PERFT) {
    const pos = parseFen(fen);
    counts.forEach((count, i) => assert.equal(perft(pos, i + 1), count, `${fen} depth ${i + 1}`));
  }
});

test('FEN round-trips, and moves update castling and en passant', () => {
  assert.equal(toFen(parseFen(START_FEN)), START_FEN);
  let pos = parseFen(START_FEN);
  pos = makeMove(pos, findUci(pos, 'e2e4'));
  assert.equal(toFen(pos), 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1');
  pos = makeMove(pos, findUci(pos, 'e7e5'));
  pos = makeMove(pos, findUci(pos, 'e1e2'));
  assert.equal(toFen(pos).split(' ')[2], 'kq');
});

test('SAN names moves the usual way', () => {
  const mate = parseFen('6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1');
  assert.equal(san(mate, findUci(mate, 'a1a8')), 'Ra8#');
  const rooks = parseFen('6k1/8/8/8/8/K7/8/R6R w - - 0 1');
  assert.equal(san(rooks, findUci(rooks, 'a1e1')), 'Rae1');
  const file = parseFen('7k/R7/8/8/8/8/8/R6K w - - 0 1');
  assert.equal(san(file, findUci(file, 'a1a4')), 'R1a4');
  const promo = parseFen('8/P5k1/8/8/8/8/8/K7 w - - 0 1');
  assert.equal(san(promo, findUci(promo, 'a7a8q')), 'a8=Q');
  const castle = parseFen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  assert.equal(san(castle, findUci(castle, 'e1g1')), 'O-O');
  assert.equal(san(castle, findUci(castle, 'e1c1')), 'O-O-O');
});

test('checkmate and stalemate are recognised', () => {
  assert.equal(gameEnd(parseFen('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3')), 'checkmate');
  assert.equal(gameEnd(parseFen('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1')), 'stalemate');
  assert.equal(gameEnd(parseFen(START_FEN)), null);
  assert.equal(legalMoves(parseFen(START_FEN)).length, 20);
});
