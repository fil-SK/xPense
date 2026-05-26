import { useState, useMemo } from 'react';
import { useApp } from '../App.jsx';
import {
  getExpensesForMonth, getTotalAmount,
  formatAmount, getMonthName,
} from '../utils/helpers.js';

const ALL_MONTHS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

export default function PreviousSpendings() {
  const { data, navigateTo } = useApp();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const [selectedYear, setSelectedYear] = useState(currentYear);

  const monthsData = useMemo(() => {
    return ALL_MONTHS.map((m) => {
      const exps = getExpensesForMonth(data.expenses, selectedYear, m);
      const total = getTotalAmount(exps);
      const isFuture = selectedYear === currentYear && m > currentMonth;
      const isCurrent = selectedYear === currentYear && m === currentMonth;
      return { month: m, total, count: exps.length, isFuture, isCurrent };
    });
  }, [data.expenses, selectedYear, currentYear, currentMonth]);

  const maxTotal = Math.max(...monthsData.map((m) => m.total), 1);

  function openMonth(month) {
    if (selectedYear === currentYear && month === currentMonth) {
      navigateTo('current');
    } else {
      navigateTo('month', selectedYear, month);
    }
  }

  return (
    <div>
      <div className="prev-header">
        <button className="month-header__back" onClick={() => navigateTo('home')} title="Nazad">
          ←
        </button>
        <h1 className="prev-header__title">Prethodne potrošnje</h1>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button className="btn btn--ghost btn--sm" onClick={() => setSelectedYear((y) => y - 1)}>
          ‹ Prethodna
        </button>
        <span style={{ fontWeight: 800, fontSize: 20, minWidth: 52, textAlign: 'center' }}>
          {selectedYear}
        </span>
        <button
          className="btn btn--ghost btn--sm"
          onClick={() => setSelectedYear((y) => y + 1)}
          disabled={selectedYear >= currentYear}
          style={selectedYear >= currentYear ? { opacity: 0.4, cursor: 'default' } : {}}
        >
          Naredna ›
        </button>
      </div>

      <div className="months-grid">
        {monthsData.map(({ month, total, count, isFuture, isCurrent }) => (
          <div
            key={month}
            className="month-card"
            onClick={() => !isFuture && openMonth(month)}
            style={{
              opacity: isFuture ? 0.35 : 1,
              cursor: isFuture ? 'default' : 'pointer',
              borderStyle: count === 0 && !isFuture ? 'dashed' : 'solid',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="month-card__name">{getMonthName(month)}</div>
              {isCurrent && <span className="badge badge--primary">Tekući</span>}
            </div>

            {count > 0 ? (
              <>
                <div className="month-card__total">{formatAmount(total)}</div>
                <div className="month-card__count">{count} transakcija</div>
                <div className="month-card__bar">
                  <div
                    className="month-card__bar-fill"
                    style={{ width: `${(total / maxTotal) * 100}%` }}
                  />
                </div>
              </>
            ) : !isFuture ? (
              <div style={{ marginTop: 10, fontSize: 13, color: '#94a3b8' }}>
                + Dodaj troškove
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
