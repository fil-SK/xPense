import { useState, useId } from 'react';
import { useApp } from '../App.jsx';
import { parseAmountInput } from '../utils/helpers.js';
import { isSavingsFund } from '../utils/dataTransforms.js';

function fmt(n) {
  return n.toLocaleString('sr-RS');
}

// One savings fund for one month. The plan says what should be set aside; this
// is where the user says what actually was — until they do, nothing in the app
// claims the money moved.
function SavingsRow({ fund, year, month, onConfirm, onClear }) {
  const uid = useId();
  const inputId = `${uid}-amount`;

  const planned = fund.amounts[month] ?? null;
  const confirmed = fund.contributions?.[month] ?? null;
  const isConfirmed = confirmed != null;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(planned != null ? String(planned) : '');

  const showForm = !isConfirmed || editing;
  const parsed = parseAmountInput(draft);
  // `null` is an empty field and `undefined` is garbage; both block the save.
  // A parsed `0` must not — confirming that nothing was set aside is a real
  // answer, and the one the plan can't express on its own.
  const canSave = typeof parsed === 'number';

  function startEdit() {
    setDraft(confirmed != null ? String(confirmed) : '');
    setEditing(true);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!canSave) return;
    onConfirm(year, fund.id, month, parsed);
    setEditing(false);
  }

  const short = isConfirmed && planned != null && confirmed < planned;

  return (
    <div className={`sp-row ${isConfirmed ? 'sp-row--confirmed' : 'sp-row--pending'}`}>
      <div className="sp-row__dot" />
      <div className="sp-row__name">{fund.name}</div>
      <div className="sp-row__plan">
        {planned != null ? `Plan: ${fmt(planned)} RSD` : 'Nije planirano'}
      </div>

      {showForm ? (
        <form className="sp-row__form" onSubmit={handleSubmit}>
          <label className="sp-row__label" htmlFor={inputId}>
            Odvojeno za {fund.name}
          </label>
          <input
            id={inputId}
            className="sp-row__input"
            inputMode="decimal"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button
            type="submit"
            className="btn btn--primary btn--sm"
            disabled={!canSave}
            aria-label={`Potvrdi odvajanje: ${fund.name}`}
          >
            Potvrdi
          </button>
          {editing && (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => setEditing(false)}
              aria-label={`Otkaži izmenu odvajanja: ${fund.name}`}
            >
              Otkaži
            </button>
          )}
        </form>
      ) : (
        <div className="sp-row__done">
          <span className={`sp-row__amount ${short ? 'sp-row__amount--short' : ''}`}>
            ✓ Odvojeno: {fmt(confirmed)} RSD
          </span>
          {planned != null && confirmed !== planned && (
            <span className="sp-row__delta">
              {short
                ? `−${fmt(planned - confirmed)} od plana`
                : `+${fmt(confirmed - planned)} preko plana`}
            </span>
          )}
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={startEdit}
            aria-label={`Izmeni odvajanje: ${fund.name}`}
          >
            Izmeni
          </button>
          {/* One click — the undo on the toast replaces the confirm. */}
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => onClear(year, fund.id, month)}
            aria-label={`Ukloni potvrdu odvajanja: ${fund.name}`}
          >
            Ukloni
          </button>
        </div>
      )}
    </div>
  );
}

export default function SavingsPanel({ year, month }) {
  const { data, confirmFundContribution, clearFundContribution } = useApp();

  const savingsFunds = (data.budget?.[year]?.funds ?? []).filter(isSavingsFund);
  if (savingsFunds.length === 0) return null;

  const setAside = savingsFunds.reduce(
    (s, f) => s + (f.contributions?.[month] ?? 0),
    0
  );
  const plannedTotal = savingsFunds.reduce((s, f) => s + (f.amounts[month] ?? 0), 0);

  return (
    <div className="sp">
      <div className="sp__label">Odvajanja</div>
      <div className="sp__rows">
        {savingsFunds.map((fund) => (
          // The key carries year and month on purpose: MonthView is not
          // unmounted when the user moves between months, so a row keyed only
          // by fund id would carry its half-typed draft across with it.
          <SavingsRow
            key={`${fund.id}-${year}-${month}`}
            fund={fund}
            year={year}
            month={month}
            onConfirm={confirmFundContribution}
            onClear={clearFundContribution}
          />
        ))}
      </div>
      <div className="sp__summary">
        Odvojeno: {fmt(setAside)} od planiranih {fmt(plannedTotal)} RSD
      </div>
    </div>
  );
}
