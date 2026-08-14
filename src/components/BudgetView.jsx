import { useState, useRef } from 'react';
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
import { categoryColor } from '../utils/helpers.js';
import { isSavingsFund } from '../utils/dataTransforms.js';
import BudgetCell, { fmt } from './BudgetCell.jsx';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Avg', 'Sep', 'Okt', 'Nov', 'Dec'];

function rowTotal(arr) {
  const hasAny = arr.some((v) => v != null);
  if (!hasAny) return null;
  return arr.reduce((s, v) => s + (v ?? 0), 0);
}

function SortableFundRow({
  fund, cols, currentMonth,
  onSave, onDelete, onStartRename, onRename, onRenameCancel,
  editingFundId, editingFundName, setEditingFundName,
  expanded, onToggleExpand, categories, mapped, onToggleCat,
  isSavings, onToggleSavings,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: fund.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const total = rowTotal(fund.amounts);
  const contribs = fund.contributions ?? [];

  return (
    <>
      <tr
        ref={setNodeRef}
        style={style}
        className={`bg__row bg__row--fund ${isSavings ? 'bg__row--savings' : ''}`}
      >
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
            type="button"
            className={`bg__cat-chip bg__save-chip ${isSavings ? 'bg__save-chip--on' : ''}`}
            aria-pressed={isSavings}
            aria-label={`Fond štednje: ${fund.name}`}
            title={
              isSavings
                ? 'Fond štednje — odvajanja se potvrđuju u mesecu'
                : 'Označi kao fond štednje'
            }
            onClick={() => onToggleSavings(fund.id, isSavings ? null : 'savings')}
          >
            💰
          </button>

          {/* Mapping spend categories to a savings fund would be a lie — its
              money is set aside, never compared against expenses. */}
          {!isSavings && (
            <button
              className={`bg__cat-chip ${expanded ? 'bg__cat-chip--open' : ''}`}
              onClick={onToggleExpand}
              title={expanded ? 'Sakrij kategorije' : 'Kategorije troškova za ovaj fond'}
            >
              📂{mapped.length > 0 ? ` ${mapped.length}` : ''}
            </button>
          )}

          {/* One click — the undo on the toast replaces the confirm. */}
          <button
            className="bg__del-btn"
            onClick={() => onDelete(fund.id)}
            title="Obriši red"
            aria-label={`Obriši red: ${fund.name}`}
          >
            ×
          </button>
        </td>

        {cols.map((m) => (
          <td
            key={m}
            className={`bg__cell ${m === currentMonth ? 'bg__col--current' : ''} ${
              isSavings ? 'bg__cell--savings' : ''
            }`}
          >
            {/* Read-only adornment beside the cell, never in place of it — the
                plan stays editable on a confirmed month. `!= null` is the test,
                so a confirmed zero is marked and an unconfirmed month is not. */}
            {isSavings && contribs[m] != null && (
              <span
                className="bg__confirm-mark"
                role="img"
                aria-label={`Odvojeno: ${fmt(contribs[m])} RSD`}
                title={`Odvojeno u ${MONTHS_SHORT[m]}: ${fmt(contribs[m])} RSD`}
              >
                ✓
              </span>
            )}
            <BudgetCell
              value={fund.amounts[m]}
              onSave={(v) => onSave(fund.id, m, v)}
            />
          </td>
        ))}

        <td className="bg__total-cell">{fmt(total)}</td>
      </tr>

      {expanded && !isSavings && !isDragging && (
        <tr className="bg__tracking-row">
          <td colSpan={14} className="bg__tracking-cell">
            <div className="bg__tracking-panel">
              <span className="bg__tracking-label">
                {categories.length === 0 ? 'Nema kategorija — dodaj ih u Kategorije.' : 'Kategorije:'}
              </span>
              <div className="bg__tracking-pills">
                {categories.map((cat) => {
                  const active = mapped.includes(cat);
                  const color = categoryColor(cat, categories);
                  return (
                    <button
                      key={cat}
                      type="button"
                      className="cat-pill tracking-pill"
                      style={
                        active
                          ? { background: color, borderColor: color, color: '#fff' }
                          : { background: color + '18', borderColor: color + '70', color }
                      }
                      onClick={() => onToggleCat(cat)}
                    >
                      {active && <span className="tracking-pill__check">✓ </span>}
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function BudgetView() {
  const {
    data, updateBudgetIncome, updateBudgetFund, addBudgetFund,
    updateBudgetIncomeRow, addBudgetIncomeRow, removeBudgetIncomeRow, renameBudgetIncomeRow,
    removeBudgetFund, renameBudgetFund, reorderBudgetFunds,
    copyBudgetToYear, importBudgetData, showToast, updateTrackingMap,
    setBudgetFundKind,
  } = useApp();

  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const currentMonth = year === thisYear ? new Date().getMonth() : -1;

  const yb = data.budget?.[year] ?? {
    income: { plata: Array(12).fill(null), bonus: Array(12).fill(null), extra: [] },
    funds: [],
  };
  const extraIncome = yb.income.extra ?? [];

  const [newFundName, setNewFundName] = useState('');
  const [editingFundId, setEditingFundId] = useState(null);
  const [editingFundName, setEditingFundName] = useState('');
  const [newIncomeName, setNewIncomeName] = useState('');
  const [editingIncomeId, setEditingIncomeId] = useState(null);
  const [editingIncomeName, setEditingIncomeName] = useState('');
  const [copyConfirm, setCopyConfirm] = useState(false);
  const [expandedFundId, setExpandedFundId] = useState(null);
  const addInputRef = useRef(null);
  const addIncomeRef = useRef(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const inPerMonth = Array.from({ length: 12 }, (_, i) =>
    (yb.income.plata[i] ?? 0) +
    (yb.income.bonus[i] ?? 0) +
    extraIncome.reduce((s, r) => s + (r.amounts[i] ?? 0), 0)
  );
  const outPerMonth = Array.from({ length: 12 }, (_, i) =>
    yb.funds.reduce((s, f) => s + (f.amounts[i] ?? 0), 0)
  );
  const balancePerMonth = inPerMonth.map((inc, i) => inc - outPerMonth[i]);
  const totalIn = inPerMonth.reduce((s, v) => s + v, 0);
  const totalOut = outPerMonth.reduce((s, v) => s + v, 0);
  const totalBalance = totalIn - totalOut;
  const hasAnyIn =
    yb.income.plata.some((v) => v != null) ||
    yb.income.bonus.some((v) => v != null) ||
    extraIncome.some((r) => r.amounts.some((v) => v != null));
  const hasAnyOut = yb.funds.some((f) => f.amounts.some((v) => v != null));

  function handleAddFund() {
    const name = newFundName.trim();
    if (!name) return;
    addBudgetFund(year, name);
    setNewFundName('');
    addInputRef.current?.focus();
  }

  function handleAddIncomeRow() {
    const name = newIncomeName.trim();
    if (!name) return;
    addBudgetIncomeRow(year, name);
    setNewIncomeName('');
    addIncomeRef.current?.focus();
  }

  function handleRenameIncomeRow(rowId) {
    if (editingIncomeName.trim()) renameBudgetIncomeRow(year, rowId, editingIncomeName.trim());
    setEditingIncomeId(null);
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
        data.budget[nextYear].income?.plata.some((v) => v != null) ||
        data.budget[nextYear].income?.extra?.length > 0)
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
        <div className="budget__head-text">
          <div className="budget__title">Godišnji budžet</div>
          <div className="budget__hint">
            Isplaniraj prihode i fondove kroz celu godinu. Klikni na ćeliju da je izmeniš.
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="budget__year-nav" onClick={() => setYear((y) => y - 1)}>‹</button>
          <div style={{ fontSize: 17, fontWeight: 700, fontVariantNumeric: 'tabular-nums', minWidth: 56, textAlign: 'center' }}>
            {year}
          </div>
          <button className="budget__year-nav" onClick={() => setYear((y) => y + 1)}>›</button>
        </div>
      </div>

      <div className="budget__summary">
        <div className="budget__summary-card">
          <div className="budget__summary-label">
            <span className="budget__summary-dot" style={{ background: 'var(--primary)' }} />
            Ukupno prihodi
          </div>
          <div className="budget__summary-value">
            {hasAnyIn ? fmt(totalIn) : '—'} <span className="budget__summary-unit">RSD</span>
          </div>
        </div>
        <div className="budget__summary-card">
          <div className="budget__summary-label">
            <span className="budget__summary-dot" style={{ background: 'var(--danger)' }} />
            Ukupno rashodi
          </div>
          <div className="budget__summary-value">
            {hasAnyOut ? fmt(totalOut) : '—'} <span className="budget__summary-unit">RSD</span>
          </div>
        </div>
        <div className="budget__summary-card">
          <div className="budget__summary-label">
            <span className="budget__summary-dot" style={{ background: totalBalance >= 0 ? 'var(--primary)' : 'var(--danger)' }} />
            Bilans (ušteđeno)
          </div>
          <div
            className="budget__summary-value"
            style={{ color: (hasAnyIn || hasAnyOut) ? (totalBalance >= 0 ? 'var(--primary)' : 'var(--danger)') : 'var(--text)' }}
          >
            {(hasAnyIn || hasAnyOut) ? (totalBalance > 0 ? '+' : '') + fmt(totalBalance) : '—'} <span className="budget__summary-unit">RSD</span>
          </div>
        </div>
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
      <div className="budget__hint" style={{ marginBottom: -4 }}>
        Dvoklikom na naziv fonda ga preimenujete · 💰 fond štednje · 📂 za kategorije · Prevucite ⠿ za redosled
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

            {/* Custom income rows — same twelve cells, plus rename and delete. */}
            {extraIncome.map((row) => {
              const total = rowTotal(row.amounts);
              return (
                <tr key={row.id} className="bg__row bg__row--income">
                  <td className="bg__label-col bg__row-label bg__row-label--income">
                    {editingIncomeId === row.id ? (
                      <input
                        className="bg__fund-name-input"
                        value={editingIncomeName}
                        autoFocus
                        onChange={(e) => setEditingIncomeName(e.target.value)}
                        onBlur={() => handleRenameIncomeRow(row.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameIncomeRow(row.id);
                          if (e.key === 'Escape') setEditingIncomeId(null);
                        }}
                      />
                    ) : (
                      <span
                        className="bg__fund-name"
                        onDoubleClick={() => {
                          setEditingIncomeId(row.id);
                          setEditingIncomeName(row.name);
                        }}
                        title="Dvoklikom preimenuj"
                      >
                        {row.name}
                      </span>
                    )}

                    {/* One click — the undo on the toast replaces the confirm. */}
                    <button
                      className="bg__del-btn"
                      onClick={() => removeBudgetIncomeRow(year, row.id)}
                      title="Obriši red"
                      aria-label={`Obriši prihod: ${row.name}`}
                    >
                      ×
                    </button>
                  </td>

                  {cols.map((m) => (
                    <td key={m} className={`bg__cell ${m === currentMonth ? 'bg__col--current' : ''}`}>
                      <BudgetCell
                        value={row.amounts[m]}
                        onSave={(v) => updateBudgetIncomeRow(year, row.id, m, v)}
                      />
                    </td>
                  ))}

                  <td className="bg__total-cell">{fmt(total)}</td>
                </tr>
              );
            })}

            {/* Add income row */}
            <tr className="bg__add-row">
              <td colSpan={14} className="bg__add-cell">
                <input
                  ref={addIncomeRef}
                  className="bg__add-input"
                  placeholder="+ Dodaj prihod (npr. honorar, izdavanje)..."
                  aria-label="Dodaj prihod"
                  value={newIncomeName}
                  onChange={(e) => setNewIncomeName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddIncomeRow()}
                />
                {newIncomeName.trim() && (
                  <button className="btn btn--primary btn--sm" onClick={handleAddIncomeRow}>Dodaj</button>
                )}
              </td>
            </tr>

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
                {yb.funds.map((fund) => {
                  const mapped = (data.trackingMaps?.[year] ?? {})[fund.id] ?? [];
                  const isSavings = isSavingsFund(fund);
                  return (
                    <SortableFundRow
                      key={fund.id}
                      fund={fund}
                      cols={cols}
                      currentMonth={currentMonth}
                      onSave={(fundId, m, v) => updateBudgetFund(year, fundId, m, v)}
                      onDelete={(fundId) => removeBudgetFund(year, fundId)}
                      onStartRename={handleStartRename}
                      onRename={handleRename}
                      onRenameCancel={() => setEditingFundId(null)}
                      editingFundId={editingFundId}
                      editingFundName={editingFundName}
                      setEditingFundName={setEditingFundName}
                      expanded={expandedFundId === fund.id && !isSavings}
                      onToggleExpand={() => setExpandedFundId((id) => id === fund.id ? null : fund.id)}
                      isSavings={isSavings}
                      // Collapse here too: flipping 💰 with the panel open would
                      // otherwise strand expandedFundId on a fund whose 📂 chip
                      // is gone, leaving no way to close it again.
                      onToggleSavings={(fundId, kind) => {
                        setBudgetFundKind(year, fundId, kind);
                        setExpandedFundId((id) => (id === fundId ? null : id));
                      }}
                      categories={data.categories}
                      mapped={mapped}
                      onToggleCat={(cat) => {
                        const next = mapped.includes(cat)
                          ? mapped.filter((c) => c !== cat)
                          : [...mapped, cat];
                        updateTrackingMap(year, fund.id, next);
                      }}
                    />
                  );
                })}
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
