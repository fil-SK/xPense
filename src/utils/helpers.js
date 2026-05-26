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
