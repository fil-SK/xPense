import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { todayISO, categoryColor } from '../utils/helpers.js';
import { useApp } from '../App.jsx';

function CategoryGroupPicker({ categories, groups, selected, onSelect, hasError }) {
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
          const color = categoryColor(c, categories);
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

  // Only the first value survives, so this is the form as it was when the modal opened.
  const pristine = useRef(
    isEdit
      ? { title: expense.title, date: expense.date, amount: String(expense.amount), category: expense.category, note: expense.note ?? '' }
      : { title: '', date: defaultDate ?? todayISO(), amount: '', category: '', note: '' }
  );

  const [form, setForm] = useState(pristine.current);
  const [errors, setErrors] = useState({});
  const [recurring, setRecurring] = useState(false);
  const [confirmingClose, setConfirmingClose] = useState(false);

  const dirty = useMemo(
    () => recurring || Object.keys(form).some((k) => form[k] !== pristine.current[k]),
    [form, recurring]
  );

  // Closing throws the form away, so an edited form asks first. Every exit route
  // (overlay, ✕, Otkaži, Escape) goes through here — they all discard the same work.
  const returnFocus = useRef(null);
  const requestClose = useCallback(() => {
    if (!dirty) { onClose(); return; }
    returnFocus.current = document.activeElement;
    setConfirmingClose(true);
  }, [dirty, onClose]);

  // The form stays mounted behind the confirm, so the field the user left is still there to go back to.
  const cancelClose = useCallback(() => {
    setConfirmingClose(false);
    returnFocus.current?.focus?.();
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (e.key !== 'Escape') return;
      // While the confirm is up, Escape dismisses it and returns to the form.
      if (confirmingClose) cancelClose();
      else requestClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [confirmingClose, cancelClose, requestClose]);

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
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && requestClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="expense-modal-title">
        <div className="modal__header">
          <span className="modal__title" id="expense-modal-title">{isEdit ? 'Izmeni trošak' : 'Novi trošak'}</span>
          <button className="modal__close" onClick={requestClose} aria-label="Zatvori">✕</button>
        </div>

        <div className="modal__body">
          <div className="form-group">
            <label className="form-label">Naziv / opis</label>
            <input
              className={`form-input ${errors.title ? 'form-input--error' : ''}`}
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="npr. Ručak, Gorivo, Netflix..."
              aria-invalid={!!errors.title}
              autoFocus
            />
            {errors.title && <span className="form-error" role="alert">{errors.title}</span>}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Datum</label>
              <input
                type="date"
                className={`form-input ${errors.date ? 'form-input--error' : ''}`}
                value={form.date}
                onChange={(e) => set('date', e.target.value)}
                aria-invalid={!!errors.date}
              />
              {errors.date && <span className="form-error" role="alert">{errors.date}</span>}
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
                aria-invalid={!!errors.amount}
              />
              {errors.amount && <span className="form-error" role="alert">{errors.amount}</span>}
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
                {data.categories.map((c) => {
                  const color = categoryColor(c, data.categories);
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
            {errors.category && <span className="form-error" role="alert">{errors.category}</span>}
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
              />
              <span className="form-recurring__label">Ponavljajući trošak — automatski svakog meseca</span>
            </div>
          )}
        </div>

        <div className="modal__footer">
          <button className="btn btn--ghost" onClick={requestClose}>Otkaži</button>
          <button className="btn btn--primary" onClick={handleSubmit} disabled={!form.category}>
            {isEdit ? 'Sačuvaj izmene' : 'Dodaj trošak'}
          </button>
        </div>
      </div>

      {confirmingClose && <DiscardConfirm onKeepEditing={cancelClose} onDiscard={onClose} />}
    </div>
  );
}

function DiscardConfirm({ onKeepEditing, onDiscard }) {
  const keepRef = useRef(null);
  useEffect(() => { keepRef.current?.focus(); }, []);

  return (
    <div
      className="modal-overlay modal-overlay--stacked"
      onClick={(e) => e.target === e.currentTarget && onKeepEditing()}
    >
      <div className="modal modal--confirm" role="alertdialog" aria-modal="true" aria-labelledby="discard-title" aria-describedby="discard-text">
        <div className="modal__header">
          <span className="modal__title" id="discard-title">Odbaci unos?</span>
        </div>
        <p className="modal__text" id="discard-text">
          Uneti podaci nisu sačuvani i biće izgubljeni ako zatvoriš.
        </p>
        <div className="modal__footer">
          <button className="btn btn--ghost" ref={keepRef} onClick={onKeepEditing}>Nastavi unos</button>
          <button className="btn btn--danger" onClick={onDiscard}>Odbaci</button>
        </div>
      </div>
    </div>
  );
}
