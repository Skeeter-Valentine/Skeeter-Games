import { useLocation } from 'react-router-dom';
import FeedbackForm from './Feedback';
import { pageFor } from '../seo/pages.js';
import './GameFeedback.css';

export default function GameFeedback() {
  const { pathname } = useLocation();
  const page = pageFor(pathname);
  if (!page || page.path === '/' || page.kind === 'info') return null;
  return <section className="game-feedback" aria-label={`${page.name} feedback`}
    onKeyDown={event => event.stopPropagation()} onKeyUp={event => event.stopPropagation()}>
    <FeedbackForm key={page.path} pageName={page.name} pagePath={page.path} />
  </section>;
}
