// Steps for the Cartograskeet "Learn to play" walkthrough. The one move: an
// uncolored region whose neighbors already show three different colors can
// only take the fourth. Returns [{ action: 'color', targets: [region], color,
// focus: colored neighbors, around: their three colors }] or null if that move alone doesn't finish the map.
export function mapWalkthrough({ adj, clues }) {
  const colors = [...clues];
  const steps = [];
  for (let guard = 0; guard < colors.length; guard++) {
    const forced = colors.map((color, region) => {
      if (color >= 0) return null;
      const seen = new Set(adj[region].map(other => colors[other]).filter(value => value >= 0));
      return seen.size === 3 ? { region, color: [0, 1, 2, 3].find(value => !seen.has(value)) } : null;
    }).filter(Boolean)
      // The region with the most colored neighbors reads most clearly.
      .sort((a, b) => adj[b.region].filter(o => colors[o] >= 0).length - adj[a.region].filter(o => colors[o] >= 0).length)[0];
    if (!forced) break;
    const focus = adj[forced.region].filter(other => colors[other] >= 0);
    const around = [...new Set(focus.map(other => colors[other]))].sort();
    colors[forced.region] = forced.color;
    steps.push({ action: 'color', targets: [forced.region], color: forced.color, focus, around });
  }
  return colors.every(color => color >= 0) ? steps : null;
}
