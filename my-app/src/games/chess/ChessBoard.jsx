import { useEffect, useRef, useState } from 'react';
import { colorOf, squareName } from './engine.js';

// The board: 64 squares, the player's side at the bottom. Pieces are the
// solid chess symbols, coloured with CSS, so no image files are needed.
//
// Moving: tap a piece then a square, or grab the piece and drag it.
// Drawing (to think a line through): right-drag from one square to another
// for an arrow, right-click a square for a circle; on a phone, switch on
// Draw and drag or tap the same way. Drawing the same arrow or circle again
// removes it; a normal click on the board, or any move, clears them all.
// `arrows` are extra arrows from the page (the engine's best move), drawn in
// their own colour and left alone by clicks.
const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
const NAME = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' };
const DRAG_START = 5; // pixels of movement before a press becomes a drag

export default function ChessBoard({ board, flipped, selected, targets = [], lastMove, checkSquare, hintSquare, wrongSquare,
  movable, onSquare, onPick, onDrop, disabled, drawMode = false, arrows = [] }) {
  const boardRef = useRef(null);
  const press = useRef(null);
  const [drag, setDrag] = useState(null); // { from, x, y, size, over }
  const [marks, setMarks] = useState({ arrows: [], circles: [] });
  const [sketch, setSketch] = useState(null); // the arrow being drawn: { from, to }
  const order = Array.from({ length: 64 }, (_, i) => flipped ? 63 - i : i);
  const targetSet = new Set(targets);

  // A new position clears the drawings.
  useEffect(() => { setMarks({ arrows: [], circles: [] }); }, [board]);

  const squareAt = (x, y) => {
    const el = document.elementFromPoint(x, y)?.closest?.('[data-square]');
    return el && boardRef.current?.contains(el) ? Number(el.dataset.square) : null;
  };
  const finish = () => { press.current = null; setDrag(null); setSketch(null); };
  const toggleMark = (from, to) => setMarks(current => {
    if (from === to) {
      const circles = current.circles.includes(from) ? current.circles.filter(sq => sq !== from) : [...current.circles, from];
      return { ...current, circles };
    }
    const exists = current.arrows.some(a => a.from === from && a.to === to);
    return { ...current, arrows: exists ? current.arrows.filter(a => !(a.from === from && a.to === to)) : [...current.arrows, { from, to }] };
  });
  // Board coordinates (0-8) of a square's centre, as shown.
  const centre = sq => {
    const col = sq % 8, row = Math.floor(sq / 8);
    return flipped ? [7 - col + 0.5, 7 - row + 0.5] : [col + 0.5, row + 0.5];
  };
  const arrowPath = ({ from, to }) => {
    const [x1, y1] = centre(from), [x2, y2] = centre(to);
    const length = Math.hypot(x2 - x1, y2 - y1);
    // Stop the shaft short so the head lands near the target's centre.
    const ex = x2 - (x2 - x1) / length * 0.45, ey = y2 - (y2 - y1) / length * 0.45;
    return { x1, y1, x2: ex, y2: ey };
  };
  const hasMarks = marks.arrows.length || marks.circles.length;

  return <div className="ch-board-stack">
    <div ref={boardRef} className={`ch-board${flipped ? ' flipped' : ''}${drag ? ' dragging' : ''}${drawMode ? ' drawing' : ''}`}
      role="grid" aria-label="Chess board"
      onContextMenu={event => event.preventDefault()}
      onPointerMove={event => {
        const p = press.current;
        if (!p || p.pointerId !== event.pointerId) return;
        if (p.draw) {
          const over = squareAt(event.clientX, event.clientY);
          setSketch(over !== null && over !== p.sq ? { from: p.sq, to: over } : null);
          return;
        }
        if (!p.dragging) {
          if (!p.canDrag || Math.hypot(event.clientX - p.x, event.clientY - p.y) < DRAG_START) return;
          p.dragging = true;
          onPick?.(p.sq);
        }
        setDrag({ from: p.sq, x: event.clientX, y: event.clientY, size: p.size, over: squareAt(event.clientX, event.clientY) });
      }}
      onPointerUp={event => {
        const p = press.current;
        if (!p || p.pointerId !== event.pointerId) return;
        finish();
        if (p.draw) {
          const to = squareAt(event.clientX, event.clientY);
          if (to !== null) toggleMark(p.sq, to);
          return;
        }
        if (hasMarks) setMarks({ arrows: [], circles: [] });
        if (disabled) return;
        if (!p.dragging) { onSquare?.(p.sq); return; }
        const to = squareAt(event.clientX, event.clientY);
        if (to !== null && to !== p.sq) onDrop?.(p.sq, to);
      }}
      onPointerCancel={finish}
      onLostPointerCapture={() => { if (press.current) finish(); }}>
      {order.map((sq, i) => {
        const piece = board[sq];
        const light = (Math.floor(sq / 8) + sq % 8) % 2 === 0;
        const showRank = i % 8 === 0, showFile = i >= 56;
        const lifted = drag && drag.from === sq;
        const classes = ['ch-square', light ? 'light' : 'dark', disabled && 'idle',
          sq === selected && 'selected', lastMove && (sq === lastMove.from || sq === lastMove.to) && 'last',
          sq === checkSquare && 'check', sq === hintSquare && 'hint', sq === wrongSquare && 'wrong',
          drag && drag.over === sq && sq !== drag.from && 'over',
          targetSet.has(sq) && (piece ? 'capture' : 'target')].filter(Boolean).join(' ');
        const label = `${squareName(sq)}${piece ? `, ${colorOf(piece) === 'w' ? 'white' : 'black'} ${NAME[piece.toLowerCase()]}` : ''}`;
        return <button key={sq} type="button" className={classes} data-square={sq} aria-label={label} aria-disabled={disabled || undefined}
          onPointerDown={event => {
            const right = event.pointerType === 'mouse' && event.button === 2;
            if (event.pointerType === 'mouse' && event.button !== 0 && !right) return;
            const draw = right || drawMode;
            // While it's not your turn you can still draw, but not move.
            if (disabled && !draw) return;
            const rect = event.currentTarget.getBoundingClientRect();
            press.current = { sq, x: event.clientX, y: event.clientY, pointerId: event.pointerId, size: rect.width, draw,
              canDrag: !draw && !!(piece && movable?.(sq)), dragging: false };
            // Keep the pointer on the board so drags follow it anywhere.
            boardRef.current?.setPointerCapture?.(event.pointerId);
            event.preventDefault();
          }}
          // Mouse and touch go through the pointer handlers above; this is for
          // the keyboard (Enter or Space on a focused square).
          onClick={event => { if (event.detail === 0 && !disabled) onSquare?.(sq); }}>
          {showRank && <span className="ch-coord rank">{8 - Math.floor(sq / 8)}</span>}
          {showFile && <span className="ch-coord file">{'abcdefgh'[sq % 8]}</span>}
          {piece && <span className={`ch-piece ${colorOf(piece) === 'w' ? 'white' : 'black'}${lifted ? ' lifted' : ''}`} aria-hidden="true">{GLYPH[piece.toLowerCase()]}{'︎'}</span>}
        </button>;
      })}
      {drag && board[drag.from] && <span className={`ch-piece ch-floating ${colorOf(board[drag.from]) === 'w' ? 'white' : 'black'}`} aria-hidden="true"
        style={{ left: drag.x, top: drag.y, width: drag.size, height: drag.size, fontSize: drag.size * 0.82 }}>
        {GLYPH[board[drag.from].toLowerCase()]}{'︎'}
      </span>}
    </div>
    <svg className="ch-marks" viewBox="0 0 8 8" aria-hidden="true">
      <defs>
        <marker id="ch-head" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="2.6" markerHeight="2.6" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" />
        </marker>
        <marker id="ch-head-engine" className="engine" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="2.6" markerHeight="2.6" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" />
        </marker>
      </defs>
      {arrows.map(arrow => {
        const { x1, y1, x2, y2 } = arrowPath(arrow);
        return <line key={`e${arrow.from}-${arrow.to}`} className="ch-mark-arrow engine" x1={x1} y1={y1} x2={x2} y2={y2} markerEnd="url(#ch-head-engine)" />;
      })}
      {marks.circles.map(sq => { const [cx, cy] = centre(sq); return <circle key={`c${sq}`} className="ch-mark-circle" cx={cx} cy={cy} r="0.44" />; })}
      {[...marks.arrows, ...(sketch ? [{ ...sketch, sketch: true }] : [])].map(arrow => {
        const { x1, y1, x2, y2 } = arrowPath(arrow);
        return <line key={`${arrow.from}-${arrow.to}${arrow.sketch ? 's' : ''}`} className={`ch-mark-arrow${arrow.sketch ? ' sketch' : ''}`}
          x1={x1} y1={y1} x2={x2} y2={y2} markerEnd="url(#ch-head)" />;
      })}
    </svg>
  </div>;
}

export const PROMOTION_GLYPHS = GLYPH;
