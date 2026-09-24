export function doSegmentsCross(i1, i2, j1, j2) {
    let pIsHoriz = (i1.r === i2.r);
    let qIsHoriz = (j1.r === j2.r);
    if (pIsHoriz === qIsHoriz) return false;

    let horiz = pIsHoriz ? { r: i1.r, c1: Math.min(i1.c, i2.c), c2: Math.max(i1.c, i2.c) } 
                        : { r: j1.r, c1: Math.min(j1.c, j2.c), c2: Math.max(j1.c, j2.c) };
    let vert  = !pIsHoriz ? { c: i1.c, r1: Math.min(i1.r, i2.r), r2: Math.max(i1.r, i2.r) } 
                        : { c: j1.c, r1: Math.min(j1.r, j2.r), r2: Math.max(j1.r, j2.r) };

    return (vert.c > horiz.c1 && vert.c < horiz.c2 && horiz.r > vert.r1 && horiz.r < vert.r2);
}

export function getPossibleBridges(islands) {
    const edges = [];
    islands.forEach((a, i) => {
        islands.slice(i + 1).forEach(b => {
            if (a.r !== b.r && a.c !== b.c) return;
            const blocked = islands.some(other =>
                (a.r === b.r && other.r === a.r && other.c > Math.min(a.c, b.c) && other.c < Math.max(a.c, b.c)) ||
                (a.c === b.c && other.c === a.c && other.r > Math.min(a.r, b.r) && other.r < Math.max(a.r, b.r)));
            if (!blocked) edges.push({ from: a.id, to: b.id });
        });
    });
    return edges;
}

export function isConnected(islands, bridges) {
    if (!islands.length) return false;
    const seen = new Set([islands[0].id]);
    const pending = [islands[0].id];
    while (pending.length) {
        const id = pending.pop();
        for (const bridge of bridges) {
            if (bridge.count <= 0) continue;
            const next = bridge.from === id ? bridge.to : bridge.to === id ? bridge.from : null;
            if (next !== null && !seen.has(next)) {
                seen.add(next);
                pending.push(next);
            }
        }
    }
    return islands.every(island => seen.has(island.id));
}

// Count up to two valid solutions. null means the search budget was exhausted;
// callers must never treat an incomplete search as proof of uniqueness.
export function countSolutions(islands, maxNodes = 10000) {
    if (islands.length < 2) return 0;
    const edges = getPossibleBridges(islands);
    const byId = new Map(islands.map(island => [island.id, island]));
    const incident = islands.map(island => edges.flatMap((edge, i) =>
        edge.from === island.id || edge.to === island.id ? [i] : []));
    const crossings = edges.map(edge => edges.flatMap((other, j) =>
        doSegmentsCross(byId.get(edge.from), byId.get(edge.to), byId.get(other.from), byId.get(other.to)) ? [j] : []));
    let nodes = 0;
    let solutions = 0;
    let exhausted = false;

    function search(domains) {
        if (solutions >= 2 || exhausted) return;
        if (++nodes > maxNodes) { exhausted = true; return; }
        let changed = true;
        while (changed) {
            changed = false;
            function restrict(index, predicate) {
                const filtered = domains[index].filter(predicate);
                if (filtered.length !== domains[index].length) changed = true;
                domains[index] = filtered;
                return filtered.length > 0;
            }
            for (let n = 0; n < islands.length; n++) {
                const indices = incident[n];
                const min = indices.reduce((sum, i) => sum + domains[i][0], 0);
                const max = indices.reduce((sum, i) => sum + domains[i].at(-1), 0);
                const req = islands[n].req;
                if (req < min || req > max) return;
                for (const i of indices) {
                    const low = domains[i][0], high = domains[i].at(-1);
                    if (!restrict(i, value => value + min - low <= req && value + max - high >= req)) return;
                }
            }
            for (let i = 0; i < edges.length; i++) {
                if (domains[i][0] > 0) {
                    for (const j of crossings[i]) {
                        if (!restrict(j, value => value === 0)) return;
                    }
                }
            }
        }
        // If even all remaining possible bridges cannot connect the islands,
        // this branch cannot yield a legal Hashi solution.
        if (!isConnected(islands, edges.map((edge, i) => ({ ...edge, count: domains[i].at(-1) })))) return;
        const branch = domains.findIndex(domain => domain.length > 1);
        if (branch === -1) { solutions++; return; }
        for (const value of domains[branch]) {
            const next = domains.map(domain => domain.slice());
            next[branch] = [value];
            search(next);
        }
    }
    search(edges.map(() => [0, 1, 2]));
    return exhausted ? null : solutions;
}

