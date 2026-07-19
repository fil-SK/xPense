import { useApp } from '../App.jsx';
import { getExpensesForMonth } from '../utils/helpers.js';

const THRESHOLD_WARN = 0.9;

function statusKey(ratio) {
  if (ratio === null) return 'unset';
  if (ratio > 1) return 'over';
  if (ratio >= THRESHOLD_WARN) return 'warn';
  return 'ok';
}

function fmt(n) {
  return n.toLocaleString('sr-RS');
}

export default function BudgetPanel({ year, month }) {
  const { data } = useApp();

  const funds = data.budget?.[year]?.funds ?? [];
  const yearMaps = data.trackingMaps?.[year] ?? {};

  const trackedFunds = funds.filter(
    (f) => (yearMaps[f.id] ?? []).length > 0
  );

  if (trackedFunds.length === 0) return null;

  const monthExpenses = getExpensesForMonth(data.expenses, year, month);

  return (
    <div className="bp">
      <div className="bp__label">Praćenje budžeta</div>
      <div className="bp__rows">
        {trackedFunds.map((fund) => {
          const allocated = fund.amounts[month] ?? null;
          const mappedCats = yearMaps[fund.id] ?? [];
          const spent = monthExpenses
            .filter((e) => mappedCats.includes(e.category))
            .reduce((s, e) => s + e.amount, 0);

          const ratio = allocated !== null ? spent / allocated : null;
          const remaining = allocated !== null ? allocated - spent : null;
          const isOver = remaining !== null && remaining < 0;
          const key = statusKey(ratio);

          return (
            <div key={fund.id} className={`bp-row bp-row--${key}`}>
              <div className="bp-row__dot" />
              <div className="bp-row__name">{fund.name}</div>
              {allocated === null ? (
                <div className="bp-row__unset">nije postavljeno</div>
              ) : (
                <>
                  <div className="bp-row__bar">
                    <div
                      className="bp-row__bar-fill"
                      style={{ width: `${Math.min(ratio * 100, 100)}%` }}
                    />
                  </div>
                  <div className="bp-row__amounts">
                    {fmt(spent)} / {fmt(allocated)} RSD
                  </div>
                  <div className="bp-row__remaining">
                    {isOver
                      ? `−${fmt(Math.abs(remaining))}`
                      : `+${fmt(remaining)}`}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
