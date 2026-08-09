import { useState } from 'react';
import { useApp } from '../App.jsx';
import { getExpensesForMonth, getTotalAmount, formatAmount, getMonthName, todayISO } from '../utils/helpers.js';
import { exportJSON, exportCSV, importJSON } from '../utils/storage.js';
import SavingsGoals from './SavingsGoals.jsx';
import ExpenseModal from './ExpenseModal.jsx';
import ImportConfirmModal from './ImportConfirmModal.jsx';
import ExpenseItem from './ExpenseItem.jsx';
import BudgetPanel from './BudgetPanel.jsx';
import Charts from './Charts.jsx';

export default function Home() {
  const { data, navigateTo, importData, showToast, deleteRecurring } = useApp();
  const [adding, setAdding] = useState(false);
  const [showCharts, setShowCharts] = useState(false);
  const [pendingImport, setPendingImport] = useState(null);
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const thisMonth = getExpensesForMonth(data.expenses, year, month);
  const total = getTotalAmount(thisMonth);
  const recent = [...thisMonth].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  const lastMonthDate = new Date(year, month - 1, 1);
  const lastMonth = getExpensesForMonth(data.expenses, lastMonthDate.getFullYear(), lastMonthDate.getMonth());
  const lastTotal = getTotalAmount(lastMonth);
  const delta = lastTotal > 0 ? ((total - lastTotal) / lastTotal) * 100 : null;

  // Import never applies straight away — it replaces every record, so the user
  // gets to compare the counts first.
  function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    importJSON(file)
      .then(setPendingImport)
      .catch((err) => showToast(err.message, 'danger'));
    e.target.value = '';
  }

  function confirmImport() {
    importData(pendingImport.data, { skipped: pendingImport.skipped });
    setPendingImport(null);
  }

  return (
    <div className="home view">
      <div className="home__hero">
        <div>
          <div className="home__greeting">Zdravo 👋</div>
          <div className="home__sub">
            {getMonthName(month)} {year} — pratite, analizirajte, štedite.
          </div>
        </div>
        <button className="home__add-btn" onClick={() => setAdding(true)} aria-label="Dodaj trošak">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          Novi trošak
        </button>
      </div>

      <div className="overview-card">
        <div className="overview-card__main">
          <div className="overview-card__label">Potrošeno ovaj mesec</div>
          <div className="overview-card__value-row">
            <div className="overview-card__value">{total.toLocaleString('sr-RS')}</div>
            <div className="overview-card__unit">RSD</div>
          </div>
          {delta !== null && (
            <div className={`overview-card__badge ${delta > 0 ? 'overview-card__badge--warn' : ''}`}>
              {delta > 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(0)}% {delta > 0 ? 'više' : 'manje'} nego prošlog meseca
            </div>
          )}
        </div>
        <div className="overview-card__side">
          <div className="overview-card__row">
            <span className="overview-card__row-label">Transakcija</span>
            <span className="overview-card__row-value">{thisMonth.length}</span>
          </div>
          <div className="overview-card__row">
            <span className="overview-card__row-label">Prosek po stavci</span>
            <span className="overview-card__row-value">
              {thisMonth.length > 0 ? formatAmount(total / thisMonth.length) : '—'}
            </span>
          </div>
          <div className="overview-card__row">
            <span className="overview-card__row-label">Prošli mesec</span>
            <span className="overview-card__row-value">
              {lastTotal > 0 ? formatAmount(lastTotal) : '—'}
            </span>
          </div>
        </div>
      </div>

      <BudgetPanel year={year} month={month} />

      <div className="section-block">
        <div className="section-head">
          <div className="section-head__title">Poslednje transakcije</div>
          <button className="section-head__link" onClick={() => navigateTo('current')}>Vidi sve →</button>
        </div>
        {recent.length > 0 ? (
          <div className="recent-list">
            {recent.map((e) => <ExpenseItem key={e.id} expense={e} />)}
          </div>
        ) : (
          <div className="expense-list">
            <div className="expense-list__empty">
              <div className="expense-list__empty-icon">💸</div>
              Nema troškova za ovaj mesec. Dodaj prvi!
            </div>
          </div>
        )}
      </div>

      <div className="section-block">
        <div className="section-head">
          <div>
            <div className="section-head__title">Grafikoni i uvidi</div>
            <div className="section-head__sub">Detaljna analiza potrošnje — prikaži kad ti zatreba.</div>
          </div>
          <button
            className={`section-head__toggle ${showCharts ? 'section-head__toggle--active' : ''}`}
            onClick={() => setShowCharts((v) => !v)}
          >
            📊 {showCharts ? 'Sakrij' : 'Prikaži'}
          </button>
        </div>
        {showCharts && <Charts expenses={thisMonth} year={year} month={month} />}
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
        <div className="home__recurring section-block">
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

      {pendingImport && (
        <ImportConfirmModal
          current={data}
          incoming={pendingImport.data}
          skipped={pendingImport.skipped}
          onCancel={() => setPendingImport(null)}
          onConfirm={confirmImport}
        />
      )}
    </div>
  );
}
