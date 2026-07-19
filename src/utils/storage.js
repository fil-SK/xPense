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

export function loadData() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { expenses: [], categories: [...DEFAULT_CATEGORIES], budget: {}, trackingMaps: {} };
    const parsed = JSON.parse(raw);
    return {
      expenses: parsed.expenses ?? [],
      categories: parsed.categories ?? [...DEFAULT_CATEGORIES],
      budget: parsed.budget ?? {},
      trackingMaps: parsed.trackingMaps ?? {},
      recurrings: parsed.recurrings ?? [],
    };
  } catch {
    return { expenses: [], categories: [...DEFAULT_CATEGORIES], budget: {}, trackingMaps: {}, recurrings: [] };
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
        resolve({
          expenses: parsed.expenses,
          categories: parsed.categories,
          budget: parsed.budget ?? {},
          trackingMaps: parsed.trackingMaps ?? {},
          recurrings: parsed.recurrings ?? [],
        });
      } catch {
        reject(new Error('Neispravan JSON fajl.'));
      }
    };
    reader.onerror = () => reject(new Error('Greška pri čitanju fajla.'));
    reader.readAsText(file);
  });
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
