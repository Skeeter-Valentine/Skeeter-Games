import { SITE_NAME } from '../siteInfo.js';
import './SiteFooter.css';

// Plain links (no router hooks) so the prerender script can render the footer
// into every static page as well.
export default function SiteFooter({ onPrivacyChoices }) {
  return <footer className="site-footer">
    <nav aria-label="Site information">
      <a href="/">All puzzles</a>
      <a href="/about">About</a>
      <a href="/privacy">Privacy policy</a>
      {onPrivacyChoices && <button type="button" onClick={onPrivacyChoices}>Privacy choices</button>}
    </nav>
    <p>© {new Date().getUTCFullYear()} {SITE_NAME}. Free daily puzzles.</p>
  </footer>;
}
