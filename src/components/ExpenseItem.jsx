import { useState } from 'react';
import { formatAmount, formatDate, CHART_COLORS } from '../utils/helpers.js';
import { useApp } from '../App.jsx';
import ExpenseModal from './ExpenseModal.jsx';

function categoryColor(category, categories) {
  const idx = categories.indexOf(category);
  return CHART_COLORS[idx >= 0 ? idx % CHART_COLORS.length : 0];
}

export default function ExpenseItem({ expense }) {
  const { data, deleteExpense } = useApp();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const color = categoryColor(expense.category, data.categories);

  function handleDelete(e) {
    e.stopPropagation();
    if (confirmDelete) {
      deleteExpense(expense.id);
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 2500);
    }
  }

  return (
    <>
      <div className="expense-item" onClick={() => setEditing(true)}>
        <span className="expense-item__cat-dot" style={{ background: color }} />
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
            className={`btn btn--icon btn--sm ${confirmDelete ? 'btn--danger' : 'btn--ghost'}`}
            title={confirmDelete ? 'Klikni ponovo za brisanje' : 'Obriši'}
            onClick={handleDelete}
          >
            {confirmDelete ? '⚠️' : '🗑️'}
          </button>
        </div>
      </div>

      {editing && <ExpenseModal expense={expense} onClose={() => setEditing(false)} />}
    </>
  );
}
