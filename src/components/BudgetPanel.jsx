import { useApp } from '../App.jsx';
import { getExpensesForMonth } from '../utils/helpers.js';

const THRESHOLD_WARN = 0.9;

function statusClass(ratio) {
  if (ratio === null) return 'bp-card--unset';
  if (ratio > 1) return 'bp-card--over';
  if (ratio >= THRESHOLD_WARN) return 'bp-card--warn';
  return 'bp-card--ok';
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
      <div className="bp__cards">
        {trackedFunds.map((fund) => {
          const allocated = fund.amounts[month] ?? null;
          const mappedCats = yearMaps[fund.id] ?? [];
          const spent = monthExpenses
            .filter((e) => mappedCats.includes(e.category))
            .reduce((s, e) => s + e.amount, 0);

          const ratio = allocated !== null ? spent / allocated : null;
          const remaining = allocated !== null ? allocated - spent : null;
          const isOver = remaining !== null && remaining < 0;

          return (
            <div key={fund.id} className={`bp-card ${statusClass(ratio)}`}>
              <div className="bp-card__name">{fund.name}</div>

              {allocated === null ? (
                <div className="bp-card__unset">nije postavljeno</div>
              ) : (
                <>
                  <div className="bp-card__amounts">
                    <span className="bp-card__spent">{fmt(spent)}</span>
                    <span className="bp-card__sep"> / </span>
                    <span className="bp-card__alloc">{fmt(allocated)} RSD</span>
                  </div>

                  <div className="bp-card__bar-wrap">
                    <div
                      className="bp-card__bar-fill"
                      style={{ width: `${Math.min(ratio * 100, 100)}%` }}
                    />
                  </div>

                  <div className="bp-card__remaining">
                    {isOver
                      ? `−${fmt(Math.abs(remaining))} RSD`
                      : `+${fmt(remaining)} RSD`}
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
