import {
  loadData, saveData, importJSON, importBudget, buildCSVString,
  hasStoredData, withDefaults, validateImportData,
} from '../utils/storage.js';

const KEY = 'expense-tracker-v1';

describe('hasStoredData', () => {
  test('is false when localStorage holds no record', () => {
    expect(hasStoredData()).toBe(false);
  });

  test('is true once data has been saved', () => {
    saveData(loadData());
    expect(hasStoredData()).toBe(true);
  });

  test('loadData alone does not create a record', () => {
    loadData();
    expect(hasStoredData()).toBe(false);
  });
});

describe('withDefaults', () => {
  test('fills every top-level field for an empty object', () => {
    const filled = withDefaults({});
    expect(filled.expenses).toEqual([]);
    expect(filled.budget).toEqual({});
    expect(filled.trackingMaps).toEqual({});
    expect(filled.recurrings).toEqual([]);
    expect(filled.monthlyNotes).toEqual({});
    expect(filled.savingsGoals).toEqual([]);
    expect(filled.categoryGroups).toEqual([]);
    expect(filled.categories.length).toBeGreaterThan(0);
  });

  test('keeps provided values', () => {
    const expenses = [{ id: '1', title: 'X', date: '2025-01-01', amount: 5, category: 'Hrana' }];
    expect(withDefaults({ expenses, categories: ['Hrana'] })).toMatchObject({
      expenses,
      categories: ['Hrana'],
    });
  });

  test('returns defaults for null or non-object input', () => {
    expect(withDefaults(null).expenses).toEqual([]);
    expect(withDefaults('nope').expenses).toEqual([]);
  });

  test('repairs out-of-range expense dates written by the old generator', () => {
    const parsed = {
      expenses: [
        { id: '1', title: 'Netflix', date: '2026-02-31', amount: 800, category: 'Zabava' },
        { id: '2', title: 'Kirija', date: '2025-04-31', amount: 40000, category: 'Stanovanje' },
      ],
    };
    expect(withDefaults(parsed).expenses.map((e) => e.date)).toEqual(['2026-02-28', '2025-04-30']);
  });

  test('leaves well-formed expenses alone', () => {
    const expense = { id: '1', title: 'Ručak', date: '2025-01-15', amount: 900, category: 'Hrana' };
    const [result] = withDefaults({ expenses: [expense] }).expenses;
    expect(result).toBe(expense); // same object — no needless copy
  });

  // Amounts are normalized here so no reader has to coerce: `+` on a string
  // concatenates, which turned per-fund spend in BudgetPanel into nonsense.
  test('coerces string expense amounts to numbers', () => {
    const parsed = {
      expenses: [
        { id: '1', title: 'A', date: '2025-01-01', amount: '800', category: 'Hrana' },
        { id: '2', title: 'B', date: '2025-01-02', amount: '1200.50', category: 'Hrana' },
      ],
    };
    const amounts = withDefaults(parsed).expenses.map((e) => e.amount);
    expect(amounts).toEqual([800, 1200.5]);
    amounts.forEach((a) => expect(typeof a).toBe('number'));
  });

  test('normalized amounts add up instead of concatenating', () => {
    const parsed = {
      expenses: [
        { id: '1', title: 'A', date: '2025-01-01', amount: '800', category: 'Hrana' },
        { id: '2', title: 'B', date: '2025-01-02', amount: '200', category: 'Hrana' },
      ],
    };
    const total = withDefaults(parsed).expenses.reduce((s, e) => s + e.amount, 0);
    expect(total).toBe(1000); // raw '+' on the strings would give '0800200'
  });

  test('turns an unusable amount into 0 rather than NaN', () => {
    // NaN would spread into every total the row touches and render "NaN RSD".
    const parsed = {
      expenses: [
        { id: '1', title: 'A', date: '2025-01-01', amount: 'abc', category: 'Hrana' },
        { id: '2', title: 'B', date: '2025-01-02', amount: null, category: 'Hrana' },
        { id: '3', title: 'C', date: '2025-01-03', amount: '', category: 'Hrana' },
        { id: '4', title: 'D', date: '2025-01-04', amount: 500, category: 'Hrana' },
      ],
    };
    const expenses = withDefaults(parsed).expenses;
    expect(expenses.map((e) => e.amount)).toEqual([0, 0, 0, 500]);
    expect(expenses.reduce((s, e) => s + e.amount, 0)).toBe(500);
  });

  // Repairing a present value is the job; fabricating an absent one is not.
  // These objects come from JSON.parse, so a missing amount is an incomplete
  // record, and adding 0 would reshape it and mask that.
  test('leaves a record with no amount field untouched', () => {
    const expense = { id: '1', title: 'A', date: '2025-01-01', category: 'Hrana' };
    const template = { id: 'r1', title: 'Netflix', startDate: '2025-01-15' };
    const result = withDefaults({ expenses: [expense], recurrings: [template] });
    expect(result.expenses[0]).toBe(expense);
    expect(result.recurrings[0]).toBe(template);
    expect('amount' in result.expenses[0]).toBe(false);
  });

  test('repairs date and amount together in one pass', () => {
    const parsed = {
      expenses: [{ id: '1', title: 'A', date: '2026-02-31', amount: '800', category: 'Hrana' }],
    };
    expect(withDefaults(parsed).expenses[0]).toMatchObject({ date: '2026-02-28', amount: 800 });
  });

  // Generated expenses copy r.amount verbatim, so a string here would keep
  // minting string-amount expenses on every startup.
  test('coerces recurring template amounts', () => {
    const parsed = {
      recurrings: [{ id: 'r1', title: 'Netflix', amount: '800', startDate: '2025-01-15' }],
    };
    expect(withDefaults(parsed).recurrings[0].amount).toBe(800);
  });

  test('leaves a well-formed recurring template alone', () => {
    const template = { id: 'r1', title: 'Netflix', amount: 800, startDate: '2025-01-15' };
    expect(withDefaults({ recurrings: [template] }).recurrings[0]).toBe(template);
  });

  test('survives a null entry in either array', () => {
    const parsed = { expenses: [null], recurrings: [null] };
    expect(() => withDefaults(parsed)).not.toThrow();
    expect(withDefaults(parsed).expenses).toEqual([null]);
    expect(withDefaults(parsed).recurrings).toEqual([null]);
  });
});

