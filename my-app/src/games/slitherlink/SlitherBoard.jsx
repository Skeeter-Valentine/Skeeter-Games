import { useRef } from 'react';
import { geometry } from './puzzle.js';

// The board for Skeeterlink and its walkthrough: dots, numbers, lines and
// crosses, drawn in an SVG one unit per square. The pointer always points at
// exactly one edge (the nearest side of the square it's over), so a press or
// a drag anywhere on the board picks edges easily, even with a finger.
export function edgeAt(rows, cols, x, y) {
  const c = Math.min(cols - 1, Math.max(0, Math.floor(x)));
  const r = Math.min(rows - 1, Math.max(0, Math.floor(y)));
  const fx = x - c, fy = y - r;
  const sides = [[fy, r * cols + c], [1 - fy, (r + 1) * cols + c],
    [fx, (rows + 1) * cols + r * (cols + 1) + c], [1 - fx, (rows + 1) * cols + r * (cols + 1) + c + 1]];
  return sides.reduce((best, side) => side[0] < best[0] ? side : best)[1];
}

export default function SlitherBoard({ puzzle, lines, crosses, clueState = [], branches = [], won = false,
  targets, focusCells, onPress, onDrag, disabled, label }) {
  const { rows, cols, clues } = puzzle;
  const g = geometry(rows, cols);
  const svgRef = useRef(null);
  const last = useRef(null);
  const dot = v => [v % (cols + 1), Math.floor(v / (cols + 1))];
  const point = event => {
    const svg = svgRef.current;
    const matrix = svg.getScreenCTM()?.inverse();
    if (!matrix) return null;
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix);
    return edgeAt(rows, cols, p.x, p.y);
  };
  const branchSet = new Set(branches);
  return <svg ref={svgRef} className={`sl-board${won ? ' won' : ''}`} viewBox={`-0.5 -0.5 ${cols + 1} ${rows + 1}`}
    role="img" aria-label={label}
    onContextMenu={event => event.preventDefault()}
    onPointerDown={event => {
      if (disabled || (event.button !== 0 && event.button !== 2)) return;
      const edge = point(event);
      if (edge === null) return;
      event.preventDefault();
      svgRef.current.setPointerCapture?.(event.pointerId);
      last.current = edge;
      onPress?.(edge, event);
    }}
    onPointerMove={event => {
      if (last.current === null || disabled) return;
      const edge = point(event);
      if (edge !== null && edge !== last.current) { last.current = edge; onDrag?.(edge); }
    }}
    onPointerUp={() => { last.current = null; }}
    onPointerCancel={() => { last.current = null; }}>
    {focusCells && [...focusCells].map(cell => <rect key={`f${cell}`} className="sl-focus" x={cell % cols} y={Math.floor(cell / cols)} width="1" height="1" />)}
    {clues.map((clue, cell) => clue < 0 ? null : <text key={`n${cell}`} className={`sl-clue ${clueState[cell] || ''}`}
      x={cell % cols + 0.5} y={Math.floor(cell / cols) + 0.53}>{clue}</text>)}
    {targets && [...targets].map(e => { const [[x1, y1], [x2, y2]] = g.ends[e].map(dot);
      return <line key={`t${e}`} className="sl-target" x1={x1} y1={y1} x2={x2} y2={y2} />; })}
    {[...crosses].map(e => { const [[x1, y1], [x2, y2]] = g.ends[e].map(dot); const x = (x1 + x2) / 2, y = (y1 + y2) / 2, s = 0.09;
      return <path key={`x${e}`} className="sl-cross" d={`M${x - s} ${y - s}L${x + s} ${y + s}M${x + s} ${y - s}L${x - s} ${y + s}`} />; })}
    {[...lines].map(e => { const [[x1, y1], [x2, y2]] = g.ends[e].map(dot);
      return <line key={`l${e}`} className="sl-line" x1={x1} y1={y1} x2={x2} y2={y2} />; })}
    {Array.from({ length: g.V }, (_, v) => { const [x, y] = dot(v);
      return <circle key={`d${v}`} className={`sl-dot${branchSet.has(v) ? ' branch' : ''}`} cx={x} cy={y} r={branchSet.has(v) ? 0.11 : 0.07} />; })}
  </svg>;
}
