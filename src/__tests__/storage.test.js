import { loadData, saveData, importJSON, importBudget, buildCSVString } from '../utils/storage.js';

const KEY = 'expense-tracker-v1';

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

  test('resolves with parsed data for a valid file', async () => {
    const payload = {
      expenses: [{ id: '1', title: 'Test' }],
      categories: ['Hrana', 'Transport'],
      budget: {},
      trackingMaps: {},
      recurrings: [{ id: 'r1' }],
    };
    const result = await importJSON(makeFile(payload));
    expect(result.expenses).toEqual(payload.expenses);
    expect(result.categories).toEqual(payload.categories);
    expect(result.recurrings).toEqual(payload.recurrings);
  });

  test('backfills missing recurrings with empty array', async () => {
    const result = await importJSON(makeFile({ expenses: [], categories: ['Hrana'] }));
    expect(result.recurrings).toEqual([]);
  });

  test('backfills missing budget and trackingMaps', async () => {
    const result = await importJSON(makeFile({ expenses: [], categories: ['Hrana'] }));
    expect(result.budget).toEqual({});
    expect(result.trackingMaps).toEqual({});
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
