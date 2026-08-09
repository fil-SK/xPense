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
      const note = data.monthlyNotes?.[selectedYear]?.[m] ?? '';

      const priorDate = new Date(selectedYear, m - 1, 1);
      const priorExps = getExpensesForMonth(data.expenses, priorDate.getFullYear(), priorDate.getMonth());
      const priorTotal = getTotalAmount(priorExps);
      const hasDelta = exps.length > 0 && priorExps.length > 0 && priorTotal > 0;
      const deltaPct = hasDelta ? Math.round(((total - priorTotal) / priorTotal) * 100) : null;

      return { month: m, total, count: exps.length, isFuture, isCurrent, note, hasDelta, deltaPct };
    });
  }, [data.expenses, data.monthlyNotes, selectedYear, currentYear, currentMonth]);

  const maxTotal = Math.max(...monthsData.map((m) => m.total), 1);

  const recorded = monthsData.filter((m) => m.count > 0);
  const yearTotal = recorded.reduce((s, m) => s + m.total, 0);
  const avgPerMonth = recorded.length > 0 ? yearTotal / recorded.length : 0;
  const priciest = recorded.length > 0
    ? recorded.reduce((max, m) => (m.total > max.total ? m : max), recorded[0])
    : null;

  function openMonth(month) {
    if (selectedYear === currentYear && month === currentMonth) {
      navigateTo('current');
    } else {
      navigateTo('month', selectedYear, month);
    }
  }

  return (
    <div className="previous view">
      <div className="prev-header">
        <button className="month-header__back" onClick={() => navigateTo('home')} title="Nazad">
          ←
        </button>
        <h1 className="prev-header__title">Prethodni meseci</h1>
      </div>
      <div className="home__sub" style={{ marginBottom: 28 }}>
        Pregled potrošnje kroz vreme — klikni na mesec za detalje.
      </div>

      {recorded.length > 0 && (
        <div className="overview-card">
          <div className="overview-card__main">
            <div className="overview-card__label">Ukupno u {selectedYear} (do sada)</div>
            <div className="overview-card__value-row">
              <div className="overview-card__value">{yearTotal.toLocaleString('sr-RS')}</div>
              <div className="overview-card__unit">RSD</div>
            </div>
            <div className="overview-card__hint">{recorded.length} mesec{recorded.length === 1 ? '' : 'i'} zabeleženo</div>
          </div>
          <div className="overview-card__side">
            <div className="overview-card__row">
              <span className="overview-card__row-label">Prosek po mesecu</span>
              <span className="overview-card__row-value">{formatAmount(avgPerMonth)}</span>
            </div>
            <div className="overview-card__row">
              <span className="overview-card__row-label">Najskuplji mesec</span>
              <span className="overview-card__row-value" style={{ fontSize: 16 }}>
                {priciest ? `${getMonthName(priciest.month)} · ${formatAmount(priciest.total)}` : '—'}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="section-head">
        <div className="section-head__title">Po mesecima</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="month-header__back" onClick={() => setSelectedYear((y) => y - 1)} title="Prethodna godina">‹</button>
          <span style={{ fontWeight: 800, fontSize: 17, minWidth: 48, textAlign: 'center' }}>
            {selectedYear}
          </span>
          <button
            className="month-header__back"
            onClick={() => setSelectedYear((y) => y + 1)}
            disabled={selectedYear >= currentYear}
            title="Naredna godina"
            style={selectedYear >= currentYear ? { opacity: 0.4, cursor: 'default' } : {}}
          >
            ›
          </button>
        </div>
      </div>

      <div className="months-grid">
        {monthsData.map(({ month, total, count, isFuture, isCurrent, note, hasDelta, deltaPct }) => (
          // A real <button>, disabled for future months — that was already the
          // dead state, and disabled keeps it out of the tab order without a
          // second code path. The label is spelled out because the card's own
          // text ("Januar", "3 transakcija", "12.400", "RSD") reads as loose
          // fragments.
          <button
            key={month}
            type="button"
            className="month-card"
            disabled={isFuture}
            aria-label={
              `${getMonthName(month)} ${selectedYear} — ` +
              (count === 0 ? 'nema troškova' : `${count} transakcija, ${formatAmount(total)}`)
            }
            onClick={() => openMonth(month)}
            style={{
              opacity: isFuture ? 0.35 : 1,
              cursor: isFuture ? 'default' : 'pointer',
              borderStyle: count === 0 && !isFuture ? 'dashed' : 'solid',
            }}
          >
            <div className="month-card__head">
              <div>
                <div className="month-card__name">{getMonthName(month)}</div>
                <div className="month-card__count">{count} transakcija</div>
              </div>
              {isCurrent && <span className="badge badge--primary">Tekući</span>}
              {!isCurrent && hasDelta && (
                <span className={`month-card__delta ${deltaPct > 0 ? 'month-card__delta--up' : 'month-card__delta--down'}`}>
                  {deltaPct > 0 ? '↑' : '↓'} {Math.abs(deltaPct)}%
                </span>
              )}
            </div>

            {count > 0 ? (
              <div className="month-card__total-row">
                <div>
                  <span className="month-card__total">{total.toLocaleString('sr-RS')}</span>
                  <span className="month-card__unit">RSD</span>
                </div>
              </div>
            ) : !isFuture ? (
              <div style={{ fontSize: 13, color: 'var(--text3)' }}>
                + Dodaj troškove
              </div>
            ) : null}
            {count > 0 && (
              <div className="month-card__bar">
                <div
                  className="month-card__bar-fill"
                  style={{ width: `${(total / maxTotal) * 100}%` }}
                />
              </div>
            )}
            {note && (
              <div className="month-card__note">
                {note.length > 55 ? note.slice(0, 55) + '…' : note}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
