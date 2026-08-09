import { useState, useEffect, useMemo, useRef, useCallback, useId } from 'react';
import { todayISO, categoryColor } from '../utils/helpers.js';
import useFocusTrap from '../hooks/useFocusTrap.js';
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

  // A collapsed card is clipped to zero height, so its pills stay in the DOM but must
  // drop out of the tab order — otherwise Tab lands on buttons nobody can see.
  function renderPills(cats, reachable) {
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
              aria-pressed={active}
              tabIndex={reachable ? undefined : -1}
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
            <button
              type="button"
              className="cgp-card__header"
              aria-expanded={isOpen}
              onClick={() => toggleOpen(section.id)}
            >
              <span className="cgp-card__arrow" aria-hidden="true">{isOpen ? '▾' : '▸'}</span>
              <span className="cgp-card__name">{section.name}</span>
              {hasSelected && !isOpen && (
                <span className="cgp-card__sel-badge">{selected}</span>
              )}
              <span className="cgp-card__count">{section.cats.length}</span>
            </button>
            <div className="cgp-card__body">
              <div className="cgp-card__inner">
                {renderPills(section.cats, isOpen)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// One modal, three jobs: add an expense, edit an expense, edit a recurring
// template. `recurring` and `expense` are mutually exclusive — pass at most one.
export default function ExpenseModal({ expense, recurring, defaultDate, onClose }) {
  const { data, addExpense, updateExpense, addRecurring, updateRecurring, addCategory } = useApp();
  const isRecurringEdit = !!recurring;
  const isEdit = !!expense;
  const source = expense ?? recurring;

  const uid = useId();
  const fieldId = (name) => `${uid}-${name}`;
  const errorId = (name) => `${uid}-${name}-error`;

  // Only the first value survives, so this is the form as it was when the modal opened.
  const pristine = useRef(
    source
      ? {
          title: source.title ?? '',
          date: (isRecurringEdit ? source.startDate : source.date) ?? '',
          amount: String(source.amount ?? ''),
          category: source.category ?? '',
          note: source.note ?? '',
        }
      : { title: '', date: defaultDate ?? todayISO(), amount: '', category: '', note: '' }
  );

  const [form, setForm] = useState(pristine.current);
  const [errors, setErrors] = useState({});
  const [makeRecurring, setMakeRecurring] = useState(false);
  const [confirmingClose, setConfirmingClose] = useState(false);

  // Inline category creation. It lives up here rather than inside the picker so
  // the Escape handler below can close the little form instead of the modal.
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [categoryAddError, setCategoryAddError] = useState('');
  const addCategoryBtnRef = useRef(null);
  const refocusAddBtn = useRef(false);

  // While the discard confirm is up it owns the trap; this one steps aside so the
  // two don't fight over focus.
  const dialogRef = useRef(null);
  useFocusTrap(dialogRef, { active: !confirmingClose });

  // A half-typed category name is unsaved input too, so it counts as dirty.
  const dirty = useMemo(
    () =>
      makeRecurring ||
      newCategory.trim() !== '' ||
      Object.keys(form).some((k) => form[k] !== pristine.current[k]),
    [form, makeRecurring, newCategory]
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

  const closeAddCategory = useCallback(() => {
    refocusAddBtn.current = true;
    setAddingCategory(false);
    setNewCategory('');
    setCategoryAddError('');
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (e.key !== 'Escape') return;
      // Innermost thing first: the confirm, then the inline category form, then
      // the modal itself. Escape should never skip a level.
      if (confirmingClose) cancelClose();
      else if (addingCategory) closeAddCategory();
      else requestClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [confirmingClose, addingCategory, cancelClose, closeAddCategory, requestClose]);

  // The button unmounts while the little form is open, so the focus it should
  // get back has to wait for it to render again.
  useEffect(() => {
    if (addingCategory || !refocusAddBtn.current) return;
    refocusAddBtn.current = false;
    addCategoryBtnRef.current?.focus();
  }, [addingCategory]);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  // The new category is saved globally right away — same as CategoryManager —
  // and selected, so the user lands back on a filled-in form.
  function commitNewCategory() {
    const name = newCategory.trim();
    if (!name) {
      setCategoryAddError('Unesite naziv kategorije.');
      return;
    }
    if (data.categories.includes(name)) {
      setCategoryAddError('Kategorija već postoji.');
      return;
    }
    addCategory(name);
    set('category', name);
    closeAddCategory();
  }

  function validate() {
    const errs = {};
    if (!form.title.trim()) errs.title = 'Naslov je obavezan.';
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0)
      errs.amount = 'Unesite ispravan iznos.';
    if (!isRecurringEdit && !form.date) errs.date = 'Datum je obavezan.';
    if (!form.category) errs.category = 'Kategorija je obavezna.';
    return errs;
  }

  function handleSubmit(e) {
    e?.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    const payload = {
      title: form.title.trim(),
      date: form.date,
      amount: Math.round(Number(form.amount)),
      category: form.category,
      note: form.note.trim(),
    };
    if (isRecurringEdit) {
      // startDate stays put: moving it would back-fill or orphan whole months.
      const { date, ...rest } = payload;
      updateRecurring(recurring.id, rest);
    } else if (isEdit) {
      updateExpense(expense.id, payload);
    } else if (makeRecurring) {
      addRecurring({ ...payload, startDate: payload.date, frequency: 'monthly' });
    } else {
      addExpense(payload);
    }
    onClose();
  }

  const hasGroups = (data.categoryGroups?.length ?? 0) > 0;
  const heading = isRecurringEdit
    ? 'Izmeni ponavljajući trošak'
    : isEdit ? 'Izmeni trošak' : 'Novi trošak';

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && requestClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={fieldId('heading')} ref={dialogRef}>
        <div className="modal__header">
          <span className="modal__title" id={fieldId('heading')}>{heading}</span>
          <button type="button" className="modal__close" onClick={requestClose} aria-label="Zatvori">✕</button>
        </div>

        {/* noValidate: the fields carry constraints (type=date, min=0) but the messages
            below each input are ours, so the browser must not preempt them. */}
        <form className="modal__form" onSubmit={handleSubmit} noValidate>
          <div className="modal__body">
            <div className="form-group">
              <label className="form-label" htmlFor={fieldId('title')}>Naziv / opis</label>
              <input
                id={fieldId('title')}
                className={`form-input ${errors.title ? 'form-input--error' : ''}`}
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                placeholder="npr. Ručak, Gorivo, Netflix..."
                aria-invalid={!!errors.title}
                aria-describedby={errors.title ? errorId('title') : undefined}
                autoFocus
              />
              {errors.title && <span className="form-error" role="alert" id={errorId('title')}>{errors.title}</span>}
            </div>

            <div className="form-row">
              {/* The start date is what the generator counts months from, so it
                  is shown but not editable — see the note in CLAUDE.md. */}
              {isRecurringEdit ? (
                <div className="form-group">
                  <span className="form-label">Počinje od</span>
                  <div className="form-static">
                    {form.date || '—'}
                    <span className="form-static__hint">datum početka se ne menja</span>
                  </div>
                </div>
              ) : (
                <div className="form-group">
                  <label className="form-label" htmlFor={fieldId('date')}>Datum</label>
                  <input
                    id={fieldId('date')}
                    type="date"
                    className={`form-input ${errors.date ? 'form-input--error' : ''}`}
                    value={form.date}
                    onChange={(e) => set('date', e.target.value)}
                    aria-invalid={!!errors.date}
                    aria-describedby={errors.date ? errorId('date') : undefined}
                  />
                  {errors.date && <span className="form-error" role="alert" id={errorId('date')}>{errors.date}</span>}
                </div>
              )}
              <div className="form-group">
                <label className="form-label" htmlFor={fieldId('amount')}>Iznos (RSD)</label>
                <input
                  id={fieldId('amount')}
                  type="number"
                  min="0"
                  className={`form-input ${errors.amount ? 'form-input--error' : ''}`}
                  value={form.amount}
                  onChange={(e) => set('amount', e.target.value)}
                  placeholder="0"
                  aria-invalid={!!errors.amount}
                  aria-describedby={errors.amount ? errorId('amount') : undefined}
                />
                {errors.amount && <span className="form-error" role="alert" id={errorId('amount')}>{errors.amount}</span>}
              </div>
            </div>

            {/* The picker is a button grid, not a control, so the group carries the label. */}
            <div className="form-group" role="group" aria-labelledby={fieldId('category')}>
              <span className="form-label" id={fieldId('category')}>Kategorija</span>
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
                        aria-pressed={active}
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
              {addingCategory ? (
                <div className="cat-add">
                  <label className="cat-add__label" htmlFor={fieldId('newcat')}>Naziv nove kategorije</label>
                  <div className="cat-add__row">
                    <input
                      id={fieldId('newcat')}
                      className={`form-input ${categoryAddError ? 'form-input--error' : ''}`}
                      value={newCategory}
                      onChange={(e) => { setNewCategory(e.target.value); setCategoryAddError(''); }}
                      // Enter must add the category, not submit the expense —
                      // this input sits inside the same <form>.
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitNewCategory(); } }}
                      placeholder="npr. Zdravlje"
                      aria-invalid={!!categoryAddError}
                      aria-describedby={categoryAddError ? errorId('newcat') : undefined}
                      autoFocus
                    />
                    <button type="button" className="btn btn--primary btn--sm" onClick={commitNewCategory}>Dodaj</button>
                    <button type="button" className="btn btn--ghost btn--sm" onClick={closeAddCategory}>Otkaži</button>
                  </div>
                  {categoryAddError && (
                    <span className="form-error" role="alert" id={errorId('newcat')}>{categoryAddError}</span>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  className="cat-add__toggle"
                  ref={addCategoryBtnRef}
                  onClick={() => setAddingCategory(true)}
                >
                  + Nova kategorija
                </button>
              )}
              {errors.category && <span className="form-error" role="alert">{errors.category}</span>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor={fieldId('note')}>Napomena (opciono)</label>
              <textarea
                id={fieldId('note')}
                className="form-textarea"
                value={form.note}
                onChange={(e) => set('note', e.target.value)}
                placeholder="Dodatni detalji..."
              />
            </div>

            {!source && (
              <div className="form-recurring">
                <button
                  type="button"
                  aria-label="Ponavljajući trošak"
                  aria-pressed={makeRecurring}
                  className={`btn-recurring ${makeRecurring ? 'btn-recurring--active' : ''}`}
                  onClick={() => setMakeRecurring((v) => !v)}
                />
                <span className="form-recurring__label">Ponavljajući trošak — automatski svakog meseca</span>
              </div>
            )}
          </div>

          <div className="modal__footer">
            <button type="button" className="btn btn--ghost" onClick={requestClose}>Otkaži</button>
            <button type="submit" className="btn btn--primary" disabled={!form.category}>
              {source ? 'Sačuvaj izmene' : 'Dodaj trošak'}
            </button>
          </div>
        </form>
      </div>

      {confirmingClose && <DiscardConfirm onKeepEditing={cancelClose} onDiscard={onClose} />}
    </div>
  );
}

function DiscardConfirm({ onKeepEditing, onDiscard }) {
  const keepRef = useRef(null);
  useEffect(() => { keepRef.current?.focus(); }, []);

  // restoreFocus is off: cancelling returns focus to the field the user left, and
  // discarding unmounts the form modal, which restores to whatever opened it.
  const confirmRef = useRef(null);
  useFocusTrap(confirmRef, { restoreFocus: false });

  return (
    <div
      className="modal-overlay modal-overlay--stacked"
      onClick={(e) => e.target === e.currentTarget && onKeepEditing()}
    >
      <div className="modal modal--confirm" role="alertdialog" aria-modal="true" aria-labelledby="discard-title" aria-describedby="discard-text" ref={confirmRef}>
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
