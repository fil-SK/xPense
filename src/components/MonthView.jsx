import { useState, useMemo, useRef, useEffect, useCallback, useId } from 'react';
import { useApp } from '../App.jsx';
import {
  getExpensesForMonth, getTotalAmount, formatAmount,
  getMonthName, getByCategory, categoryColor, todayISO,
  filterByCategories,
} from '../utils/helpers.js';
import ExpenseItem from './ExpenseItem.jsx';
import ExpenseModal from './ExpenseModal.jsx';
import Charts from './Charts.jsx';
import BudgetPanel from './BudgetPanel.jsx';

const SORT_OPTIONS = [
  { value: 'date-desc', label: 'Datum (noviji)' },
  { value: 'date-asc', label: 'Datum (stariji)' },
  { value: 'amount-desc', label: 'Iznos (veći)' },
  { value: 'amount-asc', label: 'Iznos (manji)' },
  { value: 'category', label: 'Kategorija' },
];

function sortExpenses(expenses, sort) {
  return [...expenses].sort((a, b) => {
    switch (sort) {
      case 'date-desc': return b.date.localeCompare(a.date);
      case 'date-asc':  return a.date.localeCompare(b.date);
      case 'amount-desc': return b.amount - a.amount;
      case 'amount-asc':  return a.amount - b.amount;
      case 'category': return a.category.localeCompare(b.category);
      default: return 0;
    }
  });
}

