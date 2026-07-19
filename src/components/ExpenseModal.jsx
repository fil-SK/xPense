import { useState, useEffect, useMemo } from 'react';
import { todayISO, CHART_COLORS } from '../utils/helpers.js';
import { useApp } from '../App.jsx';

function CategoryGroupPicker({ categories, groups, selected, onSelect, hasError }) {
  const colorIndex = useMemo(
    () => Object.fromEntries(categories.map((c, i) => [c, i])),
    [categories]
  );

  const selectedGroupId = useMemo(
    () => groups.find((g) => g.categories.includes(selected))?.id ?? '__ungrouped__',
    [groups, selected]
  );

  const [openIds, setOpenIds] = useState(() => new Set([selectedGroupId]));

  useEffect(() => {
    setOpenIds((prev) => new Set([...prev, selectedGroupId]));
  }, [selectedGroupId]);

  function toggleOpen(id) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const groupedNames = useMemo(
    () => new Set(groups.flatMap((g) => g.categories)),
    [groups]
  );
  const ungrouped = categories.filter((c) => !groupedNames.has(c));

  const sections = [
    ...groups
      .map((g) => ({ id: g.id, name: g.name, cats: g.categories.filter((c) => categories.includes(c)) }))
      .filter((s) => s.cats.length > 0),
    ...(ungrouped.length > 0 ? [{ id: '__ungrouped__', name: 'Opšte', cats: ungrouped }] : []),
  ];

  function renderPills(cats) {
    return (
      <div className="cgp-pills">
        {cats.map((c) => {
          const color = CHART_COLORS[(colorIndex[c] ?? 0) % CHART_COLORS.length];
          const active = selected === c;
          return (
            <button
              key={c}
              type="button"
              className="cat-pill"
              style={
                active
                  ? { background: color, borderColor: color, color: '#fff' }
                  : { background: color + '18', borderColor: color + '70', color }
              }
              onClick={() => onSelect(c)}
            >
              {c}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`cgp ${hasError ? 'cgp--error' : ''}`}>
      {sections.map((section) => {
        const isOpen = openIds.has(section.id);
        const hasSelected = section.cats.includes(selected);
        return (
          <div key={section.id} className={`cgp-card ${isOpen ? 'cgp-card--open' : ''} ${hasSelected ? 'cgp-card--selected' : ''}`}>
            <button type="button" className="cgp-card__header" onClick={() => toggleOpen(section.id)}>
              <span className="cgp-card__arrow">{isOpen ? '▾' : '▸'}</span>
              <span className="cgp-card__name">{section.name}</span>
              {hasSelected && !isOpen && (
                <span className="cgp-card__sel-badge">{selected}</span>
              )}
              <span className="cgp-card__count">{section.cats.length}</span>
            </button>
            <div className="cgp-card__body">
              <div className="cgp-card__inner">
                {renderPills(section.cats)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ExpenseModal({ expense, defaultDate, onClose }) {
  const { data, addExpense, updateExpense, addRecurring } = useApp();
  const isEdit = !!expense;

  const [form, setForm] = useState(
    isEdit
      ? { title: expense.title, date: expense.date, amount: String(expense.amount), category: expense.category, note: expense.note ?? '' }
      : { title: '', date: defaultDate ?? todayISO(), amount: '', category: '', note: '' }
  );
  const [errors, setErrors] = useState({});
  const [recurring, setRecurring] = useState(false);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function validate() {
    const errs = {};
    if (!form.title.trim()) errs.title = 'Naslov je obavezan.';
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0)
      errs.amount = 'Unesite ispravan iznos.';
    if (!form.date) errs.date = 'Datum je obavezan.';
    if (!form.category) errs.category = 'Kategorija je obavezna.';
    return errs;
  }

  function handleSubmit() {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    const payload = {
      title: form.title.trim(),
      date: form.date,
      amount: Math.round(Number(form.amount)),
      category: form.category,
      note: form.note.trim(),
    };
    if (isEdit) {
      updateExpense(expense.id, payload);
    } else if (recurring) {
      addRecurring({ ...payload, startDate: payload.date, frequency: 'monthly' });
    } else {
      addExpense(payload);
    }
    onClose();
  }

  const hasGroups = (data.categoryGroups?.length ?? 0) > 0;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal__header">
          <span className="modal__title">{isEdit ? 'Izmeni trošak' : 'Novi trošak'}</span>
          <button className="modal__close" onClick={onClose}>✕</button>
        </div>

        <div className="form-group">
          <label className="form-label">Naziv / opis</label>
          <input
            className={`form-input ${errors.title ? 'form-input--error' : ''}`}
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="npr. Ručak, Gorivo, Netflix..."
            autoFocus
          />
          {errors.title && <span className="form-error">{errors.title}</span>}
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Datum</label>
            <input
              type="date"
              className={`form-input ${errors.date ? 'form-input--error' : ''}`}
              value={form.date}
              onChange={(e) => set('date', e.target.value)}
            />
            {errors.date && <span className="form-error">{errors.date}</span>}
          </div>
          <div className="form-group">
            <label className="form-label">Iznos (RSD)</label>
            <input
              type="number"
              min="0"
              className={`form-input ${errors.amount ? 'form-input--error' : ''}`}
              value={form.amount}
              onChange={(e) => set('amount', e.target.value)}
              placeholder="0"
            />
            {errors.amount && <span className="form-error">{errors.amount}</span>}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Kategorija</label>
          {hasGroups ? (
            <CategoryGroupPicker
              categories={data.categories}
              groups={data.categoryGroups}
              selected={form.category}
              onSelect={(c) => set('category', c)}
              hasError={!!errors.category}
            />
          ) : (
            <div className={`cat-pills ${errors.category ? 'cat-pills--error' : ''}`}>
              {data.categories.map((c, i) => {
                const color = CHART_COLORS[i % CHART_COLORS.length];
                const active = form.category === c;
                return (
                  <button
                    key={c}
                    type="button"
                    className="cat-pill"
                    style={
                      active
                        ? { background: color, borderColor: color, color: '#fff' }
                        : { background: color + '18', borderColor: color + '70', color }
                    }
                    onClick={() => set('category', c)}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          )}
          {errors.category && <span className="form-error">{errors.category}</span>}
        </div>

        <div className="form-group">
          <label className="form-label">Napomena (opciono)</label>
          <textarea
            className="form-textarea"
            value={form.note}
            onChange={(e) => set('note', e.target.value)}
            placeholder="Dodatni detalji..."
          />
        </div>

        {!isEdit && (
          <div className="form-recurring">
            <button
              type="button"
              aria-label="Ponavljajući trošak"
              className={`btn-recurring ${recurring ? 'btn-recurring--active' : ''}`}
              onClick={() => setRecurring((v) => !v)}
            >
              🔁
            </button>
            <span className="form-recurring__label">ponavljajući trošak - automatski svaki mesec</span>
          </div>
        )}

        <div className="modal__footer">
          <button className="btn btn--ghost" onClick={onClose}>Otkaži</button>
          <button className="btn btn--primary" onClick={handleSubmit} disabled={!form.category}>
            {isEdit ? 'Sačuvaj izmene' : 'Dodaj trošak'}
          </button>
        </div>
      </div>
    </div>
  );
}