describe('loadData', () => {
  test('returns defaults when localStorage is empty', () => {
    const data = loadData();
    expect(data.expenses).toEqual([]);
    expect(data.recurrings).toEqual([]);
    expect(data.monthlyNotes).toEqual({});
    expect(data.savingsGoals).toEqual([]);
    expect(Array.isArray(data.categories)).toBe(true);
    expect(data.categories.length).toBeGreaterThan(0);
    expect(data.budget).toEqual({});
    expect(data.trackingMaps).toEqual({});
  });

  test('returns parsed data from localStorage', () => {
    const stored = {
      expenses: [{ id: '1', title: 'Test', date: '2025-01-01', amount: 100, category: 'Hrana' }],
      categories: ['Hrana', 'Transport'],
      budget: {},
      trackingMaps: {},
      recurrings: [],
      monthlyNotes: { 2025: { 2: 'Skupo zbog auta' } },
      savingsGoals: [{ id: 'g1', name: 'Odmor', target: 100000, fundId: null, year: null }],
      categoryGroups: [],
    };
    localStorage.setItem(KEY, JSON.stringify(stored));
    expect(loadData()).toEqual(stored);
  });

  test('backfills missing recurrings field from older saved data', () => {
    const stored = { expenses: [], categories: ['Hrana'], budget: {}, trackingMaps: {} };
    localStorage.setItem(KEY, JSON.stringify(stored));
    expect(loadData().recurrings).toEqual([]);
  });

  test('backfills missing monthlyNotes from older saved data', () => {
    const stored = { expenses: [], categories: ['Hrana'], budget: {}, trackingMaps: {}, recurrings: [] };
    localStorage.setItem(KEY, JSON.stringify(stored));
    expect(loadData().monthlyNotes).toEqual({});
  });

  test('backfills missing savingsGoals from older saved data', () => {
    const stored = { expenses: [], categories: ['Hrana'], budget: {}, trackingMaps: {}, recurrings: [] };
    localStorage.setItem(KEY, JSON.stringify(stored));
    expect(loadData().savingsGoals).toEqual([]);
  });

  test('returns defaults when JSON is corrupted', () => {
    localStorage.setItem(KEY, 'not valid json!!');
    const data = loadData();
    expect(data.expenses).toEqual([]);
    expect(data.recurrings).toEqual([]);
  });
});

