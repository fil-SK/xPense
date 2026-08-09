import { useState } from 'react';
import { formatAmount, formatDate, categoryColor } from '../utils/helpers.js';
import { useApp } from '../App.jsx';
import ExpenseModal from './ExpenseModal.jsx';

export default function ExpenseItem({ expense }) {
  const { data, deleteExpense } = useApp();
  const [editing, setEditing] = useState(false);

  const color = categoryColor(expense.category, data.categories);

  // One click, no confirm — the undo on the toast is what covers a misclick,
  // and unlike a second click it also covers the deletes the user meant to
  // make and then regretted.
  function handleDelete(e) {
    e.stopPropagation();
    deleteExpense(expense.id);
  }

  // The row can't be a real <button> — it wraps the edit/delete buttons, and a
  // button may not nest interactive content — so it gets the keyboard contract
  // by hand. Those nested buttons bubble their own Enter/Space up here, hence
  // the target check: without it, ✏️ would open the modal twice and 🗑️ would
  // open it on top of the delete. Space is prevented so it doesn't scroll.
  function handleKeyDown(e) {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setEditing(true);
    }
  }

  return (
    <>
      <div
        className="expense-item"
        role="button"
        tabIndex={0}
        aria-label={`Izmeni trošak: ${expense.title}`}
        onClick={() => setEditing(true)}
        onKeyDown={handleKeyDown}
      >
        <span className="expense-item__icon" style={{ background: color + '22' }}>
          <span className="expense-item__cat-dot" style={{ background: color }} />
        </span>
        <div className="expense-item__body">
          <div className="expense-item__title">{expense.title}</div>
          <div className="expense-item__meta">
            <span>{formatDate(expense.date)}</span>
            <span className="expense-item__cat-badge" style={{ background: color + '22', color }}>
              {expense.category}
            </span>
            {expense.recurringId && <span className="expense-item__recurring" title="Ponavljajući trošak">🔄</span>}
            {expense.note && <span title={expense.note}>📝</span>}
          </div>
        </div>
        <div className="expense-item__amount">{formatAmount(expense.amount)}</div>
        <div className="expense-item__actions" onClick={(e) => e.stopPropagation()}>
          <button
            className="btn btn--icon btn--ghost btn--sm"
            title="Izmeni"
            onClick={(e) => { e.stopPropagation(); setEditing(true); }}
          >
            ✏️
          </button>
          <button
            className="btn btn--icon btn--ghost btn--sm"
            title="Obriši"
            aria-label={`Obriši trošak: ${expense.title}`}
            onClick={handleDelete}
          >
            🗑️
          </button>
        </div>
      </div>

      {editing && <ExpenseModal expense={expense} onClose={() => setEditing(false)} />}
    </>
  );
}
