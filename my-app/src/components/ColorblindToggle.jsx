import { useColorblind } from './colorblind.js';
import './Colorblind.css';

export default function ColorblindToggle() {
  const [on, setOn] = useColorblind();
  return <button type="button" role="switch" aria-checked={on} className="colorblind-switch"
    title={on ? 'Colorblind colors on: orange = right spot, blue = wrong spot, gray = not in word' : 'Use colorblind-friendly colors'}
    onClick={() => setOn(!on)}>
    <span className="colorblind-switch-label">Colorblind</span>
    <span className="colorblind-switch-track" aria-hidden="true"><span className="colorblind-switch-thumb" /></span>
  </button>;
}