describe('saveData / loadData roundtrip', () => {
  test('saves and reloads correctly', () => {
    const data = {
      expenses: [{ id: '1', title: 'Test', date: '2025-01-01', amount: 500, category: 'Hrana', note: '' }],
      categories: ['Hrana'],
      budget: {
        2025: {
          income: { plata: Array(12).fill(null), bonus: Array(12).fill(null) },
          funds: [],
        },
      },
      trackingMaps: {},
      recurrings: [{ id: 'r1', title: 'Netflix', amount: 800, category: 'Zabava', startDate: '2025-01-01', frequency: 'monthly' }],
      monthlyNotes: { 2025: { 2: 'Auto servis' } },
      savingsGoals: [{ id: 'g1', name: 'Odmor', target: 50000, fundId: null, year: null }],
      categoryGroups: [],
    };
    saveData(data);
    expect(loadData()).toEqual(data);
  });
});

describe('importJSON', () => {
  function makeFile(obj) {
    return new File([JSON.stringify(obj)], 'test.json', { type: 'application/json' });
  }

  const validExpense = {
    id: '1', title: 'Test', date: '2025-01-15', amount: 900, category: 'Hrana', note: '',
  };

  test('resolves with cleaned data and a skipped count for a valid file', async () => {
    const payload = {
      expenses: [validExpense],
      categories: ['Hrana', 'Transport'],
      budget: {},
      trackingMaps: {},
      recurrings: [{ id: 'r1' }],
    };
    const { data, skipped } = await importJSON(makeFile(payload));
    expect(skipped).toBe(0);
    expect(data.expenses).toEqual([validExpense]);
    expect(data.categories).toEqual(payload.categories);
    expect(data.recurrings).toEqual(payload.recurrings);
  });

  test('backfills missing recurrings with empty array', async () => {
    const { data } = await importJSON(makeFile({ expenses: [], categories: ['Hrana'] }));
    expect(data.recurrings).toEqual([]);
  });

  test('backfills missing budget and trackingMaps', async () => {
    const { data } = await importJSON(makeFile({ expenses: [], categories: ['Hrana'] }));
    expect(data.budget).toEqual({});
    expect(data.trackingMaps).toEqual({});
  });

  test('rejects when required fields are missing', async () => {
    await expect(importJSON(makeFile({ foo: 'bar' }))).rejects.toThrow();
  });

  test('rejects when expenses is not an array', async () => {
    await expect(importJSON(makeFile({ expenses: 'bad', categories: [] }))).rejects.toThrow();
  });

  test('rejects on invalid JSON', async () => {
    const file = new File(['not json'], 'test.json');
    await expect(importJSON(file)).rejects.toThrow();
  });

  test('drops unusable rows and reports how many', async () => {
    const payload = {
      categories: ['Hrana'],
      expenses: [
        validExpense,
        { id: '2', title: 'Bez datuma', amount: 500, category: 'Hrana' },
        { id: '3', title: 'Bez iznosa', date: '2025-02-01', category: 'Hrana' },
      ],
    };
    const { data, skipped } = await importJSON(makeFile(payload));
    expect(skipped).toBe(2);
    expect(data.expenses).toHaveLength(1);
  });
});

