import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { pageFor } from '../seo/pages.js';
import { ads } from './ads.js';
import AdSlot from './AdSlot.jsx';

// Side rails need room beside the widest games. At 1400px every page leaves
// at least ~200px each side (the homepage grid and Skeedoku are the widest),
// enough for a 160px rail; from 1760px there is room for 300px rails. Rails
// also need a screen at least 700px tall to fit a 600px ad. If a new game is
// wider than the current ones, raise these breakpoints.
const RAILS = '(min-width: 1400px) and (min-height: 700px)';
const WIDE_RAILS = '(min-width: 1760px) and (min-height: 700px)';

// Rail width in px for the current screen (0 = no rails). Both queries are read
// together, so a big resize lands on the final size in one step instead of
// briefly mounting (and requesting) the in-between size.
const readRailWidth = () => (typeof window === 'undefined' ? 0
  : window.matchMedia(WIDE_RAILS).matches ? 300 : window.matchMedia(RAILS).matches ? 160 : 0);

function useRailWidth() {
  const [width, setWidth] = useState(readRailWidth);
  useEffect(() => {
    const queries = [RAILS, WIDE_RAILS].map(query => window.matchMedia(query));
    const update = () => setWidth(readRailWidth());
    queries.forEach(media => media.addEventListener('change', update));
    return () => queries.forEach(media => media.removeEventListener('change', update));
  }, []);
  return width;
}

// Page-level ads: two side rails on wide screens, otherwise one ad under the
// game (phones, tablets and small laptops have no room at the sides). Not
// shown on the About/Privacy pages, the hidden admin page or the 404 page.
export default function PageAds() {
  const page = pageFor(useLocation().pathname);
  const railWidth = useRailWidth();
  if (!page || page.kind === 'info') return null;
  // Fall back to the bottom ad if no side ad unit has been set up yet.
  const railsReady = ads.adsense ? !!ads.slots.side : ads.preview;
  if (!railWidth || !railsReady) return <AdSlot placement="belowGame" />;
  const size = { width: railWidth, height: 600 };
  return <>
    <AdSlot key={`left-${size.width}`} placement="side" side="left" size={size} />
    <AdSlot key={`right-${size.width}`} placement="side" side="right" size={size} />
  </>;
}
