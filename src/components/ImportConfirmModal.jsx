import { useEffect } from 'react';

function countExpenses(data) {
  return data.expenses?.length ?? 0;
}
function countCategories(data) {
  return data.categories?.length ?? 0;
}
function countBudgetYears(data) {
  return Object.keys(data.budget ?? {}).length;
}
function countRecurrings(data) {
  return data.recurrings?.length ?? 0;
}
function countGoals(data) {
  return data.savingsGoals?.length ?? 0;
}

const ROWS = [
  ['Troškovi', countExpenses],
  ['Kategorije', countCategories],
  ['Godine budžeta', countBudgetYears],
  ['Ponavljajući', countRecurrings],
  ['Ciljevi štednje', countGoals],
];

export default function ImportConfirmModal({ current, incoming, skipped, onCancel, onConfirm }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel]);

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Potvrda uvoza">
        <div className="modal__header">
          <span className="modal__title">Uvezi podatke</span>
          <button className="modal__close" onClick={onCancel}>✕</button>
        </div>

        <div className="modal__body">
          <p className="import-warn">
            Uvoz <b>zamenjuje sve trenutne podatke</b>. Proveri brojeve pre nego što nastaviš.
          </p>

          <table className="import-table">
            <thead>
              <tr>
                <th />
                <th>Sada</th>
                <th>Posle uvoza</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map(([label, count]) => {
                const before = count(current);
                const after = count(incoming);
                return (
                  <tr key={label}>
                    <td className="import-table__label">{label}</td>
                    <td className="import-table__num">{before}</td>
                    <td className={`import-table__num ${after < before ? 'import-table__num--loss' : ''}`}>
                      {after}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {skipped > 0 && (
            <p className="import-skipped">
              ⚠ {skipped} {skipped === 1 ? 'stavka je preskočena' : 'stavki je preskočeno'} —
              nedostaje ispravan datum ili iznos.
            </p>
          )}
        </div>

        <div className="modal__footer">
          <button className="btn btn--ghost" onClick={onCancel}>Otkaži</button>
          <button className="btn btn--danger" onClick={onConfirm}>Zameni podatke</button>
        </div>
      </div>
    </div>
  );
}
