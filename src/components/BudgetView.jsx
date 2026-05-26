import { useState, useRef, useEffect } from 'react';
import { useApp } from '../App.jsx';
import { exportBudget, importBudget } from '../utils/storage.js';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Avg', 'Sep', 'Okt', 'Nov', 'Dec'];

function fmt(val) {
  if (val == null) return '—';
  return val.toLocaleString('sr-RS');
}

function rowTotal(arr) {
  const hasAny = arr.some((v) => v != null);
  if (!hasAny) return null;
  return arr.reduce((s, v) => s + (v ?? 0), 0);
}

function BudgetCell({ value, onSave, dimmed }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  function startEdit() {
    setDraft(value != null ? String(value) : '');
    setEditing(true);
  }

  function commit() {
    const raw = draft.trim().replace(/\./g, '').replace(',', '.');
    if (raw === '') { onSave(null); setEditing(false); return; }
    const num = Number(raw);
    if (isNaN(num) || num < 0) { setEditing(false); return; }
    onSave(Math.round(num));
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="bgc-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setEditing(false);
        }}
      />
    );
  }

  return (
    <span
      className={`bgc ${value != null ? 'bgc--filled' : 'bgc--empty'} ${dimmed ? 'bgc--dimmed' : ''}`}
      onClick={startEdit}
    >
      {fmt(value)}
    </span>
  );
}

