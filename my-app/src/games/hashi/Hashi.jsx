// src/games/hashi/Hashi.jsx
import React, { useState, useEffect, useRef } from 'react';
import StatsModal from './components/StatsModal';
import Navbar from '../../components/Navbar';
import './Hashi.css';

function mulberry32(seed) {
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

function distanceToSegment(px, py, x1, y1, x2, y2) {
    let l2 = (x2 - x1)**2 + (y2 - y1)**2;
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1)*(x2 - x1) + (py - y1)*(y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    let projx = x1 + t * (x2 - x1);
    let projy = y1 + t * (y2 - y1);
    return Math.hypot(px - projx, py - projy);
}

function doSegmentsCross(i1, i2, j1, j2) {
    let pIsHoriz = (i1.r === i2.r);
    let qIsHoriz = (j1.r === j2.r);
    if (pIsHoriz === qIsHoriz) return false;

    let horiz = pIsHoriz ? { r: i1.r, c1: Math.min(i1.c, i2.c), c2: Math.max(i1.c, i2.c) } 
                        : { r: j1.r, c1: Math.min(j1.c, j2.c), c2: Math.max(j1.c, j2.c) };
    let vert  = !pIsHoriz ? { c: i1.c, r1: Math.min(i1.r, i2.r), r2: Math.max(i1.r, i2.r) } 
                        : { c: j1.c, r1: Math.min(j1.r, j2.r), r2: Math.max(j1.r, j2.r) };

    return (vert.c > horiz.c1 && vert.c < horiz.c2 && horiz.r > vert.r1 && horiz.r < vert.r2);
}

const DEFAULT_STATS = {
    played: 0,
    wins: 0,
    currentStreak: 0,
    maxStreak: 0,
    lastPlayedDate: null
};

export default function Hashi() {
    const canvasRef = useRef(null);
    const [message, setMessage] = useState('');
    const [gridSize, setGridSize] = useState(6);
    const [gameState, setGameState] = useState({ islands: [], bridges: [] });
    const [isDailyMode, setIsDailyMode] = useState(false);
    
    const [seconds, setSeconds] = useState(0);
    const [isActive, setIsActive] = useState(false);
    const [isStatsOpen, setIsStatsOpen] = useState(false);
    const [stats, setStats] = useState(DEFAULT_STATS);

    const canvasSize = 400;
    const offset = 35;
    const cellSize = (canvasSize - offset * 2) / (gridSize - 1);

    const todayStr = new Date().toISOString().split('T')[0];

    useEffect(() => {
        const savedStats = localStorage.getItem('hashi_stats');
        if (savedStats) {
            setStats(JSON.parse(savedStats));
        }
    }, []);

    const updateStatsOnGameEnd = (isWin) => {
        setStats((prev) => {
            const isNewDay = prev.lastPlayedDate !== todayStr;
            if (!isNewDay && isDailyMode) return prev;

            const newPlayed = prev.played + 1;
            const newWins = isWin ? prev.wins + 1 : prev.wins;
            const newCurrentStreak = isWin ? prev.currentStreak + 1 : 0;
            const newMaxStreak = Math.max(prev.maxStreak, newCurrentStreak);

            const updated = {
                played: newPlayed,
                wins: newWins,
                currentStreak: newCurrentStreak,
                maxStreak: newMaxStreak,
                lastPlayedDate: todayStr
            };

            localStorage.setItem('hashi_stats', JSON.stringify(updated));
            return updated;
        });
    };

    const formatTime = (totalSeconds) => {
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    useEffect(() => {
        let interval = null;
        if (isActive) {
            interval = setInterval(() => {
                setSeconds(prev => prev + 1);
            }, 1000);
        } else {
            clearInterval(interval);
        }
        return () => clearInterval(interval);
    }, [isActive]);

    const startNewGame = (daily = false) => {
        setMessage('');
        setIsDailyMode(daily);
        setSeconds(0);
        setIsActive(true);
        setIsStatsOpen(false);

        let rng = Math.random;
        let targetSize = gridSize;

        if (daily) {
            const seedNum = parseInt(todayStr.replace(/-/g, ''), 10);
            rng = mulberry32(seedNum);

            const sizes = [5, 6, 7, 8];
            targetSize = sizes[Math.floor(rng() * sizes.length)];
            setGridSize(targetSize);
        }

        const generator = new PythonStyleHashiGenerator(targetSize, targetSize, rng);
        const rawIslands = generator.generate();
        
        const generatedIslands = rawIslands.map((isl, idx) => ({
            id: idx,
            r: isl.x,
            c: isl.y,
            req: isl.i_count
        }));

        if (generatedIslands.length < 3) {
            startNewGame(daily);
            return;
        }

        if (daily) {
            const savedSolved = localStorage.getItem(`hashi_solved_${todayStr}`);
            if (savedSolved === 'true') {
                setMessage('🎉 Daily Puzzle Already Completed Today!');
            }
        }

        setGameState({ islands: generatedIslands, bridges: [] });
    };

    useEffect(() => {
        if (!isDailyMode) {
            startNewGame(false);
        }
    }, [gridSize]);

    useEffect(() => {
        startNewGame(true);
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.strokeStyle = '#21262d';
        ctx.lineWidth = 1;
        for (let i = 0; i < gridSize; i++) {
            let pos = offset + i * cellSize;
            ctx.beginPath();
            ctx.moveTo(pos, offset);
            ctx.lineTo(pos, offset + (gridSize - 1) * cellSize);
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(offset, pos);
            ctx.lineTo(offset + (gridSize - 1) * cellSize, pos);
            ctx.stroke();
        }

        gameState.bridges.forEach(b => {
            let i1 = gameState.islands.find(i => i.id === b.from);
            let i2 = gameState.islands.find(i => i.id === b.to);
            if (!i1 || !i2) return;

            let x1 = offset + i1.c * cellSize;
            let y1 = offset + i1.r * cellSize;
            let x2 = offset + i2.c * cellSize;
            let y2 = offset + i2.r * cellSize;

            ctx.strokeStyle = '#39ff14';
            ctx.lineWidth = 3;

            if (b.count === 1) {
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();
            } else if (b.count === 2) {
                let dx = x2 - x1, dy = y2 - y1;
                let len = Math.hypot(dx, dy);
                let nx = len === 0 ? 0 : (-dy / len) * 5;
                let ny = len === 0 ? 0 : (dx / len) * 5;

                ctx.beginPath();
                ctx.moveTo(x1 + nx, y1 + ny);
                ctx.lineTo(x2 + nx, y2 + ny);
                ctx.moveTo(x1 - nx, y1 - ny);
                ctx.lineTo(x2 - nx, y2 - ny);
                ctx.stroke();
            }
        });

        gameState.islands.forEach(island => {
            let x = offset + island.c * cellSize;
            let y = offset + island.r * cellSize;
            
            let currentDeg = 0;
            gameState.bridges.forEach(b => {
                if (b.from === island.id || b.to === island.id) currentDeg += b.count;
            });

            ctx.beginPath();
            ctx.arc(x, y, Math.max(12, 18 - gridSize), 0, Math.PI * 2);

            if (currentDeg === island.req) {
                ctx.fillStyle = '#2ea043';
            } else if (currentDeg > island.req) {
                ctx.fillStyle = '#da3633';
            } else {
                ctx.fillStyle = '#21262d';
            }

            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#30363d';
            ctx.stroke();

            ctx.fillStyle = '#f0f6fc';
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(island.req, x, y);
        });

    }, [gameState, gridSize]);

    const handleCanvasClick = (e) => {
        if (!isActive) return;

        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const px = (e.clientX - rect.left) * scaleX;
        const py = (e.clientY - rect.top) * scaleY;

        let clickedPair = null;
        let minDistance = Infinity;
        const { islands, bridges } = gameState;

        for (let i = 0; i < islands.length; i++) {
            for (let j = i + 1; j < islands.length; j++) {
                let i1 = islands[i];
                let i2 = islands[j];

                if (i1.r !== i2.r && i1.c !== i2.c) continue;

                let blocked = false;
                for (let other of islands) {
                    if (other.id === i1.id || other.id === i2.id) continue;
                    if (i1.r === i2.r && other.r === i1.r) {
                        if (other.c > Math.min(i1.c, i2.c) && other.c < Math.max(i1.c, i2.c)) { blocked = true; break; }
                    }
                    if (i1.c === i2.c && other.c === i1.c) {
                        if (other.r > Math.min(i1.r, i2.r) && other.r < Math.max(i1.r, i2.r)) { blocked = true; break; }
                    }
                }
                if (blocked) continue;

                let x1 = offset + i1.c * cellSize;
                let y1 = offset + i1.r * cellSize;
                let x2 = offset + i2.c * cellSize;
                let y2 = offset + i2.r * cellSize;

                let dist = distanceToSegment(px, py, x1, y1, x2, y2);
                if (dist < 22 && dist < minDistance) {
                    minDistance = dist;
                    clickedPair = [i1, i2];
                }
            }
        }

        if (clickedPair) {
            let [i1, i2] = clickedPair;
            let nId1 = Math.min(i1.id, i2.id);
            let nId2 = Math.max(i1.id, i2.id);

            let existingIndex = bridges.findIndex(b => b.from === nId1 && b.to === nId2);

            if (existingIndex === -1) {
                let crosses = false;
                for (let b of bridges) {
                    let b1 = islands.find(isl => isl.id === b.from);
                    let b2 = islands.find(isl => isl.id === b.to);
                    if (doSegmentsCross(i1, i2, b1, b2)) {
                        crosses = true;
                        break;
                    }
                }
                if (crosses) return;
            }

            let updatedBridges = [...bridges];
            if (existingIndex !== -1) {
                if (updatedBridges[existingIndex].count === 1) {
                    updatedBridges[existingIndex] = { ...updatedBridges[existingIndex], count: 2 };
                } else {
                    updatedBridges.splice(existingIndex, 1);
                }
            } else {
                updatedBridges.push({ from: nId1, to: nId2, count: 1 });
            }

            setGameState(prev => ({ ...prev, bridges: updatedBridges }));

            const allMet = islands.every(island => {
                let deg = 0;
                updatedBridges.forEach(b => {
                    if (b.from === island.id || b.to === island.id) deg += b.count;
                });
                return deg === island.req;
            });

            if (allMet && islands.length > 0) {
                setIsActive(false);
                setMessage('🎉 Puzzle Solved Successfully!');
                updateStatsOnGameEnd(true);
                setIsStatsOpen(true);
                if (isDailyMode) {
                    localStorage.setItem(`hashi_solved_${todayStr}`, 'true');
                }
            } else {
                setMessage('');
            }
        }
    };

    return (
        <>
            <Navbar />
            <div className="hashi-container">
                <div className="skeedle-header">
                    <h2>Hashkeet {isDailyMode && <span style={{ fontSize: '14px', color: '#58a6ff' }}>(Daily)</span>}</h2>
                    <button className="stats-btn hashi-btn" onClick={() => setIsStatsOpen(true)} style={{ padding: '4px 10px' }}>
                        STATS
                    </button>
                </div>
                
                <div className="hashi-status-bar">
                    <span>Connect islands</span>
                    <span style={{ fontWeight: 'bold', color: '#39ff14' }}>⏱️ {formatTime(seconds)}</span>
                </div>

                <div className="hashi-controls" style={{ marginBottom: '10px' }}>
                    <button 
                        onClick={() => startNewGame(true)} 
                        className="hashi-btn" 
                        style={{ background: isDailyMode ? '#1f6feb' : '#000000', borderColor: isDailyMode ? '#58a6ff' : '#30363d' }}
                    >
                        Daily
                    </button>
                    <button 
                        onClick={() => startNewGame(false)} 
                        className="hashi-btn" 
                        style={{ background: !isDailyMode ? '#ff69b4' : '#000000', borderColor: !isDailyMode ? '#ffb6c1' : '#30363d' }}
                    >
                        Random
                    </button>
                    <button onClick={() => { setGameState(prev => ({ ...prev, bridges: [] })); setSeconds(0); setIsActive(true); }} className="hashi-btn">Reset</button>
                </div>

                {!isDailyMode && (
                    <div className="hashi-controls" style={{ marginBottom: '15px' }}>
                        <label style={{ color: '#f0f6fc', fontWeight: 'bold', fontSize: '14px' }}>Board Size:</label>
                        <select 
                            value={gridSize} 
                            onChange={(e) => {
                                setIsDailyMode(false);
                                setGridSize(Number(e.target.value));
                            }}
                            className="hashi-select"
                        >
                            <option value={5}>5 x 5</option>
                            <option value={6}>6 x 6</option>
                            <option value={7}>7 x 7</option>
                            <option value={8}>8 x 8</option>
                        </select>
                    </div>
                )}

                <div className="hashi-directions">
                    <strong>How to Play:</strong> Click between two islands to draw a bridge. Click again to make it a double bridge, or a third time to remove it. Total bridges connected to each island must match its number. Bridges cannot cross each other.
                </div>

                <div className="hashi-canvas-wrapper">
                    <canvas 
                        ref={canvasRef} 
                        width={canvasSize} 
                        height={canvasSize} 
                        onPointerDown={handleCanvasClick}
                        className="hashi-canvas"
                    />

                    <StatsModal
                        isOpen={isStatsOpen}
                        onClose={() => setIsStatsOpen(false)}
                        stats={stats}
                        time={!isActive ? formatTime(seconds) : null}
                    />
                </div>
                
                <div className="hashi-message">{message}</div>
            </div>
        </>
    );
}