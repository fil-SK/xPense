import {
  formatAmount, formatDate, todayISO,
  getExpensesForMonth, getTotalAmount, getByCategory, getAvailableMonths,
} from '../utils/helpers.js';

describe('formatAmount', () => {
  test('appends RSD and rounds', () => {
    expect(formatAmount(1234)).toMatch(/1[.,]?234.*RSD/);
    expect(formatAmount(0)).toMatch(/0.*RSD/);
  });

  test('rounds fractional amounts', () => {
    expect(formatAmount(99.9)).toMatch(/100.*RSD/);
    expect(formatAmount(99.4)).toMatch(/99.*RSD/);
  });
});

describe('formatDate', () => {
  test('formats ISO date and contains day, month, year', () => {
    const result = formatDate('2025-03-15');
    expect(result).toMatch(/15/);
    expect(result).toMatch(/3|03/);
    expect(result).toMatch(/2025/);
  });
});

describe('todayISO', () => {
  test('returns YYYY-MM-DD', () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('getExpensesForMonth', () => {
  const expenses = [
    { id: '1', date: '2025-03-05', amount: 100 },
    { id: '2', date: '2025-03-20', amount: 200 },
    { id: '3', date: '2025-04-01', amount: 300 },
    { id: '4', date: '2024-03-10', amount: 400 },
  ];

  test('returns expenses for given year and month', () => {
    const result = getExpensesForMonth(expenses, 2025, 2); // March = index 2
    expect(result).toHaveLength(2);
    expect(result.map((e) => e.id)).toEqual(['1', '2']);
  });

  test('returns empty array when no expenses match', () => {
    expect(getExpensesForMonth(expenses, 2023, 0)).toHaveLength(0);
  });

  test('does not include adjacent months', () => {
    expect(getExpensesForMonth(expenses, 2025, 3)).toHaveLength(1); // April only
  });

  test('differentiates same month across years', () => {
    expect(getExpensesForMonth(expenses, 2024, 2)).toHaveLength(1);
    expect(getExpensesForMonth(expenses, 2025, 2)).toHaveLength(2);
  });
});

describe('getTotalAmount', () => {
  test('sums all amounts', () => {
    expect(getTotalAmount([{ amount: 100 }, { amount: 200 }, { amount: 50 }])).toBe(350);
  });

  test('coerces string amounts', () => {
    expect(getTotalAmount([{ amount: '100' }, { amount: '200' }])).toBe(300);
  });

  test('returns 0 for empty array', () => {
    expect(getTotalAmount([])).toBe(0);
  });
});

describe('getByCategory', () => {
  test('groups and sums amounts by category', () => {
    const expenses = [
      { category: 'Hrana', amount: 100 },
      { category: 'Hrana', amount: 50 },
      { category: 'Transport', amount: 200 },
    ];
    expect(getByCategory(expenses)).toEqual({ Hrana: 150, Transport: 200 });
  });

  test('returns empty object for no expenses', () => {
    expect(getByCategory([])).toEqual({});
  });

  test('handles single category', () => {
    expect(getByCategory([{ category: 'Hrana', amount: 500 }])).toEqual({ Hrana: 500 });
  });
});

describe('getAvailableMonths', () => {
  test('returns months per year sorted descending', () => {
    const expenses = [
      { date: '2025-03-01' },
      { date: '2025-01-15' },
      { date: '2024-12-01' },
    ];
    const result = getAvailableMonths(expenses);
    expect(result[2025]).toEqual([2, 0]); // March (2) before Jan (0)
    expect(result[2024]).toEqual([11]);
  });

  test('returns empty object for no expenses', () => {
    expect(getAvailableMonths([])).toEqual({});
  });

  test('deduplicates months', () => {
    const expenses = [
      { date: '2025-03-01' },
      { date: '2025-03-15' },
    ];
    expect(getAvailableMonths(expenses)[2025]).toEqual([2]);
  });
});