// The month's category filter. It only lists categories that actually occur in
// this month — a pill for a category with nothing behind it answers a question
// nobody asked, and it keeps the panel from growing with the category list.
//
// The group chips are a bulk toggle over their own categories, which is the
// whole point of the feature: "sve iz Režija" is one click rather than five.
// A chip reads as pressed only when every one of its categories is selected,
// so it doubles as an indicator when the user picks them individually.
function CategoryFilter({
  panelId, categories, counts, groups, selected, allCategories,
  onToggleCategory, onToggleGroup,
}) {
  const labelId = useId();
  return (
    <div className="mfilter" id={panelId}>
      {groups.length > 0 && (
        <div className="mfilter__row" role="group" aria-labelledby={`${labelId}-g`}>
          <span className="mfilter__label" id={`${labelId}-g`}>Grupe</span>
          <div className="mfilter__chips">
            {groups.map((g) => {
              const active = g.categories.every((c) => selected.includes(c));
              return (
                <button
                  key={g.id}
                  type="button"
                  className={`mfilter__group ${active ? 'mfilter__group--active' : ''}`}
                  aria-label={g.name}
                  aria-pressed={active}
                  onClick={() => onToggleGroup(g.categories)}
                >
                  {g.name}
                  <span className="mfilter__group-count" aria-hidden="true">
                    {g.categories.length}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="mfilter__row" role="group" aria-labelledby={`${labelId}-c`}>
        <span className="mfilter__label" id={`${labelId}-c`}>Kategorije</span>
        <div className="mfilter__chips">
          {categories.map((c) => {
            const color = categoryColor(c, allCategories);
            const active = selected.includes(c);
            return (
              <button
                key={c}
                type="button"
                className="cat-pill"
                aria-label={c}
                aria-pressed={active}
                style={
                  active
                    ? { background: color, borderColor: color, color: '#fff' }
                    : { background: color + '18', borderColor: color + '70', color }
                }
                onClick={() => onToggleCategory(c)}
              >
                {c}
                {/* Hidden from the name so the button reads as just the category. */}
                <span className="mfilter__count" aria-hidden="true">{counts[c]}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function MonthView({ year, month, isCurrent }) {
  const { data, navigateTo, prevView, setMonthlyNote } = useApp();
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('date-desc');
  const [showCharts, setShowCharts] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [filterCats, setFilterCats] = useState([]);
  const chartsRef = useRef(null);
  const filterPanelId = useId();
  const [noteText, setNoteText] = useState(() => data.monthlyNotes?.[year]?.[month] ?? '');

  useEffect(() => {
    setNoteText(data.monthlyNotes?.[year]?.[month] ?? '');
  }, [data.monthlyNotes, year, month]);

  const handleNoteBlur = useCallback(() => {
    const trimmed = noteText.trim();
    const current = data.monthlyNotes?.[year]?.[month] ?? '';
    if (trimmed !== current) setMonthlyNote(year, month, trimmed);
  }, [noteText, data.monthlyNotes, year, month, setMonthlyNote]);

  useEffect(() => {
    if (showCharts && chartsRef.current) {
      chartsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [showCharts]);

  const allExpenses = useMemo(
    () => getExpensesForMonth(data.expenses, year, month),
    [data.expenses, year, month]
  );

  // Only the categories present this month, in the order they appear in
  // data.categories so they keep the same reading order (and colors) as the
  // pickers elsewhere. Names no longer in that list — archived, or imported —
  // sort to the end alphabetically instead of onto position -1.
  const { catNames, catCounts } = useMemo(() => {
    const counts = {};
    allExpenses.forEach((e) => { counts[e.category] = (counts[e.category] ?? 0) + 1; });
    const order = data.categories ?? [];
    const names = Object.keys(counts).sort((a, b) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      if (ia === ib) return a.localeCompare(b, 'sr');
      return (ia < 0 ? Infinity : ia) - (ib < 0 ? Infinity : ib);
    });
    return { catNames: names, catCounts: counts };
  }, [allExpenses, data.categories]);

  // Groups are narrowed to what this month contains, so a chip's bulk toggle
  // only ever touches categories the user can actually see beneath it, and a
  // group with nothing spent in it doesn't take up a row.
  const monthGroups = useMemo(() => {
    const present = new Set(catNames);
    return (data.categoryGroups ?? [])
      .map((g) => ({ ...g, categories: g.categories.filter((c) => present.has(c)) }))
      .filter((g) => g.categories.length > 0);
  }, [data.categoryGroups, catNames]);

  // A selection from the month we just left would silently hide rows here.
  useEffect(() => {
    setFilterCats((s) => (s.length ? [] : s));
  }, [year, month]);

  const toggleFilterCat = useCallback((c) => {
    setFilterCats((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]));
  }, []);

  const toggleFilterGroup = useCallback((cats) => {
    setFilterCats((s) =>
      cats.every((c) => s.includes(c))
        ? s.filter((c) => !cats.includes(c))
        : [...s, ...cats.filter((c) => !s.includes(c))]
    );
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const byCat = filterByCategories(allExpenses, filterCats);
    const base = q
      ? byCat.filter(
          (e) =>
            e.title.toLowerCase().includes(q) ||
            e.category.toLowerCase().includes(q) ||
            (e.note && e.note.toLowerCase().includes(q))
        )
      : byCat;
    return sortExpenses(base, sort);
  }, [allExpenses, search, sort, filterCats]);

  const narrowed = filterCats.length > 0 || search.trim() !== '';
  const total = getTotalAmount(allExpenses);
  const byCategory = getByCategory(allExpenses);
  const topCategory = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];
  const avg = allExpenses.length > 0 ? total / allExpenses.length : 0;

  return (
    <div className="month-view view">
      <div className="month-header">
        <button
          className="month-header__back"
          onClick={() => navigateTo(prevView || (isCurrent ? 'home' : 'previous'))}
          title="Nazad"
        >
          ←
        </button>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 className="month-header__title">
              {getMonthName(month)} {year}
            </h1>
            {isCurrent && <span className="month-header__badge">Ovaj mesec</span>}
          </div>
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-card__label">Ukupno potrošeno</div>
          <div className="stat-card__value stat-card__value--primary">{formatAmount(total)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">Broj transakcija</div>
          <div className="stat-card__value">{allExpenses.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">Prosek po stavci</div>
          <div className="stat-card__value">{allExpenses.length > 0 ? formatAmount(avg) : '—'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">Najveća kategorija</div>
          <div className="stat-card__value" style={{ fontSize: 16 }}>
            {topCategory
              ? (
                <>
                  <span
                    style={{
                      display: 'inline-block',
                      width: 10, height: 10, borderRadius: '50%', marginRight: 6,
                      background: categoryColor(topCategory[0], data.categories),
                    }}
                  />
                  {topCategory[0]}
                </>
              )
              : '—'}
          </div>
          {topCategory && (
            <div className="stat-card__delta">{formatAmount(topCategory[1])}</div>
          )}
        </div>
      </div>

      <div className="month-note">
        <textarea
          className="month-note__input"
          placeholder="Napomena za ovaj mesec..."
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          onBlur={handleNoteBlur}
          rows={2}
        />
      </div>

      <BudgetPanel year={year} month={month} />

      <div className="toolbar">
        <input
          className="toolbar__search"
          placeholder="Pretraži troškove..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="toolbar__select"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <button className="btn btn--primary btn--sm" onClick={() => setAdding(true)}>
          + Dodaj trošak
        </button>
        {catNames.length > 0 && (
          <button
            className={`btn btn--ghost btn--sm ${showFilter ? 'btn--toggled' : ''}`}
            onClick={() => setShowFilter((v) => !v)}
            aria-expanded={showFilter}
            aria-controls={filterPanelId}
          >
            🏷️ Filter{filterCats.length > 0 ? ` (${filterCats.length})` : ''}
          </button>
        )}
        <button
          className={`btn btn--ghost btn--sm ${showCharts ? 'btn--toggled' : ''}`}
          onClick={() => setShowCharts((v) => !v)}
        >
          📊 Analiza
        </button>
      </div>

      {showFilter && catNames.length > 0 && (
        <CategoryFilter
          panelId={filterPanelId}
          categories={catNames}
          counts={catCounts}
          groups={monthGroups}
          selected={filterCats}
          allCategories={data.categories}
          onToggleCategory={toggleFilterCat}
          onToggleGroup={toggleFilterGroup}
        />
      )}

      {showCharts && (
        <div ref={chartsRef}>
          <Charts expenses={allExpenses} year={year} month={month} />
        </div>
      )}

      {/* Kept outside the collapsible panel: a filter left on is otherwise
          invisible once the panel is closed, and this is the way back off it.
          The stats row above stays the month's full picture — this line is the
          answer to "koliko sam potrošio na Režije". */}
      {narrowed && (
        <div className="mfilter-summary">
          <span>
            Prikazano: <strong>{filtered.length}</strong> od {allExpenses.length} ·{' '}
            <strong>{formatAmount(getTotalAmount(filtered))}</strong>
          </span>
          {filterCats.length > 0 && (
            <button className="btn btn--ghost btn--sm" onClick={() => setFilterCats([])}>
              Poništi filter
            </button>
          )}
        </div>
      )}

      <div className="expense-list">
        {filtered.length === 0 ? (
          <div className="expense-list__empty">
            <div className="expense-list__empty-icon">
              {allExpenses.length === 0 ? '💸' : '🔍'}
            </div>
            {allExpenses.length === 0
              ? 'Nema troškova za ovaj mesec. Dodaj prvi!'
              : search.trim()
                ? 'Nema rezultata za pretragu.'
                : 'Nema troškova u izabranim kategorijama.'}
          </div>
        ) : (
          filtered.map((e) => <ExpenseItem key={e.id} expense={e} />)
        )}
      </div>

      {adding && (
        <ExpenseModal
          defaultDate={
            isCurrent
              ? todayISO()
              : `${year}-${String(month + 1).padStart(2, '0')}-01`
          }
          onClose={() => setAdding(false)}
        />
      )}
    </div>
  );
}
