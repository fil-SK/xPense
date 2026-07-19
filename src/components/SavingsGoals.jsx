import { useState } from 'react';
import { useApp } from '../App.jsx';
import { formatAmount } from '../utils/helpers.js';

function getBarClass(pct) {
  if (pct >= 100) return 'goal-bar__fill--done';
  if (pct >= 60) return 'goal-bar__fill--near';
  if (pct > 0) return 'goal-bar__fill--partial';
  return 'goal-bar__fill--empty';
}

export default function SavingsGoals() {
  const { data, addSavingsGoal, deleteSavingsGoal } = useApp();
  const goals = data.savingsGoals ?? [];

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  const budgetYears = Object.keys(data.budget ?? {}).map(Number).sort((a, b) => b - a);
  const [goalYear, setGoalYear] = useState(() => budgetYears[0] ?? new Date().getFullYear());
  const [fundId, setFundId] = useState('');

  const availableFunds = data.budget?.[goalYear]?.funds ?? [];

  function getProgress(goal) {
    if (!goal.fundId || !goal.year) return { saved: 0, pct: 0 };
    const fund = data.budget?.[goal.year]?.funds?.find((f) => f.id === goal.fundId);
    if (!fund) return { saved: 0, pct: 0 };
    const saved = fund.amounts.reduce((s, v) => s + (v ?? 0), 0);
    const pct = goal.target > 0 ? Math.min(100, (saved / goal.target) * 100) : 0;
    return { saved, pct };
  }

  function handleSubmit() {
    const trimmedName = name.trim();
    const num = Math.round(Number(String(target).replace(/\./g, '').replace(',', '.')));
    if (!trimmedName || !num || num <= 0) return;
    addSavingsGoal({
      name: trimmedName,
      target: num,
      year: fundId ? goalYear : null,
      fundId: fundId || null,
    });
    setName('');
    setTarget('');
    setFundId('');
    setShowForm(false);
  }

  function handleDelete(id) {
    if (confirmDelete === id) {
      deleteSavingsGoal(id);
      setConfirmDelete(null);
    } else {
      setConfirmDelete(id);
      setTimeout(() => setConfirmDelete(null), 2500);
    }
  }

  return (
    <div className="home__goals">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div className="home__section-title">Ciljevi štednje</div>
        <button className="btn btn--ghost btn--sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? '✕ Otkaži' : '+ Dodaj cilj'}
        </button>
      </div>

      {showForm && (
        <div className="goal-form">
          <div className="goal-form__row">
            <input
              className="goal-form__input"
              placeholder="Naziv cilja (npr. Godišnji odmor)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
            <input
              className="goal-form__input"
              type="number"
              placeholder="Ciljna suma (RSD)"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              min="1"
            />
          </div>
          {budgetYears.length > 0 && (
            <div className="goal-form__row">
              <select
                className="goal-form__input"
                value={goalYear}
                onChange={(e) => { setGoalYear(Number(e.target.value)); setFundId(''); }}
              >
                {budgetYears.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <select
                className="goal-form__input"
                value={fundId}
                onChange={(e) => setFundId(e.target.value)}
              >
                <option value="">— bez fonda —</option>
                {availableFunds.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
          )}
          <div className="goal-form__actions">
            <button className="btn btn--primary btn--sm" onClick={handleSubmit}>
              Dodaj cilj
            </button>
          </div>
        </div>
      )}

      {goals.length > 0 ? (
        <div className="goal-list">
          {goals.map((goal) => {
            const { saved, pct } = getProgress(goal);
            const linkedFund = goal.fundId && goal.year
              ? data.budget?.[goal.year]?.funds?.find((f) => f.id === goal.fundId)
              : null;
            return (
              <div key={goal.id} className="goal-item">
                <div className="goal-item__head">
                  <div>
                    <div className="goal-item__name">{goal.name}</div>
                    {linkedFund && (
                      <div className="goal-item__fund">{goal.year} · {linkedFund.name}</div>
                    )}
                  </div>
                  <button
                    className={`btn btn--icon btn--ghost btn--sm${confirmDelete === goal.id ? ' btn--danger' : ''}`}
                    onClick={() => handleDelete(goal.id)}
                    title={confirmDelete === goal.id ? 'Potvrdi brisanje' : 'Obriši cilj'}
                  >
                    {confirmDelete === goal.id ? '⚠' : '🗑️'}
                  </button>
                </div>
                <div className="goal-bar">
                  <div className={`goal-bar__fill ${getBarClass(pct)}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="goal-item__amounts">
                  {formatAmount(saved)} / {formatAmount(goal.target)} ({Math.round(pct)}%)
                </div>
              </div>
            );
          })}
        </div>
      ) : !showForm ? (
        <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
          Nema postavljenih ciljeva. Dodaj cilj štednje sa iznosom koji želiš dostići.
        </div>
      ) : null}
    </div>
  );
}
