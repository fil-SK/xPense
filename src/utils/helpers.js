export const MONTHS_SR = [
  'Januar', 'Februar', 'Mart', 'April', 'Maj', 'Jun',
  'Jul', 'Avgust', 'Septembar', 'Oktobar', 'Novembar', 'Decembar',
];

export const MONTHS_SR_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun',
  'Jul', 'Avg', 'Sep', 'Okt', 'Nov', 'Dec',
];

export function getMonthName(month) {
  return MONTHS_SR[month];
}

export function formatAmount(amount) {
  return new Intl.NumberFormat('sr-RS').format(Math.round(amount)) + ' RSD';
}

export function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('sr-RS', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function todayISO() {
  return new Date().toISOString().split('T')[0];
}

export function lastDayOfMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

// Builds a YYYY-MM-DD string, clamping the day to the month's real length.
// Without the clamp, day 31 in February produces '2026-02-31', which JS parses
// as March 3 — the expense then shows up in the wrong month.
export function isoDate(year, month, day) {
  const clamped = Math.min(day, lastDayOfMonth(year, month));
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(clamped).padStart(2, '0')}`;
}

// Repairs an out-of-range date string in place ('2026-02-31' → '2026-02-28').
// Anything that isn't a well-formed YYYY-MM-DD is returned untouched.
export function clampISODate(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr ?? '');
  if (!m) return dateStr;
  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  const day = Number(m[3]);
  if (month < 0 || month > 11 || day < 1) return dateStr;
  return isoDate(year, month, day);
}

export function getExpensesForMonth(expenses, year, month) {
  return expenses.filter((e) => {
    const d = new Date(e.date + 'T00:00:00');
    return d.getFullYear() === year && d.getMonth() === month;
  });
}

export function getTotalAmount(expenses) {
  return expenses.reduce((sum, e) => sum + Number(e.amount), 0);
}

export function getByCategory(expenses) {
  const map = {};
  expenses.forEach((e) => {
    map[e.category] = (map[e.category] ?? 0) + Number(e.amount);
  });
  return map;
}

export function getAvailableMonths(expenses) {
  const map = {};
  expenses.forEach((e) => {
    const d = new Date(e.date + 'T00:00:00');
    const y = d.getFullYear();
    const m = d.getMonth();
    if (!map[y]) map[y] = new Set();
    map[y].add(m);
  });
  const result = {};
  Object.entries(map).forEach(([y, months]) => {
    result[Number(y)] = Array.from(months).sort((a, b) => b - a);
  });
  return result;
}

export const CHART_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6', '#a855f7', '#84cc16',
];

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

// The one source of truth for "what color is this category?". Every list, pill,
// dot and chart slice must go through here, or the same category ends up drawn
// in different colors in different places.
//
// Position in `categories` drives the color, so a category keeps its color as
// the list grows. Names that are no longer in the list (archived, or arriving
// from an import) fall back to a hash so they stay distinct and stable instead
// of all collapsing onto the first color.
export function categoryColor(category, categories = []) {
  const idx = categories.indexOf(category);
  const slot = idx >= 0 ? idx : hashString(String(category ?? ''));
  return CHART_COLORS[slot % CHART_COLORS.length];
}
