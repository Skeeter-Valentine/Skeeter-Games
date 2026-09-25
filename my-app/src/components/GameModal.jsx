import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './DailyResults.css';

export default function GameModal({ titleId, onClose, children }) {
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement;
    element.showModal();
    const stopGameKeys = event => event.stopPropagation();
    element.addEventListener('keydown', stopGameKeys);
    return () => {
      element.removeEventListener('keydown', stopGameKeys);
      element.close();
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  return createPortal(<dialog ref={dialog} className="daily-results-dialog" aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="daily-results-content">
      <button type="button" className="daily-results-close" aria-label="Close dialog" onClick={onClose}>×</button>
      {children}
      <button type="button" className="daily-results-done" onClick={onClose}>Back to game</button>
    </div>
  </dialog>, document.body);
}
