import { useState } from 'react';
import { useApp } from '../App.jsx';
import { getExpensesForMonth, getTotalAmount, formatAmount, getMonthName, todayISO } from '../utils/helpers.js';
import { exportJSON, exportCSV, importJSON } from '../utils/storage.js';
import SavingsGoals from './SavingsGoals.jsx';
import ExpenseModal from './ExpenseModal.jsx';

export default function Home() {
  const { data, navigateTo, importData, showToast, deleteRecurring } = useApp();
  const [adding, setAdding] = useState(false);
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const thisMonth = getExpensesForMonth(data.expenses, year, month);
  const total = getTotalAmount(thisMonth);

  const lastMonthDate = new Date(year, month - 1, 1);
  const lastMonth = getExpensesForMonth(data.expenses, lastMonthDate.getFullYear(), lastMonthDate.getMonth());
  const lastTotal = getTotalAmount(lastMonth);
  const delta = lastTotal > 0 ? ((total - lastTotal) / lastTotal) * 100 : null;

  function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    importJSON(file)
      .then(importData)
      .catch((err) => showToast(err.message, 'danger'));
    e.target.value = '';
  }

  return (
    <div className="home">
      <div className="home__hero">
        <div className="home__hero__row">
          <div className="home__greeting">
            Zdravo! 👋 <span>Kontroliši</span> svoje troškove.
          </div>
          <button className="home__add-btn" onClick={() => setAdding(true)} title="Dodaj trošak" aria-label="Dodaj trošak">
            +
          </button>
        </div>
        <div className="home__sub">
          {getMonthName(month)} {year} — pratite, analizirajte, štedite.
        </div>
      </div>

      <div className="home__summary">
        <div className="stat-card">
          <div className="stat-card__label">Ovaj mesec</div>
          <div className="stat-card__value stat-card__value--primary">{formatAmount(total)}</div>
          {delta !== null && (
            <div className={`stat-card__delta ${delta > 0 ? 'stat-card__delta--up' : 'stat-card__delta--down'}`}>
              {delta > 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(0)}% vs prošli mesec
            </div>
          )}
        </div>
        <div className="stat-card">
          <div className="stat-card__label">Transakcija</div>
          <div className="stat-card__value">{thisMonth.length}</div>
          <div className="stat-card__delta">u {getMonthName(month)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">Prosek po stavci</div>
          <div className="stat-card__value">
            {thisMonth.length > 0 ? formatAmount(total / thisMonth.length) : '—'}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">Prošli mesec</div>
          <div className="stat-card__value">{lastTotal > 0 ? formatAmount(lastTotal) : '—'}</div>
          <div className="stat-card__delta">{getMonthName(lastMonthDate.getMonth())}</div>
        </div>
      </div>

      <div className="home__actions">
        <div className="action-card" onClick={() => navigateTo('current')}>
          <div className="action-card__icon">📅</div>
          <div className="action-card__title">Potrošnja ovog meseca</div>
          <div className="action-card__desc">
            Pregledaj i unesi troškove za {getMonthName(month)} {year}.
          </div>
        </div>
        <div className="action-card" onClick={() => navigateTo('budget')}>
          <div className="action-card__icon">💰</div>
          <div className="action-card__title">Budžet {year}</div>
          <div className="action-card__desc">
            Plata, bonusi i fondovi — prati prihode i planirane rashode po mesecima.
          </div>
        </div>
      </div>

      <div className="home__tools">
        <button className="btn btn--ghost btn--sm" onClick={() => exportJSON(data)}>
          ⬇️ Izvezi JSON (za Claude)
        </button>
        <button className="btn btn--ghost btn--sm" onClick={() => exportCSV(data)}>
          ⬇️ Izvezi CSV (Excel)
        </button>
        <label className="btn btn--ghost btn--sm" style={{ cursor: 'pointer' }}>
          ⬆️ Uvezi JSON
          <input type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
        </label>
      </div>

      {data.recurrings?.length > 0 && (
        <div className="home__recurring">
          <div className="home__section-title">Ponavljajući troškovi</div>
          <div className="recurring-list">
            {data.recurrings.map((r) => (
              <div key={r.id} className="recurring-item">
                <span className="recurring-item__icon">🔄</span>
                <div className="recurring-item__body">
                  <div className="recurring-item__title">{r.title}</div>
                  <div className="recurring-item__meta">
                    {formatAmount(r.amount)} · {r.category} · mesečno od {r.startDate.slice(0, 7)}
                  </div>
                </div>
                <button
                  className="btn btn--icon btn--ghost btn--sm"
                  title="Ukloni ponavljajući trošak (prethodni unosi ostaju)"
                  onClick={() => deleteRecurring(r.id)}
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <SavingsGoals />

      {adding && (
        <ExpenseModal defaultDate={todayISO()} onClose={() => setAdding(false)} />
      )}
    </div>
  );
}
