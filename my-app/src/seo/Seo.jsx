import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { pages, pageFor } from './pages.js';
import './seo.css';

export function Guide({ page }) {
  if (!page) return null;
  return <section className="game-guide" aria-label={`${page.name} guide`}>
    {page.path === '/' ? <h1>{page.topic}</h1> : <h2>{page.name}: {page.topic}</h2>}
    <p>{page.description}</p>
    {page.rules && <><h3>How to play</h3><ol>{page.rules.map(rule => <li key={rule}>{rule}</li>)}</ol><h3>A quick example</h3><p>{page.example}</p></>}
    <nav aria-label="Explore puzzle games"><h3>{page.path === '/' ? 'Choose a puzzle' : 'Explore more puzzles'}</h3><ul>{Object.values(pages).filter(other => other.path !== page.path).map(other => <li key={other.path}><a href={other.path}>{other.name}{other.path !== '/' && ` — ${other.topic}`}</a></li>)}</ul></nav>
  </section>;
}
export default function Seo() {
  const { pathname } = useLocation();
  const page = pageFor(pathname);
  useEffect(() => {
    document.title = page?.title || 'Page Not Found | Skeeter Games';
    const setMeta = (name, content) => {
      let tag = document.head.querySelector(`meta[name="${name}"]`);
      if (!tag) { tag = document.createElement('meta'); tag.name = name; document.head.appendChild(tag); }
      tag.content = content;
    };
    setMeta('description', page?.description || 'This puzzle page could not be found.');
    setMeta('robots', page ? 'index,follow' : 'noindex,follow');
    let canonical = document.head.querySelector('link[rel="canonical"]');
    const origin = import.meta.env.VITE_SITE_URL;
    if (page && origin) {
      if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.appendChild(canonical); }
      canonical.href = new URL(page.path, origin).href;
    } else canonical?.remove();
  }, [page]);
  return <Guide page={page} />;
}
