// A small wrapper around Stockfish (stockfish.js 19, "lite single-threaded"
// build, GPLv3: https://github.com/nmrugg/stockfish.js), which runs in a Web
// Worker so the page never freezes while it thinks. The engine files live,
// unmodified, in public/stockfish/ and are only downloaded (about 1.9 MB) the
// first time someone opens Analysis.
//
// It speaks UCI: we send "position fen ..." and "go ...", and it streams back
// "info ..." lines (depth, score, best line) and finally "bestmove ...".
export const ENGINE_URL = '/stockfish/stockfish-19-lite-single.js';
export const STOCKFISH_SOURCE = 'https://github.com/nmrugg/stockfish.js';

// One "info" line, or null for lines without a full scored line (the engine
// also reports the move it's currently thinking about, bounds, and so on).
export function parseInfo(line) {
  if (!line.startsWith('info ') || !/ score /.test(line) || !/ pv /.test(line) || /bound/.test(line)) return null;
  const words = line.split(' ');
  const after = name => words[words.indexOf(name) + 1];
  const score = words.indexOf('score');
  const type = words[score + 1];
  if (type !== 'cp' && type !== 'mate') return null;
  return {
    depth: Number(after('depth')) || 0,
    multipv: Number(words.includes('multipv') ? after('multipv') : 1) || 1,
    score: { [type]: Number(words[score + 2]) },
    pv: words.slice(words.indexOf('pv') + 1).filter(Boolean),
  };
}

// The engine scores from the side to move; we show everything from White's
// side (positive = good for White), like most chess sites.
export const whiteScore = (score, turn) => turn === 'w' ? score
  : 'mate' in score ? { mate: -score.mate } : { cp: -score.cp };

export function formatScore(score) {
  if (!score) return '';
  if ('mate' in score) return score.mate === 0 ? '#' : `#${score.mate > 0 ? '' : '-'}${Math.abs(score.mate)}`;
  const pawns = score.cp / 100;
  return `${pawns > 0 ? '+' : pawns < 0 ? '−' : ''}${Math.abs(pawns).toFixed(1)}`;
}

// How much of the evaluation bar is White's: 0.5 is level, mates fill it.
export function barShare(score) {
  if (!score) return 0.5;
  if ('mate' in score) return score.mate > 0 ? 1 : score.mate < 0 ? 0 : 0.5;
  return 1 / (1 + Math.exp(-0.00368 * score.cp * 2)) * 0.96 + 0.02;
}

// A short plain-words reading of a (White-side) score.
export function verdict(score) {
  if (!score) return '';
  if ('mate' in score) {
    const side = score.mate > 0 ? 'White' : 'Black';
    return `${side} mates in ${Math.abs(score.mate)}`;
  }
  const cp = score.cp, side = cp > 0 ? 'White' : 'Black', size = Math.abs(cp);
  if (size < 60) return 'About equal';
  if (size < 150) return `${side} is slightly better`;
  if (size < 400) return `${side} is better`;
  return `${side} is winning`;
}

// The engine itself. One search at a time: asking for a new position stops
// the current search and starts the new one as soon as the engine is free.
export class Engine {
  constructor({ url = ENGINE_URL, createWorker = target => new Worker(target) } = {}) {
    this.ready = false;
    this.job = null; // the search running now
    this.next = null; // the one waiting for it to stop
    this.failed = null;
    try {
      this.worker = createWorker(url);
    } catch (error) {
      this.failed = error;
      return;
    }
    this.worker.onmessage = event => this.receive(String(event.data ?? ''));
    this.worker.onerror = event => this.fail(new Error(event?.message || 'The engine could not load.'));
    this.worker.postMessage('uci');
  }

  fail(error) {
    this.failed = error;
    for (const job of [this.job, this.next]) job?.onUpdate({ error });
    this.job = this.next = null;
  }

  receive(line) {
    if (line === 'uciok') { this.ready = true; this.startNext(); return; }
    const job = this.job;
    if (!job) return;
    if (line.startsWith('bestmove')) {
      if (!job.cancelled) job.onUpdate({ depth: job.depth, lines: job.lines.filter(Boolean), done: true });
      this.job = null;
      this.startNext();
      return;
    }
    const info = parseInfo(line);
    if (!info || job.cancelled) return;
    // A new depth starts a fresh set of lines; keep showing the last full set
    // until the first line of the new depth arrives.
    if (info.depth > job.depth) { job.depth = info.depth; job.lines = []; }
    if (info.depth < job.depth) return;
    job.lines[info.multipv - 1] = { score: whiteScore(info.score, job.turn), pv: info.pv };
    job.onUpdate({ depth: job.depth, lines: job.lines.filter(Boolean), done: false });
  }

  // fen: the position. Calls onUpdate({ depth, lines, done }) as the search
  // deepens (lines: [{ score, pv }], best first), or onUpdate({ error }).
  analyse(fen, { lines = 3, depth = 22, movetime = 4000 } = {}, onUpdate = () => {}) {
    if (this.failed) { onUpdate({ error: this.failed }); return; }
    const turn = fen.split(' ')[1] === 'b' ? 'b' : 'w';
    this.next = { fen, turn, onUpdate, depth: 0, lines: [], options: { lines, depth, movetime } };
    if (this.job) this.stopCurrent();
    else this.startNext();
  }

  stopCurrent() {
    if (this.job && !this.job.cancelled) {
      this.job.cancelled = true;
      this.worker.postMessage('stop');
    }
  }

  stop() {
    this.next = null;
    this.stopCurrent();
  }

  startNext() {
    if (!this.ready || this.job || !this.next) return;
    const job = this.next;
    this.next = null;
    this.job = job;
    const { lines, depth, movetime } = job.options;
    this.worker.postMessage(`setoption name MultiPV value ${lines}`);
    this.worker.postMessage(`position fen ${job.fen}`);
    this.worker.postMessage(`go depth ${depth} movetime ${movetime}`);
  }

  terminate() {
    this.job = this.next = null;
    this.worker?.terminate?.();
  }
}
