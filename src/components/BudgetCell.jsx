import { useState, useRef, useEffect } from 'react';
import { parseAmountInput } from '../utils/helpers.js';

// One click-to-edit amount cell in a twelve-month grid. Shared by BudgetView
// (the plan) and LiveOverview (actual income), so the same keystrokes mean the
// same thing in both — two copies would drift and then '1.500' would parse one
// way in one grid and another way in the other.
//
// `children` overrides what the cell shows when it isn't being edited, which is
// how LiveOverview renders an actual over its plan in the same cell. The draft
// is always seeded from `value` regardless: in the overview that is the
// override, so clicking an inherited cell opens an empty field and committing
// it empty writes `null` — still inherited, not silently pinned to the plan.
export function fmt(val) {
  if (val == null) return '—';
  return val.toLocaleString('sr-RS');
}

export default function BudgetCell({ value, onSave, className = '', ariaLabel, title, children }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  function startEdit() {
    setDraft(value != null ? String(value) : '');
    setEditing(true);
  }

  function commit() {
    // `undefined` is unusable input — abandon the edit rather than write it.
    // `null` is an emptied field, which clears the cell.
    const parsed = parseAmountInput(draft);
    if (parsed !== undefined) onSave(parsed);
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="bgc-input"
        aria-label={ariaLabel}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setEditing(false);
        }}
      />
    );
  }

  return (
    <span
      className={`bgc ${value != null ? 'bgc--filled' : 'bgc--empty'} ${className}`.trim()}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      title={title}
      onClick={startEdit}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          // Space would scroll the grid out from under the cell being edited.
          e.preventDefault();
          startEdit();
        }
      }}
    >
      {children ?? fmt(value)}
    </span>
  );
}
