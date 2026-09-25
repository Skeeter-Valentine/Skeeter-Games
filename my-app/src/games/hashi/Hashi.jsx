import DailyResults from '../../components/DailyResults';
// src/games/hashi/Hashi.jsx
import React, { useState, useEffect, useRef } from 'react';
import StatsModal from './components/StatsModal';
import Navbar from '../../components/Navbar';
import './Hashi.css';

import { mulberry32, generateUniquePuzzle } from './puzzle.js';
import { doSegmentsCross, isConnected } from './solver.js';

function distanceToSegment(px, py, x1, y1, x2, y2) {
    let l2 = (x2 - x1)**2 + (y2 - y1)**2;
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1)*(x2 - x1) + (py - y1)*(y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    let projx = x1 + t * (x2 - x1);
    let projy = y1 + t * (y2 - y1);
    return Math.hypot(px - projx, py - projy);
}

const DEFAULT_STATS = {
    played: 0,
    wins: 0,
    currentStreak: 0,
    maxStreak: 0,
    lastPlayedDate: null
};

export default function Hashi({ onWin }) {
    const canvasRef = useRef(null);
    const [message, setMessage] = useState('');
    const [gridSize, setGridSize] = useState(6);
    const [gameState, setGameState] = useState({ islands: [], bridges: [] });
    const [isDailyMode, setIsDailyMode] = useState(false);
    
    const [seconds, setSeconds] = useState(0);
    const [isSolved, setIsSolved] = useState(false);
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
        setIsSolved(false);
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

        const generatedIslands = generateUniquePuzzle(targetSize, rng);

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

            if (allMet && isConnected(islands, updatedBridges)) {
                setIsActive(false);
                setMessage('🎉 Puzzle Solved Successfully!');
                setIsSolved(true);
                if (!isDailyMode) {
                    updateStatsOnGameEnd(true);
                    setIsStatsOpen(true);
                }
                if (isDailyMode) {
                    localStorage.setItem(`hashi_solved_${todayStr}`, 'true');
                }
                // Notify the gauntlet that this game has been successfully won!
                onWin?.();
            } else {
                setMessage('');
            }
        }
    };

    return (
        <>
            <Navbar />
      <DailyResults gameId="hashi" title="Hashi" daily={isDailyMode} date={todayStr} finished={isSolved} seconds={seconds} ready={gameState.islands.length > 0} manualOpen={isStatsOpen} onClose={() => setIsStatsOpen(false)} legacyStats={stats} />
            <div className="hashi-container">
                <div className="skeedle-header">
                    <h2>Hashkeet {isDailyMode && <span style={{ fontSize: '14px', color: '#58a6ff' }}>(Daily)</span>}</h2>
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
                    <button onClick={() => { setGameState(prev => ({ ...prev, bridges: [] })); setSeconds(0); setIsActive(true); setIsSolved(false); }} className="hashi-btn">Reset</button>
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
                    <strong>How to Play:</strong> Click between two islands to draw a bridge. Click again to make it a double bridge, or a third time to remove it. Total bridges connected to each island must match its number. Bridges cannot cross each other. All islands must form one connected network.
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
                        isOpen={isStatsOpen && !isDailyMode}
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