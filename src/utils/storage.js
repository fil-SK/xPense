import { clampISODate } from './helpers.js';

const KEY = 'expense-tracker-v1';

const DEFAULT_CATEGORIES = [
  'Hrana i piće',
  'Transport',
  'Zabava',
  'Zdravlje',
  'Odjeća i obuća',
  'Stanovanje',
  'Obrazovanje',
  'Sport',
  'Elektronika',
  'Ostalo',
];

export function emptyData() {
  return {
    expenses: [],
    categories: [...DEFAULT_CATEGORIES],
    budget: {},
    actualIncome: {},
    trackingMaps: {},
    recurrings: [],
    monthlyNotes: {},
    savingsGoals: [],
    categoryGroups: [],
  };
}

// Amounts must be numbers by the time they reach the app, because readers add
// them up and `+` on a string concatenates instead: '800' + '200' is '800200',
// not 1000. ExpenseModal already stores Math.round(Number(...)), but records
// written earlier predate that, and both the backup file and the JSON export
// are routinely hand-edited ("za Claude"), so the value arriving here can be
// anything.
//
// Anything not finite becomes 0 rather than NaN. NaN poisons every total it is
// added to and renders as "NaN RSD", so one bad row would make a whole month
// unreadable; 0 keeps the damage local. Import rejects such rows outright
// (sanitizeExpense), but by the time we get here the record is already stored,
// so dropping it would silently lose data the user can still see and fix.
// A field that isn't there is left alone rather than filled with 0. These
// objects always come from JSON.parse, so an absent amount is a genuinely
// incomplete record, and inventing a value would reshape it and hide that
// instead of repairing anything. `null` counts as present-but-unusable.
const needsAmountRepair = (value) =>
  value !== undefined && !(typeof value === 'number' && Number.isFinite(value));

const normalizeAmount = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

// Repairs stored expenses in a single pass:
//  • dates written before recurring generation clamped the day, where a
//    template starting on the 31st produced entries like '2026-02-31' that JS
//    reads as March 3;
//  • amounts that aren't numbers.
// Returns the original object whenever nothing needed fixing, so this is a
// no-op for healthy records.
function repairExpenses(expenses) {
  if (!Array.isArray(expenses)) return [];
  return expenses.map((e) => {
    if (!e || typeof e !== 'object') return e;
    const date = clampISODate(e.date);
    if (date === e.date && !needsAmountRepair(e.amount)) return e;
    const repaired = { ...e, date };
    if (needsAmountRepair(e.amount)) repaired.amount = normalizeAmount(e.amount);
    return repaired;
  });
}

// Recurring templates need the same treatment, and not only for their own
// display: generateRecurringExpenses copies r.amount verbatim into the expenses
// it mints, and those are dispatched straight into state without passing back
// through withDefaults. A string amount on a template would otherwise keep
// producing string-amount expenses on every startup.
function repairRecurrings(recurrings) {
  if (!Array.isArray(recurrings)) return [];
  return recurrings.map((r) => {
    if (!r || typeof r !== 'object' || !needsAmountRepair(r.amount)) return r;
    return { ...r, amount: normalizeAmount(r.amount) };
  });
}

// Single place where a parsed data object is filled out to the full shape.
// Every entry point (localStorage, JSON import, backup-file recovery) goes
// through here, so a new top-level field only needs adding to emptyData().
const asArray = (value, fallback) => (Array.isArray(value) ? value : fallback);
const asObject = (value, fallback) =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : fallback;

export function withDefaults(parsed) {
  const base = emptyData();
  if (!parsed || typeof parsed !== 'object') return base;
  return {
    expenses: repairExpenses(asArray(parsed.expenses, base.expenses)),
    categories: asArray(parsed.categories, base.categories),
    budget: asObject(parsed.budget, base.budget),
    actualIncome: asObject(parsed.actualIncome, base.actualIncome),
    trackingMaps: asObject(parsed.trackingMaps, base.trackingMaps),
    recurrings: repairRecurrings(asArray(parsed.recurrings, base.recurrings)),
    monthlyNotes: asObject(parsed.monthlyNotes, base.monthlyNotes),
    savingsGoals: asArray(parsed.savingsGoals, base.savingsGoals),
    categoryGroups: asArray(parsed.categoryGroups, base.categoryGroups),
  };
}

// Whether localStorage currently holds a saved record. Must be read before the
// first saveData() call of a session, otherwise the answer is always "yes".
export function hasStoredData() {
  try {
    return localStorage.getItem(KEY) !== null;
  } catch {
    return false;
  }
}

