import { useState, useId } from 'react';
import { useApp } from '../App.jsx';
import { formatAmount } from '../utils/helpers.js';
import { goalProgress, isSavingsFund, NO_PROGRESS } from '../utils/dataTransforms.js';

function getBarClass(pct) {
  if (pct >= 100) return 'goal-bar__fill--done';
  if (pct >= 60) return 'goal-bar__fill--near';
  if (pct > 0) return 'goal-bar__fill--partial';
  return 'goal-bar__fill--empty';
}

export default function SavingsGoals() {
  const { data, addSavingsGoal, updateSavingsGoal, deleteSavingsGoal } = useApp();
  const goals = data.savingsGoals ?? [];

  const uid = useId();
  const fieldId = (name) => `${uid}-${name}`;

  // null = form closed. A string id means the form is editing that goal.
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');

  const budgetYears = Object.keys(data.budget ?? {}).map(Number).sort((a, b) => b - a);
  const defaultYear = budgetYears[0] ?? new Date().getFullYear();
  const [goalYear, setGoalYear] = useState(defaultYear);
  const [fundId, setFundId] = useState('');

  const availableFunds = data.budget?.[goalYear]?.funds ?? [];

  // Progress is what the user confirmed setting aside, not what the year plans
  // to set aside — see goalProgress.
  function getProgress(goal) {
    if (!goal.fundId || !goal.year) return NO_PROGRESS;
    const fund = data.budget?.[goal.year]?.funds?.find((f) => f.id === goal.fundId);
    if (!fund) return NO_PROGRESS;
    return goalProgress(fund, goal.target, goal.year);
  }

  function openAdd() {
    setEditingId(null);
    setName('');
    setTarget('');
    setGoalYear(defaultYear);
    setFundId('');
    setShowForm(true);
  }

  // Edit reuses the add form rather than an inline one, so there is a single
  // place where a goal's fields are laid out and validated.
  function openEdit(goal) {
    setEditingId(goal.id);
    setName(goal.name);
    setTarget(String(goal.target));
    setGoalYear(goal.year ?? defaultYear);
    setFundId(goal.fundId ?? '');
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setName('');
    setTarget('');
    setFundId('');
  }

  function handleSubmit(e) {
    e.preventDefault();
    const trimmedName = name.trim();
    const num = Math.round(Number(String(target).replace(/\./g, '').replace(',', '.')));
    if (!trimmedName || !num || num <= 0) return;
    const payload = {
      name: trimmedName,
      target: num,
      year: fundId ? goalYear : null,
      fundId: fundId || null,
    };
    if (editingId) updateSavingsGoal(editingId, payload);
    else addSavingsGoal(payload);
    closeForm();
  }

  return (
    <div className="home__goals">
      <div className="home__goals-head">
        <div className="home__section-title">Ciljevi štednje</div>
        <button
          className="btn btn--ghost btn--sm"
          aria-expanded={showForm}
          onClick={() => (showForm ? closeForm() : openAdd())}
        >
          {showForm ? '✕ Otkaži' : '+ Dodaj cilj'}
        </button>
      </div>

      {showForm && (
        <form className="goal-form" onSubmit={handleSubmit}>
          <div className="goal-form__title">{editingId ? 'Izmeni cilj' : 'Novi cilj'}</div>
          <div className="goal-form__row">
            <div className="goal-form__field">
              <label className="goal-form__label" htmlFor={fieldId('name')}>Naziv cilja</label>
              <input
                id={fieldId('name')}
                className="goal-form__input"
                placeholder="Naziv cilja (npr. Godišnji odmor)"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="goal-form__field">
              <label className="goal-form__label" htmlFor={fieldId('target')}>Ciljna suma (RSD)</label>
              <input
                id={fieldId('target')}
                className="goal-form__input"
                type="number"
                placeholder="Ciljna suma (RSD)"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                min="1"
              />
            </div>
          </div>
          {budgetYears.length > 0 && (
            <div className="goal-form__row">
              <div className="goal-form__field">
                <label className="goal-form__label" htmlFor={fieldId('year')}>Godina</label>
                <select
                  id={fieldId('year')}
                  className="goal-form__input"
                  value={goalYear}
                  onChange={(e) => { setGoalYear(Number(e.target.value)); setFundId(''); }}
                >
                  {budgetYears.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div className="goal-form__field">
                <label className="goal-form__label" htmlFor={fieldId('fund')}>Fond</label>
                <select
                  id={fieldId('fund')}
                  className="goal-form__input"
                  value={fundId}
                  onChange={(e) => setFundId(e.target.value)}
                >
                  <option value="">— bez fonda —</option>
                  {availableFunds.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
            </div>
          )}
          <div className="goal-form__actions">
            <button type="submit" className="btn btn--primary btn--sm">
              {editingId ? 'Sačuvaj izmene' : 'Dodaj cilj'}
            </button>
          </div>
        </form>
      )}

      {goals.length > 0 ? (
        <div className="goal-list">
          {goals.map((goal) => {
            const { saved, planned, expected, pct, plannedPct, expectedPct, confirmedMonths } =
              getProgress(goal);
            const linkedFund = goal.fundId && goal.year
              ? data.budget?.[goal.year]?.funds?.find((f) => f.id === goal.fundId)
              : null;
            // What the plan said should be set aside by now, as opposed to what
            // was. This is the number the bar itself used to show.
            const showExpected = !!linkedFund && expected !== saved;
            // The rest of the year's plan, shown as a ghost segment behind the
            // bar so the whole plan stays visible rather than being dropped.
            const showPlan = !!linkedFund && planned > expected;
            const showGhost = !!linkedFund && plannedPct > pct;
            return (
              <div key={goal.id} className="goal-item">
                <div className="goal-item__head">
                  <div>
                    <div className="goal-item__name">{goal.name}</div>
                    {linkedFund && (
                      <div className="goal-item__fund">{goal.year} · {linkedFund.name}</div>
                    )}
                  </div>
                  <div className="goal-item__actions">
                    <button
                      className="btn btn--icon btn--ghost btn--sm"
                      onClick={() => openEdit(goal)}
                      title="Izmeni cilj"
                      aria-label={`Izmeni cilj: ${goal.name}`}
                    >
                      ✏️
                    </button>
                    {/* One click — the undo on the toast replaces the confirm. */}
                    <button
                      className="btn btn--icon btn--ghost btn--sm"
                      onClick={() => deleteSavingsGoal(goal.id)}
                      title="Obriši cilj"
                      aria-label={`Obriši cilj: ${goal.name}`}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
                <div
                  className="goal-bar"
                  role="progressbar"
                  aria-label={`Napredak: ${goal.name}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(pct)}
                  aria-valuetext={`Ušteđeno ${formatAmount(saved)} od ${formatAmount(goal.target)} (${Math.round(pct)}%)`}
                >
                  {showGhost && (
                    <div className="goal-bar__plan" style={{ width: `${plannedPct}%` }} />
                  )}
                  <div className={`goal-bar__fill ${getBarClass(pct)}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="goal-item__amounts">
                  Ušteđeno: {formatAmount(saved)} / {formatAmount(goal.target)} ({Math.round(pct)}%)
                </div>
                {showExpected && (
                  <div className="goal-item__plan">
                    Očekivano do sada: {formatAmount(expected)} ({Math.round(expectedPct)}%)
                  </div>
                )}
                {showPlan && (
                  <div className="goal-item__plan">
                    Po planu do kraja {goal.year}: {formatAmount(planned)} ({Math.round(plannedPct)}%)
                  </div>
                )}
                {/* A 0% bar on a funded goal looks like a bug unless it says
                    what is missing — and the missing step differs. */}
                {linkedFund && confirmedMonths === 0 && (
                  <div className="goal-item__plan">
                    {isSavingsFund(linkedFund)
                      ? 'Nema potvrđenih odvajanja — potvrdi ih u prikazu meseca, sekcija „Odvajanja".'
                      : 'Fond nije označen kao fond štednje — uključi 💰 u Budžetu da bi se odvajanja pratila.'}
                  </div>
                )}
                {!linkedFund && (
                  <div className="goal-item__plan">
                    Nije povezan sa fondom — napredak se ne prati.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : !showForm ? (
        <div className="goal-empty">
          Nema postavljenih ciljeva. Dodaj cilj štednje sa iznosom koji želiš dostići.
        </div>
      ) : null}
    </div>
  );
}
