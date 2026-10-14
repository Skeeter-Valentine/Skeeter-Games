import { useColorblind } from './colorblind.js';
import './Colorblind.css';

export default function ColorblindToggle() {
  const [on, setOn] = useColorblind();
  return <button type="button" role="switch" aria-checked={on} className="colorblind-switch"
    title={on ? 'Colorblind colors on: orange = right spot, blue = wrong spot, gray = not in word' : 'Use colorblind-friendly colors'}
    onClick={event => {
      setOn(!on);
      // A mouse click or tap must not leave focus here: the word games use Enter
      // to submit guesses, and Enter on a focused switch would flip it instead.
      if (event.detail > 0) event.currentTarget.blur();
    }}
    // Switches toggle with Space; Enter is left for submitting guesses.
    onKeyDown={event => { if (event.key === 'Enter') event.preventDefault(); }}>
    <span className="colorblind-switch-label">Colorblind</span>
    <span className="colorblind-switch-track" aria-hidden="true"><span className="colorblind-switch-thumb" /></span>
  </button>;
}
