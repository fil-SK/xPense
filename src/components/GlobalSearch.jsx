import { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from '../App.jsx';
import { formatAmount, formatDate, categoryColor, MONTHS_SR } from '../utils/helpers.js';

export default function GlobalSearch() {
  const { data, navigateTo } = useApp();
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const results = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    return [...data.expenses]
      .filter((e) =>
        e.title.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q) ||
        (e.note && e.note.toLowerCase().includes(q))
      )
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [query, data.expenses]);

  function goToMonth(e) {
    const d = new Date(e.date + 'T00:00:00');
    navigateTo('month', d.getFullYear(), d.getMonth());
  }

  const hasQuery = query.trim().length > 0;

  return (
    <div className="gsearch view">
      <div className="gsearch__header">
        <button className="month-header__back" onClick={() => navigateTo('home')} title="Nazad">←</button>
        <h1 className="gsearch__title">Pretraga troškova</h1>
      </div>

      <input
        ref={inputRef}
        className="gsearch__input"
        placeholder="Pretražuj po nazivu, kategoriji ili napomeni..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {hasQuery && (
        <div className="gsearch__meta">
          {results.length === 0
            ? 'Nema rezultata.'
            : `${results.length} rezultat${results.length === 1 ? '' : 'a'}`}
        </div>
      )}

      {results.length > 0 && (
        <div className="expense-list">
          {results.map((e) => {
            const d = new Date(e.date + 'T00:00:00');
            const color = categoryColor(e.category, data.categories);
            const monthLabel = `${MONTHS_SR[d.getMonth()]} ${d.getFullYear()}`;
            return (
              // A real <button>: the row carries no nested controls here, so it
              // needs no hand-rolled key handling. The label spells out where
              // the click goes — read out, the row contents alone are just a
              // run of date, category and amount fragments.
              <button
                key={e.id}
                type="button"
                className="expense-item"
                aria-label={`${e.title} — otvori ${monthLabel}`}
                onClick={() => goToMonth(e)}
              >
                <span className="expense-item__icon" style={{ background: color + '22' }}>
                  <span className="expense-item__cat-dot" style={{ background: color }} />
                </span>
                <div className="expense-item__body">
                  <div className="expense-item__title">{e.title}</div>
                  <div className="expense-item__meta">
                    <span>{formatDate(e.date)}</span>
                    <span className="expense-item__cat-badge" style={{ background: color + '22', color }}>
                      {e.category}
                    </span>
                    <span className="gsearch__month-tag">{monthLabel}</span>
                    {e.recurringId && <span title="Ponavljajući trošak">🔄</span>}
                    {e.note && <span title={e.note}>📝</span>}
                  </div>
                </div>
                <div className="expense-item__amount">{formatAmount(e.amount)}</div>
              </button>
            );
          })}
        </div>
      )}

      {!hasQuery && (
        <div className="expense-list__empty">
          <div className="expense-list__empty-icon">🔍</div>
          Unesite pojam za pretragu troškova iz svih meseci.
        </div>
      )}
    </div>
  );
}
