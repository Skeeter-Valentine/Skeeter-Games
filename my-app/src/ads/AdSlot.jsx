import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { ads } from './ads.js';
import './AdSlot.css';

// Ad units already handed to AdSense. React's development mode runs effects
// twice, and AdSense throws if the same unit is filled twice.
const filled = new WeakSet();

// One reserved, labelled ad space. It renders nothing unless AdSense is on and
// this placement has an ad unit ID (or the layout preview is on), so the site
// looks the same as before until ads are switched on. `size` makes a fixed-size
// unit (the side rails); without it the unit is responsive and fills the width.
export default function AdSlot({ placement, side, size }) {
  const { pathname, search } = useLocation();
  const unit = useRef(null);
  const slot = ads.adsense ? ads.slots[placement] : '';
  const page = `${pathname}${search}`;

  useEffect(() => {
    const ins = unit.current;
    if (!slot || !ins || filled.has(ins)) return;
    filled.add(ins);
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); }
    catch (error) { console.warn('Ad slot could not load', error); }
  }, [slot, page]);

  if (!slot && !ads.preview) return null;
  const fixed = size ? { display: 'inline-block', width: size.width, height: size.height } : { display: 'block' };
  return <aside className={`ad-slot ad-slot-${placement}${side ? ` ad-slot-${placement}-${side}` : ''}`} aria-label="Advertisement">
    <span className="ad-slot-label">Advertisement</span>
    {slot
      // A new unit for each page (and archive date), so ads refresh as players move around.
      ? <ins key={page} ref={unit} className="adsbygoogle" style={fixed} data-ad-client={ads.client} data-ad-slot={slot}
          {...(size ? {} : { 'data-ad-format': 'auto', 'data-full-width-responsive': 'true' })} />
      : <div className="ad-slot-preview" style={size}>Ad space · {placement}{size && <><br />{size.width} × {size.height}</>}</div>}
  </aside>;
}