describe('validateImportData', () => {
  const valid = { id: '1', title: 'Ručak', date: '2025-01-15', amount: 900, category: 'Hrana', note: '' };

  test('keeps a well-formed expense untouched', () => {
    const { data, skipped } = validateImportData({ expenses: [valid], categories: ['Hrana'] });
    expect(skipped).toBe(0);
    expect(data.expenses[0]).toEqual(valid);
  });

  test.each([
    ['a missing date', { id: 'x', title: 'X', amount: 5, category: 'Hrana' }],
    ['a malformed date', { id: 'x', title: 'X', date: '15.01.2025', amount: 5 }],
    ['an impossible month', { id: 'x', title: 'X', date: '2025-13-01', amount: 5 }],
    ['a non-numeric amount', { id: 'x', title: 'X', date: '2025-01-01', amount: 'puno' }],
    ['a missing amount', { id: 'x', title: 'X', date: '2025-01-01' }],
    ['a non-object row', 'not an expense'],
    ['a null row', null],
  ])('drops a row with %s', (_label, row) => {
    const { data, skipped } = validateImportData({ expenses: [row], categories: ['Hrana'] });
    expect(data.expenses).toEqual([]);
    expect(skipped).toBe(1);
  });

  test('fills a missing title and category rather than dropping the row', () => {
    const { data, skipped } = validateImportData({
      expenses: [{ id: 'x', date: '2025-01-01', amount: 500 }],
      categories: ['Hrana'],
    });
    expect(skipped).toBe(0);
    expect(data.expenses[0]).toMatchObject({ title: 'Bez naziva', category: 'Ostalo', note: '' });
  });

  test('repairs an out-of-range day instead of dropping the row', () => {
    const { data } = validateImportData({
      expenses: [{ id: 'x', title: 'Kirija', date: '2026-02-31', amount: 40000 }],
      categories: ['Hrana'],
    });
    expect(data.expenses[0].date).toBe('2026-02-28');
  });

  test('coerces a numeric string amount', () => {
    const { data } = validateImportData({
      expenses: [{ id: 'x', title: 'X', date: '2025-01-01', amount: '1500' }],
      categories: ['Hrana'],
    });
    expect(data.expenses[0].amount).toBe(1500);
  });

  test('gives rows without an id a generated one', () => {
    const { data } = validateImportData({
      expenses: [{ title: 'X', date: '2025-01-01', amount: 5 }],
      categories: ['Hrana'],
    });
    expect(typeof data.expenses[0].id).toBe('string');
    expect(data.expenses[0].id.length).toBeGreaterThan(0);
  });

  test('de-duplicates repeated ids so React keys stay unique', () => {
    const { data } = validateImportData({
      expenses: [
        { id: 'same', title: 'A', date: '2025-01-01', amount: 5 },
        { id: 'same', title: 'B', date: '2025-01-02', amount: 6 },
      ],
      categories: ['Hrana'],
    });
    expect(data.expenses).toHaveLength(2);
    expect(data.expenses[0].id).not.toBe(data.expenses[1].id);
  });

  test('preserves recurringId when present', () => {
    const { data } = validateImportData({
      expenses: [{ id: 'x', title: 'Netflix', date: '2025-01-01', amount: 800, recurringId: 'r1' }],
      categories: ['Hrana'],
    });
    expect(data.expenses[0].recurringId).toBe('r1');
  });

  test('drops non-string categories', () => {
    const { data } = validateImportData({ expenses: [], categories: ['Hrana', 42, null, '  '] });
    expect(data.categories).toEqual(['Hrana']);
  });

  test('falls back to default categories when none survive', () => {
    const { data } = validateImportData({ expenses: [], categories: [null, 7] });
    expect(data.categories.length).toBeGreaterThan(0);
    expect(data.categories.every((c) => typeof c === 'string')).toBe(true);
  });

  test('replaces wrong-typed top-level fields with defaults', () => {
    const { data } = validateImportData({
      expenses: [], categories: ['Hrana'], budget: 'nope', savingsGoals: 'nope', monthlyNotes: [],
    });
    expect(data.budget).toEqual({});
    expect(data.savingsGoals).toEqual([]);
    expect(data.monthlyNotes).toEqual({});
  });
});

