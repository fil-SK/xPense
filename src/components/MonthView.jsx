import { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../App.jsx';
import {
  getExpensesForMonth, getTotalAmount, formatAmount,
  getMonthName, getByCategory, CHART_COLORS, todayISO,
} from '../utils/helpers.js';
import ExpenseItem from './ExpenseItem.jsx';
import ExpenseModal from './ExpenseModal.jsx';
import Charts from './Charts.jsx';
import BudgetPanel from './BudgetPanel.jsx';

const SORT_OPTIONS = [
  { value: 'date-desc', label: 'Datum (noviji)' },
  { value: 'date-asc', label: 'Datum (stariji)' },
  { value: 'amount-desc', label: 'Iznos (veći)' },
  { value: 'amount-asc', label: 'Iznos (manji)' },
  { value: 'category', label: 'Kategorija' },
];

function sortExpenses(expenses, sort) {
  return [...expenses].sort((a, b) => {
    switch (sort) {
      case 'date-desc': return b.date.localeCompare(a.date);
      case 'date-asc':  return a.date.localeCompare(b.date);
      case 'amount-desc': return b.amount - a.amount;
      case 'amount-asc':  return a.amount - b.amount;
      case 'category': return a.category.localeCompare(b.category);
      default: return 0;
    }
  });
}

export default function MonthView({ year, month, isCurrent }) {
  const { data, navigateTo } = useApp();
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('date-desc');
  const [showCharts, setShowCharts] = useState(false);
  const chartsRef = useRef(null);

  useEffect(() => {
    if (showCharts && chartsRef.current) {
      chartsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [showCharts]);

  const allExpenses = useMemo(
    () => getExpensesForMonth(data.expenses, year, month),
    [data.expenses, year, month]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const base = q
      ? allExpenses.filter(
          (e) =>
            e.title.toLowerCase().includes(q) ||
            e.category.toLowerCase().includes(q) ||
            (e.note && e.note.toLowerCase().includes(q))
        )
      : allExpenses;
    return sortExpenses(base, sort);
  }, [allExpenses, search, sort]);

  const total = getTotalAmount(allExpenses);
  const byCategory = getByCategory(allExpenses);
  const topCategory = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];
  const avg = allExpenses.length > 0 ? total / allExpenses.length : 0;

  return (
    <div className="month-view">
      <div className="month-header">
        <button
          className="month-header__back"
          onClick={() => navigateTo(isCurrent ? 'home' : 'previous')}
          title="Nazad"
        >
          ←
        </button>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 className="month-header__title">
              {getMonthName(month)} {year}
            </h1>
            {isCurrent && <span className="month-header__badge">Ovaj mesec</span>}
          </div>
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-card__label">Ukupno potrošeno</div>
          <div className="stat-card__value stat-card__value--primary">{formatAmount(total)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">Broj transakcija</div>
          <div className="stat-card__value">{allExpenses.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">Prosek po stavci</div>
          <div className="stat-card__value">{allExpenses.length > 0 ? formatAmount(avg) : '—'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">Najveća kategorija</div>
          <div className="stat-card__value" style={{ fontSize: 16 }}>
            {topCategory
              ? (
                <>
                  <span
                    style={{
                      display: 'inline-block',
                      width: 10, height: 10, borderRadius: '50%', marginRight: 6,
                      background: CHART_COLORS[data.categories.indexOf(topCategory[0]) % CHART_COLORS.length],
                    }}
                  />
                  {topCategory[0]}
                </>
              )
              : '—'}
          </div>
          {topCategory && (
            <div className="stat-card__delta">{formatAmount(topCategory[1])}</div>
          )}
        </div>
      </div>

      <BudgetPanel year={year} month={month} />

      <div className="toolbar">
        <input
          className="toolbar__search"
          placeholder="Pretraži troškove..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="toolbar__select"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <button className="btn btn--primary btn--sm" onClick={() => setAdding(true)}>
          + Dodaj trošak
        </button>
        <button
          className={`btn btn--ghost btn--sm ${showCharts ? 'btn--primary' : ''}`}
          style={showCharts ? { background: '#e0e7ff', color: '#6366f1', borderColor: '#c7d2fe' } : {}}
          onClick={() => setShowCharts((v) => !v)}
        >
          📊 Analiza
        </button>
      </div>

      {showCharts && (
        <div ref={chartsRef}>
          <Charts expenses={allExpenses} year={year} month={month} />
        </div>
      )}

      <div className="expense-list">
        {filtered.length === 0 ? (
          <div className="expense-list__empty">
            <div className="expense-list__empty-icon">
              {allExpenses.length === 0 ? '💸' : '🔍'}
            </div>
            {allExpenses.length === 0
              ? 'Nema troškova za ovaj mesec. Dodaj prvi!'
              : 'Nema rezultata za pretragu.'}
          </div>
        ) : (
          filtered.map((e) => <ExpenseItem key={e.id} expense={e} />)
        )}
      </div>

      {adding && (
        <ExpenseModal
          defaultDate={
            isCurrent
              ? todayISO()
              : `${year}-${String(month + 1).padStart(2, '0')}-01`
          }
          onClose={() => setAdding(false)}
        />
      )}
    </div>
  );
}
