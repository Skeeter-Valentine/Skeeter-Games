import { useEffect, useRef } from 'react';

// Ctrl+Z (Cmd+Z on a Mac) undoes; Ctrl+Shift+Z or Ctrl+Y redoes, when the
// game has redo. Ignored while typing in a field or while a dialog is open.
export default function useUndoShortcut(undo, redo) {
  const actions = useRef({ undo, redo });
  actions.current = { undo, redo };
  useEffect(() => {
    function onKey(event) {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      if (event.target.closest?.('input, textarea, select, [contenteditable="true"], [role="dialog"]') || document.querySelector('[role="dialog"]')) return;
      const key = event.key.toLowerCase();
      const { undo: back, redo: forward } = actions.current;
      if (key === 'z' && !event.shiftKey && back) { event.preventDefault(); back(); }
      else if (((key === 'z' && event.shiftKey) || key === 'y') && forward) { event.preventDefault(); forward(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