describe('importBudget', () => {
  function makeFile(obj) {
    return new File([JSON.stringify(obj)], 'budget.json', { type: 'application/json' });
  }

  test('resolves with the budget object for a valid file', async () => {
    const payload = {
      budget: {
        2025: { income: { plata: Array(12).fill(null), bonus: Array(12).fill(null) }, funds: [] },
      },
    };
    const result = await importBudget(makeFile(payload));
    expect(result[2025]).toBeDefined();
    expect(result[2025].funds).toEqual([]);
  });

  test('rejects when budget field is missing', async () => {
    await expect(importBudget(makeFile({ foo: 'bar' }))).rejects.toThrow();
  });

  test('rejects when budget is not an object', async () => {
    await expect(importBudget(makeFile({ budget: 'wrong' }))).rejects.toThrow();
  });

  test('rejects on invalid JSON', async () => {
    const file = new File(['invalid'], 'budget.json');
    await expect(importBudget(file)).rejects.toThrow();
  });
});

describe('buildCSVString', () => {
  test('produces header row with correct columns', () => {
    const result = buildCSVString([]);
    expect(result).toMatch(/^Datum,Naziv,Iznos,Kategorija,Napomena,Ponavljajuci/);
  });

  test('includes one data row per expense', () => {
    const expenses = [
      { id: '1', date: '2025-03-05', title: 'Kafa', amount: 350, category: 'Hrana', note: '' },
    ];
    const lines = buildCSVString(expenses).split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('2025-03-05');
    expect(lines[1]).toContain('Kafa');
    expect(lines[1]).toContain('350');
  });

  test('sorts rows by date descending', () => {
    const expenses = [
      { id: '1', date: '2025-01-01', title: 'A', amount: 100, category: 'Hrana', note: '' },
      { id: '2', date: '2025-03-01', title: 'B', amount: 200, category: 'Transport', note: '' },
    ];
    const lines = buildCSVString(expenses).split('\r\n');
    expect(lines[1]).toContain('B');
    expect(lines[2]).toContain('A');
  });

  test('marks recurring expenses with Da', () => {
    const expenses = [
      { id: '1', date: '2025-01-01', title: 'Netflix', amount: 800, category: 'Zabava', note: '', recurringId: 'r1' },
    ];
    expect(buildCSVString(expenses)).toMatch(/Da$/m);
  });

  test('marks non-recurring expenses with Ne', () => {
    const expenses = [
      { id: '1', date: '2025-01-01', title: 'Kafa', amount: 300, category: 'Hrana', note: '' },
    ];
    expect(buildCSVString(expenses)).toMatch(/Ne$/m);
  });

  test('quotes fields that contain commas', () => {
    const expenses = [
      { id: '1', date: '2025-01-01', title: 'Hrana, piće', amount: 500, category: 'Hrana', note: '' },
    ];
    expect(buildCSVString(expenses)).toContain('"Hrana, piće"');
  });

  test('escapes double-quotes within fields', () => {
    const expenses = [
      { id: '1', date: '2025-01-01', title: 'On "sale"', amount: 200, category: 'Hrana', note: '' },
    ];
    expect(buildCSVString(expenses)).toContain('"On ""sale"""');
  });

  test('includes note field', () => {
    const expenses = [
      { id: '1', date: '2025-01-01', title: 'Test', amount: 100, category: 'Hrana', note: 'test napomena' },
    ];
    expect(buildCSVString(expenses)).toContain('test napomena');
  });
});
