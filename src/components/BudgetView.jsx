import { useState, useRef, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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

function BudgetCell({ value, onSave }) {
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
      className={`bgc ${value != null ? 'bgc--filled' : 'bgc--empty'}`}
      onClick={startEdit}
    >
      {fmt(value)}
    </span>
  );
}

function SortableFundRow({
  fund, cols, currentMonth, confirmDelete,
  onSave, onDelete, onStartRename, onRename, onRenameCancel,
  editingFundId, editingFundName, setEditingFundName,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: fund.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const total = rowTotal(fund.amounts);

  return (
    <tr ref={setNodeRef} style={style} className="bg__row bg__row--fund">
      <td className="bg__label-col bg__row-label bg__row-label--fund">
        <span
          className="bg__drag-handle"
          {...attributes}
          {...listeners}
          title="Prevuci da promenjaš redosled"
        >
          ⠿
        </span>

        {editingFundId === fund.id ? (
          <input
            className="bg__fund-name-input"
            value={editingFundName}
            autoFocus
            onChange={(e) => setEditingFundName(e.target.value)}
            onBlur={() => onRename(fund.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onRename(fund.id);
              if (e.key === 'Escape') onRenameCancel();
            }}
          />
        ) : (
          <span
            className="bg__fund-name"
            onDoubleClick={() => onStartRename(fund.id, fund.name)}
            title="Dvoklikom preimenuj"
          >
            {fund.name}
          </span>
        )}

        <button
          className={`bg__del-btn ${confirmDelete === fund.id ? 'bg__del-btn--confirm' : ''}`}
          onClick={() => onDelete(fund.id)}
          title={confirmDelete === fund.id ? 'Klikni ponovo za potvrdu' : 'Obriši red'}
        >
          {confirmDelete === fund.id ? '⚠' : '×'}
        </button>
      </td>

      {cols.map((m) => (
        <td key={m} className={`bg__cell ${m === currentMonth ? 'bg__col--current' : ''}`}>
          <BudgetCell
            value={fund.amounts[m]}
            onSave={(v) => onSave(fund.id, m, v)}
          />
        </td>
      ))}

      <td className="bg__total-cell">{fmt(total)}</td>
    </tr>
  );
}

export default function BudgetView() {
  const {
    data, updateBudgetIncome, updateBudgetFund, addBudgetFund,
    removeBudgetFund, renameBudgetFund, reorderBudgetFunds,
    copyBudgetToYear, importBudgetData, showToast,
  } = useApp();

  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const currentMonth = year === thisYear ? new Date().getMonth() : -1;

  const yb = data.budget?.[year] ?? {
    income: { plata: Array(12).fill(null), bonus: Array(12).fill(null) },
    funds: [],
  };

  const [newFundName, setNewFundName] = useState('');
  const [editingFundId, setEditingFundId] = useState(null);
  const [editingFundName, setEditingFundName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [copyConfirm, setCopyConfirm] = useState(false);
  const addInputRef = useRef(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

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

  function handleStartRename(fundId, name) {
    setEditingFundId(fundId);
    setEditingFundName(name);
  }

  function handleRename(fundId) {
    if (editingFundName.trim()) renameBudgetFund(year, fundId, editingFundName.trim());
    setEditingFundId(null);
  }

  function handleCopyToNextYear() {
    const nextYear = year + 1;
    const hasExisting = !!(
      data.budget?.[nextYear] &&
      (data.budget[nextYear].funds?.length > 0 ||
        data.budget[nextYear].income?.plata.some((v) => v != null))
    );
    if (hasExisting && !copyConfirm) {
      setCopyConfirm(true);
      setTimeout(() => setCopyConfirm(false), 3000);
      return;
    }
    copyBudgetToYear(year, nextYear);
    setCopyConfirm(false);
    setYear(nextYear);
    showToast(`Budžet kopiran u ${nextYear}.`);
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = yb.funds.map((f) => f.id);
    const oldIndex = ids.indexOf(active.id);
    const newIndex = ids.indexOf(over.id);
    reorderBudgetFunds(year, arrayMove(ids, oldIndex, newIndex));
  }

  const cols = Array.from({ length: 12 }, (_, i) => i);
  const fundIds = yb.funds.map((f) => f.id);

  return (
    <div className="budget">
      <div className="budget__head">
        <div className="budget__title">
          <button className="budget__year-nav" onClick={() => setYear((y) => y - 1)}>‹</button>
          Budžet {year}
          <button className="budget__year-nav" onClick={() => setYear((y) => y + 1)}>›</button>
        </div>
        <div className="budget__hint">
          Kliknite na ćeliju da unesete vrednost · Dvoklikom na naziv fonda ga preimenujete · Prevucite ⠿ da promenite redosled
        </div>
        <div className="budget__tools">
          <button
            className={`btn btn--sm ${copyConfirm ? 'btn--danger' : 'btn--ghost'}`}
            onClick={handleCopyToNextYear}
            title={`Kopiraj fondove i platu iz ${year} u ${year + 1}`}
          >
            {copyConfirm ? `⚠ Prepiši ${year + 1}?` : `📋 Kopiraj u ${year + 1}`}
          </button>
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
                <th key={m} className={`bg__th bg__month-head ${m === currentMonth ? 'bg__col--current' : ''}`}>
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
                      <BudgetCell value={amounts[m]} onSave={(v) => updateBudgetIncome(year, field, m, v)} />
                    </td>
                  ))}
                  <td className="bg__total-cell">{fmt(total)}</td>
                </tr>
              );
            })}

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

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={fundIds} strategy={verticalListSortingStrategy}>
                {yb.funds.map((fund) => (
                  <SortableFundRow
                    key={fund.id}
                    fund={fund}
                    cols={cols}
                    currentMonth={currentMonth}
                    confirmDelete={confirmDelete}
                    onSave={(fundId, m, v) => updateBudgetFund(year, fundId, m, v)}
                    onDelete={handleDeleteFund}
                    onStartRename={handleStartRename}
                    onRename={handleRename}
                    onRenameCancel={() => setEditingFundId(null)}
                    editingFundId={editingFundId}
                    editingFundName={editingFundName}
                    setEditingFundName={setEditingFundName}
                  />
                ))}
              </SortableContext>
            </DndContext>

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
                  <button className="btn btn--primary btn--sm" onClick={handleAddFund}>Dodaj</button>
                )}
              </td>
            </tr>

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
                    ? totalBalance >= 0 ? 'bg__balance-cell--pos' : 'bg__balance-cell--neg'
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