export function loadData() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyData();
    return withDefaults(JSON.parse(raw));
  } catch {
    return emptyData();
  }
}

export function saveData(data) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function exportJSON(data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const date = new Date().toISOString().split('T')[0];
  a.download = `troskovi-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function newId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `imp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// Accepts only a well-formed calendar date, repairing an out-of-range day the
// same way stored records are repaired. Returns null when the value can't be
// placed in time at all.
function normalizeDate(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!m) return null;
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1) return null;
  return clampISODate(trimmed);
}

// Coerces one imported expense into a shape the app can render, or returns null
// when the row is unusable. Only a missing date or a non-numeric amount is
// fatal — everything else is filled in, because dropping a whole expense over a
// missing note would lose real data. Exported files are routinely hand-edited
// (the export button is labelled "za Claude"), so malformed rows are expected.
function sanitizeExpense(raw, seenIds) {
  if (!raw || typeof raw !== 'object') return null;

  const date = normalizeDate(raw.date);
  if (!date) return null;

  const amount = Number(raw.amount);
  if (!Number.isFinite(amount)) return null;

  let id = typeof raw.id === 'string' && raw.id ? raw.id : newId();
  while (seenIds.has(id)) id = newId();
  seenIds.add(id);

  const expense = {
    id,
    date,
    amount,
    title: typeof raw.title === 'string' && raw.title.trim() ? raw.title : 'Bez naziva',
    category: typeof raw.category === 'string' && raw.category.trim() ? raw.category : 'Ostalo',
    note: typeof raw.note === 'string' ? raw.note : '',
  };
  if (typeof raw.recurringId === 'string') expense.recurringId = raw.recurringId;
  return expense;
}

// Fills the shape out, then makes every expense safe to render. Returns the
// cleaned data plus how many rows had to be dropped, so the UI can say so
// instead of silently losing them.
//
// Note the rows are judged from `parsed`, not from `base`. Import and load
// deliberately disagree about a broken amount: loading salvages it as 0, since
// the record is already in the app and dropping it would lose data the user can
// still see, whereas import rejects the row and says so, because the user still
// has the file and can fix it. Reading `base.expenses` here would let
// withDefaults' salvage run first and quietly turn every rejection into a 0.
export function validateImportData(parsed) {
  const base = withDefaults(parsed);
  const seenIds = new Set();
  const expenses = [];
  let skipped = 0;

  for (const raw of asArray(parsed?.expenses, [])) {
    const clean = sanitizeExpense(raw, seenIds);
    if (clean) expenses.push(clean);
    else skipped++;
  }

  let categories = base.categories.filter((c) => typeof c === 'string' && c.trim());
  // An import with no usable categories would leave the app unable to add an
  // expense at all, so fall back to the defaults.
  if (categories.length === 0) categories = emptyData().categories;

  return { data: { ...base, expenses, categories }, skipped };
}

export function importJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        if (!Array.isArray(parsed.expenses) || !Array.isArray(parsed.categories)) {
          reject(new Error('Neispravan format fajla.'));
          return;
        }
        resolve(validateImportData(parsed));
      } catch {
        reject(new Error('Neispravan JSON fajl.'));
      }
    };
    reader.onerror = () => reject(new Error('Greška pri čitanju fajla.'));
    reader.readAsText(file);
  });
}

function csvField(val) {
  const s = String(val == null ? '' : val);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

export function buildCSVString(expenses) {
  const header = ['Datum', 'Naziv', 'Iznos', 'Kategorija', 'Napomena', 'Ponavljajuci'];
  const sorted = [...expenses].sort((a, b) => b.date.localeCompare(a.date));
  const rows = sorted.map((e) =>
    [e.date, e.title, e.amount, e.category, e.note || '', e.recurringId ? 'Da' : 'Ne'].map(csvField)
  );
  return [header, ...rows].map((r) => r.join(',')).join('\r\n');
}

export function exportCSV(data) {
  const csv = '﻿' + buildCSVString(data.expenses);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const date = new Date().toISOString().split('T')[0];
  a.download = `troskovi-${date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportBudget(budget, year) {
  const blob = new Blob([JSON.stringify({ budget }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `budget-${year}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importBudget(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        if (!parsed.budget || typeof parsed.budget !== 'object') {
          reject(new Error('Neispravan format fajla budžeta.'));
          return;
        }
        resolve(parsed.budget);
      } catch {
        reject(new Error('Neispravan JSON fajl.'));
      }
    };
    reader.onerror = () => reject(new Error('Greška pri čitanju fajla.'));
    reader.readAsText(file);
  });
}
