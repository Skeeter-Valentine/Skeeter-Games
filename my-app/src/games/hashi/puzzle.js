import { countSolutions } from './solver.js';

export function mulberry32(seed) {
    return function() {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

class Node {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.n_type = 0; 
        this.i_count = 0; 
    }

    makeIsland(bridges) {
        this.n_type = 1;
        this.i_count = bridges;
    }
}

class PythonStyleHashiGenerator {
    constructor(width = 6, height = 6, randomFunc = Math.random) {
        this.width = width;
        this.height = height;
        this.step_per_cycle = width * 10;
        this.random = randomFunc;
    }

    directionToVector(dir) {
        const vectors = [[-1, 0], [0, -1], [1, 0], [0, 1]];
        return vectors[dir];
    }

    isInGrid(x, y) {
        return x >= 0 && x < this.width && y >= 0 && y < this.height;
    }

    getRandomDirection(grid, x, y) {
        let possibleDirections = [];
        if (x > 1 && grid[x-1][y].n_type === 0 && grid[x-2][y].n_type === 0) possibleDirections.push(0);
        if (y > 1 && grid[x][y-1].n_type === 0 && grid[x][y-2].n_type === 0) possibleDirections.push(1);
        if (x < this.width - 2 && grid[x+1][y].n_type === 0 && grid[x+2][y].n_type === 0) possibleDirections.push(2);
        if (y < this.height - 2 && grid[x][y+1].n_type === 0 && grid[x][y+2].n_type === 0) possibleDirections.push(3);
        
        if (possibleDirections.length === 0) return -1;
        return possibleDirections[Math.floor(this.random() * possibleDirections.length)];
    }

    getRandomBridgeThickness(grid, x, y) {
        if (8 - grid[x][y].i_count > 1) {
            return this.random() < 0.5 ? 1 : 2;
        }
        return 1;
    }

    getRandomBridgeLength(grid, x, y, direction) {
        let dirVector = this.directionToVector(direction);
        let maxLength = 1;
        let checkX = x + dirVector[0] * (maxLength + 2);
        let checkY = y + dirVector[1] * (maxLength + 2);

        while (true) {
            if (!this.isInGrid(checkX, checkY)) break;
            if (grid[checkX][checkY].n_type !== 0) break;
            maxLength += 1;
            checkX += dirVector[0];
            checkY += dirVector[1];
        }
        return Math.floor(this.random() * maxLength) + 1;
    }

    generate() {
        let grid = Array.from({ length: this.width }, (_, i) => 
            Array.from({ length: this.height }, (_, j) => new Node(i, j))
        );

        let islands = [];
        let startX = Math.floor(this.random() * this.width);
        let startY = Math.floor(this.random() * this.height);
        
        let firstNode = grid[startX][startY];
        firstNode.makeIsland(0);
        islands.push(firstNode);

        for (let step = 0; step < this.step_per_cycle; step++) {
            if (islands.length === 0) break;

            let currentNode = islands[Math.floor(this.random() * islands.length)];
            let direction = this.getRandomDirection(grid, currentNode.x, currentNode.y);

            if (direction === -1) {
                islands = islands.filter(n => n !== currentNode);
                continue;
            }

            let thickness = this.getRandomBridgeThickness(grid, currentNode.x, currentNode.y);
            let length = this.getRandomBridgeLength(grid, currentNode.x, currentNode.y, direction);
            let dirVector = this.directionToVector(direction);

            let lastNodeX = currentNode.x + dirVector[0] * (length + 1);
            let lastNodeY = currentNode.y + dirVector[1] * (length + 1);

            if (!this.isInGrid(lastNodeX, lastNodeY)) continue;
            let lastNode = grid[lastNodeX][lastNodeY];

            let adjacentFound = false;
            for (let d = 0; d < 2; d++) {
                let vec = this.directionToVector(d);
                if (this.isInGrid(lastNode.x + vec[0], lastNode.y + vec[1]) && grid[lastNode.x + vec[0]][lastNode.y + vec[1]].n_type === 1) adjacentFound = true;
                if (this.isInGrid(lastNode.x - vec[0], lastNode.y - vec[1]) && grid[lastNode.x - vec[0]][lastNode.y - vec[1]].n_type === 1) adjacentFound = true;
            }
            if (adjacentFound) continue;

            for (let i = 0; i < length; i++) {
                let bridgeNode = grid[currentNode.x + dirVector[0] * (i + 1)][currentNode.y + dirVector[1] * (i + 1)];
                bridgeNode.n_type = 2; 
            }

            lastNode.makeIsland(thickness);
            islands.push(lastNode);
            currentNode.i_count += thickness;
        }

        let resultIslands = [];
        for (let row of grid) {
            for (let node of row) {
                if (node.n_type === 1 && node.i_count > 0) {
                    resultIslands.push(node);
                }
            }
        }
        return resultIslands;
    }
}

export function generateUniquePuzzle(size, rng = Math.random) {
    const generator = new PythonStyleHashiGenerator(size, size, rng);
    for (let attempt = 0; attempt < 100; attempt++) {
        const islands = generator.generate().map((island, id) => ({
            id, r: island.x, c: island.y, req: island.i_count,
        }));
        if (islands.length >= 3 && countSolutions(islands) === 1) return islands;
    }
    // A three-island path is uniquely determined by its endpoint clues.
    // Keep retries bounded without ever returning an unchecked candidate.
    const first = rng() < 0.5 ? 1 : 2;
    const second = rng() < 0.5 ? 1 : 2;
    return [
        { id: 0, r: 0, c: 0, req: first },
        { id: 1, r: 0, c: size - 1, req: first + second },
        { id: 2, r: size - 1, c: size - 1, req: second },
    ];
}

