import assert from 'node:assert/strict';
import test from 'node:test';
import { barShare, Engine, formatScore, parseInfo, verdict, whiteScore } from './stockfish.js';

test('parseInfo reads scored lines and skips the rest', () => {
  assert.deepEqual(parseInfo('info depth 12 seldepth 18 multipv 2 score cp -35 nodes 9000 nps 1 time 5 pv e7e5 g1f3 b8c6'),
    { depth: 12, multipv: 2, score: { cp: -35 }, pv: ['e7e5', 'g1f3', 'b8c6'] });
  assert.deepEqual(parseInfo('info depth 5 score mate 2 pv d1h5 g7g6').score, { mate: 2 });
  assert.equal(parseInfo('info depth 5 currmove e2e4 currmovenumber 1'), null);
  assert.equal(parseInfo('info depth 9 score cp 20 lowerbound nodes 1 pv e2e4'), null);
  assert.equal(parseInfo('bestmove e2e4'), null);
});

test('scores are shown from White\'s side', () => {
  assert.deepEqual(whiteScore({ cp: 50 }, 'b'), { cp: -50 });
  assert.deepEqual(whiteScore({ mate: 3 }, 'b'), { mate: -3 });
  assert.equal(formatScore({ cp: 125 }), '+1.3');
  assert.equal(formatScore({ cp: -240 }), '−2.4');
  assert.equal(formatScore({ cp: 0 }), '0.0');
  assert.equal(formatScore({ mate: -2 }), '#-2');
  assert.equal(verdict({ mate: 3 }), 'White mates in 3');
  assert.equal(verdict({ cp: -500 }), 'Black is winning');
  assert.equal(verdict({ cp: 20 }), 'About equal');
  assert.equal(barShare({ mate: 1 }), 1);
  assert.ok(barShare({ cp: 300 }) > 0.8 && barShare({ cp: -300 }) < 0.2);
});

// A pretend worker that records commands and lets the test reply.
function fakeEngine() {
  const sent = [];
  let worker;
  const engine = new Engine({ createWorker: () => (worker = { postMessage: line => sent.push(line), terminate() {} }) });
  const say = line => worker.onmessage({ data: line });
  return { engine, sent, say };
}

test('Engine waits for uciok, streams lines and finishes on bestmove', () => {
  const { engine, sent, say } = fakeEngine();
  const updates = [];
  engine.analyse('8/8/8/8/8/8/8/K6k b - - 0 1', { lines: 2 }, update => updates.push(update));
  assert.deepEqual(sent, ['uci']);
  say('uciok');
  assert.deepEqual(sent.slice(1), ['setoption name MultiPV value 2', 'position fen 8/8/8/8/8/8/8/K6k b - - 0 1', 'go depth 22 movetime 4000']);
  say('info depth 1 multipv 1 score cp 30 pv h1g2');
  say('info depth 1 multipv 2 score cp 10 pv h1h2');
  say('info depth 2 multipv 1 score cp 40 pv h1g1');
  assert.deepEqual(updates.at(-1), { depth: 2, lines: [{ score: { cp: -40 }, pv: ['h1g1'] }], done: false });
  say('bestmove h1g1');
  assert.equal(updates.at(-1).done, true);
});

test('a new position stops the old search and starts after bestmove', () => {
  const { engine, sent, say } = fakeEngine();
  say('uciok');
  const first = [], second = [];
  engine.analyse('fen-one w', {}, u => first.push(u));
  engine.analyse('fen-two w', {}, u => second.push(u));
  assert.equal(sent.at(-1), 'stop');
  say('info depth 3 multipv 1 score cp 5 pv a2a3');
  assert.equal(first.length, 0, 'lines after the stop are ignored');
  say('bestmove a2a3');
  assert.equal(first.length, 0);
  assert.ok(sent.includes('position fen fen-two w'));
  say('info depth 1 multipv 1 score mate 1 pv a1a8');
  assert.deepEqual(second.at(-1).lines[0].score, { mate: 1 });
});

test('a worker that cannot start reports an error', () => {
  const engine = new Engine({ createWorker: () => { throw new Error('no workers'); } });
  let got;
  engine.analyse('x w', {}, u => { got = u; });
  assert.match(got.error.message, /no workers/);
});
