import {
  formatAmount, formatDate, todayISO,
  getExpensesForMonth, getTotalAmount, getByCategory, getAvailableMonths,
  lastDayOfMonth, isoDate, clampISODate, categoryColor, CHART_COLORS,
} from '../utils/helpers.js';

describe('categoryColor', () => {
  const categories = ['Hrana', 'Transport', 'Zabava'];

  test('assigns colors by position in the category list', () => {
    expect(categoryColor('Hrana', categories)).toBe(CHART_COLORS[0]);
    expect(categoryColor('Transport', categories)).toBe(CHART_COLORS[1]);
    expect(categoryColor('Zabava', categories)).toBe(CHART_COLORS[2]);
  });

  test('a category keeps its color when the list grows', () => {
    const before = categoryColor('Transport', categories);
    expect(categoryColor('Transport', [...categories, 'Sport', 'Zdravlje'])).toBe(before);
  });

  test('wraps around when there are more categories than colors', () => {
    const many = Array.from({ length: CHART_COLORS.length + 2 }, (_, i) => `Kat${i}`);
    expect(categoryColor(`Kat${CHART_COLORS.length}`, many)).toBe(CHART_COLORS[0]);
  });

  // The bug this function exists to prevent: the pie chart used to color slices
  // by their sorted position, so a category was one color in the chart and a
  // different one in the list beside it.
  test('does not depend on the order the category is encountered', () => {
    const sortedBySpend = ['Zabava', 'Hrana', 'Transport'];
    sortedBySpend.forEach((name) => {
      expect(categoryColor(name, categories)).toBe(CHART_COLORS[categories.indexOf(name)]);
    });
  });

  test('unknown categories get a stable color instead of always the first', () => {
    const archived = categoryColor('Arhivirana', categories);
    expect(archived).toBe(categoryColor('Arhivirana', categories));
    expect(CHART_COLORS).toContain(archived);
  });

  test('different unknown categories can differ from each other', () => {
    const names = ['Alfa', 'Beta', 'Gama', 'Delta', 'Epsilon'];
    const colors = new Set(names.map((n) => categoryColor(n, categories)));
    expect(colors.size).toBeGreaterThan(1);
  });

  test('tolerates a missing category list and empty names', () => {
    expect(CHART_COLORS).toContain(categoryColor('Hrana'));
    expect(CHART_COLORS).toContain(categoryColor(undefined, categories));
    expect(CHART_COLORS).toContain(categoryColor('', categories));
  });
});

describe('lastDayOfMonth', () => {
  test.each([
    [2025, 0, 31],  // Januar
    [2025, 1, 28],  // Februar, non-leap
    [2024, 1, 29],  // Februar, leap
    [2000, 1, 29],  // Februar, century leap
    [1900, 1, 28],  // Februar, century non-leap
    [2025, 3, 30],  // April
    [2025, 11, 31], // Decembar
  ])('%i-%i has %i days', (year, month, expected) => {
    expect(lastDayOfMonth(year, month)).toBe(expected);
  });
});

describe('isoDate', () => {
  test('formats a valid day unchanged', () => {
    expect(isoDate(2025, 0, 15)).toBe('2025-01-15');
  });

  test('pads single-digit month and day', () => {
    expect(isoDate(2025, 8, 5)).toBe('2025-09-05');
  });

  test('clamps day 31 to the end of a short month', () => {
    expect(isoDate(2025, 1, 31)).toBe('2025-02-28');
    expect(isoDate(2024, 1, 31)).toBe('2024-02-29');
    expect(isoDate(2025, 3, 31)).toBe('2025-04-30');
  });

  test('produces a string that parses back to the same month', () => {
    const str = isoDate(2026, 1, 31);
    const parsed = new Date(str + 'T00:00:00');
    expect(parsed.getMonth()).toBe(1);
    expect(parsed.getFullYear()).toBe(2026);
  });
});

describe('clampISODate', () => {
  test('repairs an out-of-range day', () => {
    expect(clampISODate('2026-02-31')).toBe('2026-02-28');
    expect(clampISODate('2025-04-31')).toBe('2025-04-30');
  });

  test('leaves a valid date untouched', () => {
    expect(clampISODate('2025-01-15')).toBe('2025-01-15');
    expect(clampISODate('2024-02-29')).toBe('2024-02-29');
  });

  test('passes through anything that is not a YYYY-MM-DD string', () => {
    expect(clampISODate('')).toBe('');
    expect(clampISODate(undefined)).toBe(undefined);
    expect(clampISODate(null)).toBe(null);
    expect(clampISODate('15.01.2025')).toBe('15.01.2025');
    expect(clampISODate('2025-13-01')).toBe('2025-13-01');
  });
});

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
