// Each color has its own bead shape, drawn in a 40 × 40 box.
export const BEADS = [
  { name: 'Red circle', fill: '#ff3b5c', shape: 'circle' },
  { name: 'Orange triangle', fill: '#ff9f1c', shape: 'triangle' },
  { name: 'Yellow square', fill: '#ffe14d', shape: 'square' },
  { name: 'Green diamond', fill: '#3ddc84', shape: 'diamond' },
  { name: 'Cyan hexagon', fill: '#2ec4f1', shape: 'hexagon' },
  { name: 'Blue star', fill: '#5a74ff', shape: 'star' },
  { name: 'Purple heart', fill: '#b05cff', shape: 'heart' },
  { name: 'Pink pentagon', fill: '#ff7ac8', shape: 'pentagon' },
  { name: 'Cream oval', fill: '#f4ecd8', shape: 'oval' },
  { name: 'Silver teardrop', fill: '#b9c3d6', shape: 'teardrop' },
];

// Polygon with every corner rounded. `radius` is how far each corner is cut
// back along its two edges (capped at half an edge); `inner` applies to
// concave corners such as the star's inner points.
function roundedPolygon(points, radius, inner = radius) {
  const n = points.length, cuts = [];
  const r1 = v => Math.round(v * 100) / 100;
  for (let i = 0; i < n; i++) {
    const prev = points[(i + n - 1) % n], at = points[i], next = points[(i + 1) % n];
    const cross = (at[0] - prev[0]) * (next[1] - at[1]) - (at[1] - prev[1]) * (next[0] - at[0]);
    const toward = (from, to, d) => {
      const len = Math.hypot(to[0] - from[0], to[1] - from[1]), t = Math.min(d, len / 2) / len;
      return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t];
    };
    const d = cross < 0 ? inner : radius;
    cuts.push([toward(at, prev, d), at, toward(at, next, d)]);
  }
  return cuts.map(([start, corner, end], i) => `${i ? 'L' : 'M'}${r1(start[0])} ${r1(start[1])}Q${corner[0]} ${corner[1]} ${r1(end[0])} ${r1(end[1])}`).join('') + 'Z';
}

export const SHAPE_PATHS = {
  circle: 'M20 4a16 16 0 1 0 0.01 0Z',
  triangle: roundedPolygon([[20, 2.5], [38, 35.5], [2, 35.5]], 5.5),
  square: 'M10 5h20a5 5 0 0 1 5 5v20a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5V10a5 5 0 0 1 5-5Z',
  diamond: roundedPolygon([[20, 1], [39, 20], [20, 39], [1, 20]], 5.5),
  hexagon: roundedPolygon([[10.5, 3.5], [29.5, 3.5], [39, 20], [29.5, 36.5], [10.5, 36.5], [1, 20]], 5),
  star: roundedPolygon([[20, 1.5], [25.1, 12.9], [37.6, 14.2], [28.2, 22.6], [31, 35], [20, 28.6], [9, 35], [11.8, 22.6], [2.4, 14.2], [14.9, 12.9]], 3.5, 2),
  // Heart: two round lobes and a softened bottom point.
  heart: 'M16.4 33.5 5.2 22.6A9.3 9.3 0 0 1 20 9.6a9.3 9.3 0 0 1 14.8 13L23.6 33.5Q20 37 16.4 33.5Z',
  pentagon: roundedPolygon([[20, 2], [38, 15], [31.2, 36.5], [8.8, 36.5], [2, 15]], 5),
  oval: 'M1.5 20a18.5 11.5 0 1 0 37 0a18.5 11.5 0 1 0-37 0Z',
  // Teardrop: round bottom rising to a softened point at the top.
  teardrop: 'M18.33 4.99Q20 2.5 21.67 4.99L30.39 18.06A12.5 12.5 0 1 1 9.61 18.06Z',
};

// Mix a hex color toward white (amount > 0) or black (amount < 0).
export function shade(hex, amount) {
  const target = amount > 0 ? 255 : 0, t = Math.abs(amount);
  const channels = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  return `#${channels.map(c => Math.round(c + (target - c) * t).toString(16).padStart(2, '0')).join('')}`;
}

// Shared gradients and clip paths, rendered once per page. Every highlight is
// clipped to its bead's outline so nothing can spill past the edge.
export function beadDefs(prefix = 'beadle') {
  const gradients = BEADS.map(({ fill }, i) => `<radialGradient id="${prefix}-fill-${i}" cx="38%" cy="30%" r="78%">
    <stop offset="0" stop-color="${shade(fill, 0.45)}"/><stop offset="0.45" stop-color="${fill}"/><stop offset="1" stop-color="${shade(fill, -0.38)}"/></radialGradient>`).join('');
  const clips = Object.entries(SHAPE_PATHS).map(([shape, d]) => `<clipPath id="${prefix}-clip-${shape}"><path d="${d}"/></clipPath>`).join('');
  return `${gradients}${clips}<linearGradient id="${prefix}-gloss" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.85"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`;
}

// How high the bottom shadow reaches on each shape (its centre's y in the
// 40 × 40 box; lower numbers reach higher). Shapes with narrow or shallow
// bottoms need it raised to show.
const SHADOW_Y = { star: 40, oval: 38 };

// Inner markup of one bead inside a 40 × 40 viewBox (uses beadDefs).
export function beadMarkup(color, prefix = 'beadle') {
  const { fill, shape } = BEADS[color], d = SHAPE_PATHS[shape];
  return `<path d="${d}" fill="url(#${prefix}-fill-${color})"/>`
    + `<g clip-path="url(#${prefix}-clip-${shape})">`
    + `<ellipse cx="20" cy="${SHADOW_Y[shape] ?? 41}" rx="24" ry="11" fill="#000" opacity="${shape === 'oval' ? 0.26 : 0.22}"/>`
    + `<ellipse cx="17" cy="9" rx="15" ry="8.5" fill="url(#${prefix}-gloss)" opacity="0.75"/>`
    + `</g>`
    + `<path d="${d}" fill="none" stroke="${shade(fill, -0.55)}" stroke-width="1.8" stroke-linejoin="round"/>`;
}
