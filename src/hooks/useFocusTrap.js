import { useEffect, useRef } from 'react';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Dialog focus behaviour for the element in `ref`:
 *  - Tab and Shift+Tab wrap around inside it instead of walking out into the page
 *    behind the overlay, which for a keyboard user is indistinguishable from the
 *    dialog having closed;
 *  - focus moves inside on open (unless something already claimed it, e.g. autoFocus);
 *  - on unmount focus returns to whatever opened the dialog.
 *
 * `active: false` suspends only the trap — the restore is tied to unmount, so a
 * stacked dialog can take over the trap without the parent yanking focus back.
 */
export default function useFocusTrap(ref, { active = true, restoreFocus = true } = {}) {
  // Captured during render, before the commit runs autoFocus and moves activeElement.
  const restoreTo = useRef(undefined);
  if (restoreTo.current === undefined) restoreTo.current = document.activeElement;

  useEffect(() => {
    if (!restoreFocus) return undefined;
    const target = restoreTo.current;
    return () => target?.focus?.();
  }, [restoreFocus]);

  useEffect(() => {
    const node = ref.current;
    if (!active || !node) return undefined;

    const items = () =>
      [...node.querySelectorAll(FOCUSABLE)].filter((el) => !el.hasAttribute('hidden'));

    if (!node.contains(document.activeElement)) items()[0]?.focus();

    function onKeyDown(e) {
      if (e.key !== 'Tab') return;
      const list = items();
      if (list.length === 0) { e.preventDefault(); return; }
      const first = list[0];
      const last = list[list.length - 1];
      const current = document.activeElement;
      const outside = !node.contains(current);
      if (e.shiftKey && (outside || current === first)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (outside || current === last)) {
        e.preventDefault();
        first.focus();
      }
    }

    node.addEventListener('keydown', onKeyDown);
    return () => node.removeEventListener('keydown', onKeyDown);
  }, [ref, active]);
}
