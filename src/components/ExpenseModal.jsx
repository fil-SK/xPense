import { useState, useEffect } from 'react';
import { todayISO, CHART_COLORS } from '../utils/helpers.js';
import { useApp } from '../App.jsx';

export default function ExpenseModal({ expense, defaultDate, onClose }) {
  const { data, addExpense, updateExpense } = useApp();
  const isEdit = !!expense;

  const [form, setForm] = useState(
    isEdit
      ? { title: expense.title, date: expense.date, amount: String(expense.amount), category: expense.category, note: expense.note ?? '' }
      : { title: '', date: defaultDate ?? todayISO(), amount: '', category: data.categories[0] ?? '', note: '' }
  );
  const [errors, setErrors] = useState({});

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
    if (isEdit) updateExpense(expense.id, payload);
    else addExpense(payload);
    onClose();
  }

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

        <div className="modal__footer">
          <button className="btn btn--ghost" onClick={onClose}>Otkaži</button>
          <button className="btn btn--primary" onClick={handleSubmit}>
            {isEdit ? 'Sačuvaj izmene' : 'Dodaj trošak'}
          </button>
        </div>
      </div>
    </div>
  );
}
