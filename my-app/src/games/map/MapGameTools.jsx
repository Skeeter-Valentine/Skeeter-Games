import { useEffect, useState } from 'react';
import GameToolbar from '../../components/GameToolbar';
import GameModal from '../../components/GameModal';
import { readLocal, writeLocal } from '../../utils/dailyStats.js';

const STORAGE_KEY = 'skeeter:map-completions:v1';
function readCompletions() {
  const saved = readLocal(STORAGE_KEY, []);
  return Array.isArray(saved) ? [...new Set(saved.filter(value => typeof value === 'string'))] : [];
}

export default function MapGameTools({ puzzleId, won, filled, total, actions }) {
  const [open, setOpen] = useState(false);
  const [completed, setCompleted] = useState(readCompletions);
  useEffect(() => {
    if (!won) return;
    const timer = setTimeout(() => {
      const saved = [...new Set([...readCompletions(), puzzleId])];
      writeLocal(STORAGE_KEY, saved);
      setCompleted(saved);
    }, 0);
    return () => clearTimeout(timer);
  }, [won, puzzleId]);

  return <>
    <GameToolbar gameId="map" title="Skeedomap" onStats={() => { setCompleted(readCompletions()); setOpen(true); }} />
    {open && <GameModal titleId="map-statistics" onClose={() => setOpen(false)}>
      <p className="daily-results-eyebrow">Skeedomap</p>
      <h2 id="map-statistics">Your map statistics</h2>
      <div className="daily-results-grid">
        <div><strong>{completed.length}</strong><span>Maps completed</span></div>
        <div><strong>{filled} / {total}</strong><span>Regions colored</span></div>
        <div><strong>{actions}</strong><span>Actions on this board</span></div>
      </div>
      <p className="daily-results-note">{won ? 'This map is complete.' : 'This map is in progress.'} Completed maps are saved in this browser and counted once per puzzle. Map has no daily mode.</p>
    </GameModal>}
  </>;
}
