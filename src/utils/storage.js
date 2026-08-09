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
    trackingMaps: {},
    recurrings: [],
    monthlyNotes: {},
    savingsGoals: [],
    categoryGroups: [],
  };
}

// Repairs dates written before recurring generation clamped the day, where a
// template starting on the 31st produced entries like '2026-02-31' that JS
// reads as March 3. Untouched for well-formed dates, so this is a no-op for
// every record saved since.
function repairExpenseDates(expenses) {
  if (!Array.isArray(expenses)) return [];
  return expenses.map((e) => {
    const fixed = clampISODate(e?.date);
    return fixed === e?.date ? e : { ...e, date: fixed };
  });
}

// Single place where a parsed data object is filled out to the full shape.
// Every entry point (localStorage, JSON import, backup-file recovery) goes
// through here, so a new top-level field only needs adding to emptyData().
export function withDefaults(parsed) {
  const base = emptyData();
  if (!parsed || typeof parsed !== 'object') return base;
  return {
    expenses: repairExpenseDates(parsed.expenses ?? base.expenses),
    categories: parsed.categories ?? base.categories,
    budget: parsed.budget ?? base.budget,
    trackingMaps: parsed.trackingMaps ?? base.trackingMaps,
    recurrings: parsed.recurrings ?? base.recurrings,
    monthlyNotes: parsed.monthlyNotes ?? base.monthlyNotes,
    savingsGoals: parsed.savingsGoals ?? base.savingsGoals,
    categoryGroups: parsed.categoryGroups ?? base.categoryGroups,
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
        resolve(withDefaults(parsed));
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