export default function BudgetView() {
  const { data, updateBudgetIncome, updateBudgetFund, addBudgetFund, removeBudgetFund, renameBudgetFund, importBudgetData, showToast } =
    useApp();
  const year = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  const yb = data.budget?.[year] ?? {
    income: { plata: Array(12).fill(null), bonus: Array(12).fill(null) },
    funds: [],
  };

  const [newFundName, setNewFundName] = useState('');
  const [editingFundId, setEditingFundId] = useState(null);
  const [editingFundName, setEditingFundName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const addInputRef = useRef(null);

  const inPerMonth = Array.from({ length: 12 }, (_, i) =>
    (yb.income.plata[i] ?? 0) + (yb.income.bonus[i] ?? 0)
  );
  const outPerMonth = Array.from({ length: 12 }, (_, i) =>
    yb.funds.reduce((s, f) => s + (f.amounts[i] ?? 0), 0)
  );
  const balancePerMonth = inPerMonth.map((inc, i) => inc - outPerMonth[i]);
  const totalIn = inPerMonth.reduce((s, v) => s + v, 0);
  const totalOut = outPerMonth.reduce((s, v) => s + v, 0);
  const totalBalance = totalIn - totalOut;

  const hasAnyIn = yb.income.plata.some((v) => v != null) || yb.income.bonus.some((v) => v != null);
  const hasAnyOut = yb.funds.some((f) => f.amounts.some((v) => v != null));

  function handleAddFund() {
    const name = newFundName.trim();
    if (!name) return;
    addBudgetFund(year, name);
    setNewFundName('');
    addInputRef.current?.focus();
  }

  function handleDeleteFund(fundId) {
    if (confirmDelete === fundId) {
      removeBudgetFund(year, fundId);
      setConfirmDelete(null);
    } else {
      setConfirmDelete(fundId);
      setTimeout(() => setConfirmDelete(null), 2500);
    }
  }

  const cols = Array.from({ length: 12 }, (_, i) => i);

  return (
    <div className="budget">
      <div className="budget__head">
        <div className="budget__title">Budžet {year}</div>
        <div className="budget__hint">Kliknite na ćeliju da unesete vrednost · Dvoklikom na naziv fonda ga preimenujete</div>
        <div className="budget__tools">
          <button className="btn btn--ghost btn--sm" onClick={() => exportBudget(data.budget, year)}>
            ⬇ Izvezi budžet
          </button>
          <label className="btn btn--ghost btn--sm" style={{ cursor: 'pointer' }}>
            ⬆ Uvezi budžet
            <input
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files[0];
                if (!file) return;
                importBudget(file)
                  .then(importBudgetData)
                  .catch((err) => showToast(err.message, 'danger'));
                e.target.value = '';
              }}
            />
          </label>
        </div>
      </div>

      <div className="budget__scroll">
        <table className="bg">
          <thead>
            <tr>
              <th className="bg__th bg__label-col">Stavka</th>
              {cols.map((m) => (
                <th
                  key={m}
                  className={`bg__th bg__month-head ${m === currentMonth ? 'bg__col--current' : ''}`}
                >
                  {MONTHS_SHORT[m]}
                </th>
              ))}
              <th className="bg__th bg__total-head">Ukupno</th>
            </tr>
          </thead>

          <tbody>
            {/* ── PRIHODI ── */}
            <tr className="bg__section-row">
              <td colSpan={14} className="bg__section-label">PRIHODI</td>
            </tr>

            {[
              { field: 'plata', label: 'Plata' },
              { field: 'bonus', label: 'Bonus / Ostalo' },
            ].map(({ field, label }) => {
              const amounts = yb.income[field];
              const total = rowTotal(amounts);
              return (
                <tr key={field} className="bg__row">
                  <td className="bg__label-col bg__row-label">{label}</td>
                  {cols.map((m) => (
                    <td key={m} className={`bg__cell ${m === currentMonth ? 'bg__col--current' : ''}`}>
                      <BudgetCell
                        value={amounts[m]}
                        onSave={(v) => updateBudgetIncome(year, field, m, v)}
                      />
                    </td>
                  ))}
                  <td className="bg__total-cell">{fmt(total)}</td>
                </tr>
              );
            })}

            {/* Subtotal in */}
            <tr className="bg__subtotal-row">
              <td className="bg__label-col bg__row-label bg__row-label--sub">Ukupno prihodi</td>
              {cols.map((m) => (
                <td key={m} className={`bg__cell bg__cell--computed ${m === currentMonth ? 'bg__col--current' : ''}`}>
                  {inPerMonth[m] > 0 ? fmt(inPerMonth[m]) : '—'}
                </td>
              ))}
              <td className="bg__total-cell bg__total-cell--strong">{hasAnyIn ? fmt(totalIn) : '—'}</td>
            </tr>

            {/* ── RASHODI ── */}
            <tr className="bg__section-row">
              <td colSpan={14} className="bg__section-label">RASHODI / FONDOVI</td>
            </tr>

            {yb.funds.map((fund) => {
              const total = rowTotal(fund.amounts);
              return (
                <tr key={fund.id} className="bg__row bg__row--fund">
                  <td className="bg__label-col bg__row-label bg__row-label--fund">
                    {editingFundId === fund.id ? (
                      <input
                        className="bg__fund-name-input"
                        value={editingFundName}
                        autoFocus
                        onChange={(e) => setEditingFundName(e.target.value)}
                        onBlur={() => {
                          if (editingFundName.trim()) renameBudgetFund(year, fund.id, editingFundName.trim());
                          setEditingFundId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            if (editingFundName.trim()) renameBudgetFund(year, fund.id, editingFundName.trim());
                            setEditingFundId(null);
                          }
                          if (e.key === 'Escape') setEditingFundId(null);
                        }}
                      />
                    ) : (
                      <span
                        className="bg__fund-name"
                        onDoubleClick={() => {
                          setEditingFundId(fund.id);
                          setEditingFundName(fund.name);
                        }}
                        title="Dvoklikom preimenuj"
                      >
                        {fund.name}
                      </span>
                    )}
                    <button
                      className={`bg__del-btn ${confirmDelete === fund.id ? 'bg__del-btn--confirm' : ''}`}
                      onClick={() => handleDeleteFund(fund.id)}
                      title={confirmDelete === fund.id ? 'Klikni ponovo za potvrdu' : 'Obriši red'}
                    >
                      {confirmDelete === fund.id ? '⚠' : '×'}
                    </button>
                  </td>
                  {cols.map((m) => (
                    <td key={m} className={`bg__cell ${m === currentMonth ? 'bg__col--current' : ''}`}>
                      <BudgetCell
                        value={fund.amounts[m]}
                        onSave={(v) => updateBudgetFund(year, fund.id, m, v)}
                      />
                    </td>
                  ))}
                  <td className="bg__total-cell">{fmt(total)}</td>
                </tr>
              );
            })}

            {/* Add fund row */}
            <tr className="bg__add-row">
              <td colSpan={14} className="bg__add-cell">
                <input
                  ref={addInputRef}
                  className="bg__add-input"
                  placeholder="+ Dodaj fond ili kategoriju..."
                  value={newFundName}
                  onChange={(e) => setNewFundName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddFund()}
                />
                {newFundName.trim() && (
                  <button className="btn btn--primary btn--sm" onClick={handleAddFund}>
                    Dodaj
                  </button>
                )}
              </td>
            </tr>

            {/* Subtotal out */}
            {yb.funds.length > 0 && (
              <tr className="bg__subtotal-row">
                <td className="bg__label-col bg__row-label bg__row-label--sub">Ukupno rashodi</td>
                {cols.map((m) => (
                  <td key={m} className={`bg__cell bg__cell--computed ${m === currentMonth ? 'bg__col--current' : ''}`}>
                    {outPerMonth[m] > 0 ? fmt(outPerMonth[m]) : '—'}
                  </td>
                ))}
                <td className="bg__total-cell bg__total-cell--strong">{hasAnyOut ? fmt(totalOut) : '—'}</td>
              </tr>
            )}

            {/* ── BILANS ── */}
            <tr className="bg__balance-row">
              <td className="bg__label-col bg__row-label bg__row-label--balance">BILANS</td>
              {cols.map((m) => {
                const hasData = inPerMonth[m] > 0 || outPerMonth[m] > 0;
                const bal = balancePerMonth[m];
                return (
                  <td
                    key={m}
                    className={`bg__cell bg__balance-cell ${m === currentMonth ? 'bg__col--current' : ''} ${
                      hasData ? (bal >= 0 ? 'bg__balance-cell--pos' : 'bg__balance-cell--neg') : ''
                    }`}
                  >
                    {hasData ? (bal > 0 ? '+' : '') + fmt(bal) : '—'}
                  </td>
                );
              })}
              <td
                className={`bg__total-cell bg__total-cell--strong bg__balance-total ${
                  hasAnyIn || hasAnyOut
                    ? totalBalance >= 0
                      ? 'bg__balance-cell--pos'
                      : 'bg__balance-cell--neg'
                    : ''
                }`}
              >
                {hasAnyIn || hasAnyOut ? (totalBalance > 0 ? '+' : '') + fmt(totalBalance) : '—'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
