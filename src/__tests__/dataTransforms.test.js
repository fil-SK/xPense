import { generateRecurringExpenses, applyBudgetCopy } from '../utils/dataTransforms.js';

// ─── generateRecurringExpenses ────────────────────────────────────────────────

const netflixTemplate = {
  id: 'r1',
  title: 'Netflix',
  amount: 800,
  category: 'Zabava',
  note: '',
  startDate: '2025-01-15',
  frequency: 'monthly',
};

describe('generateRecurringExpenses', () => {
  test('generates one entry per month from startDate through now', () => {
    const now = new Date('2025-03-01');
    const result = generateRecurringExpenses([netflixTemplate], [], now);
    expect(result).toHaveLength(3);
    expect(result.map((e) => e.date)).toEqual(['2025-01-15', '2025-02-15', '2025-03-15']);
  });

  test('skips months where an entry with matching recurringId already exists', () => {
    const existing = [{ id: 'e1', recurringId: 'r1', date: '2025-02-15' }];
    const now = new Date('2025-03-01');
    const result = generateRecurringExpenses([netflixTemplate], existing, now);
    expect(result).toHaveLength(2);
    const dates = result.map((e) => e.date);
    expect(dates).toContain('2025-01-15');
    expect(dates).toContain('2025-03-15');
    expect(dates).not.toContain('2025-02-15');
  });

  test('spans year boundaries correctly', () => {
    const t = { ...netflixTemplate, startDate: '2024-11-10' };
    const now = new Date('2025-02-01');
    const result = generateRecurringExpenses([t], [], now);
    // Nov, Dec 2024 + Jan, Feb 2025 = 4
    expect(result).toHaveLength(4);
    expect(result[0].date).toBe('2024-11-10');
    expect(result[3].date).toBe('2025-02-10');
  });

  test('returns empty array when recurrings is empty', () => {
    expect(generateRecurringExpenses([], [], new Date())).toEqual([]);
  });

  test('generated entries carry correct fields from template', () => {
    const now = new Date('2025-01-01');
    const result = generateRecurringExpenses([netflixTemplate], [], now);
    expect(result[0]).toMatchObject({
      recurringId: 'r1',
      title: 'Netflix',
      amount: 800,
      category: 'Zabava',
      date: '2025-01-15',
    });
  });

  test('uses empty string for note when template note is falsy', () => {
    const t = { ...netflixTemplate, note: undefined };
    const now = new Date('2025-01-01');
    const [entry] = generateRecurringExpenses([t], [], now);
    expect(entry.note).toBe('');
  });

  test('handles multiple templates independently', () => {
    const spotify = { ...netflixTemplate, id: 'r2', title: 'Spotify', startDate: '2025-02-01' };
    const now = new Date('2025-02-28');
    const result = generateRecurringExpenses([netflixTemplate, spotify], [], now);
    expect(result.filter((e) => e.recurringId === 'r1')).toHaveLength(2); // Jan + Feb
    expect(result.filter((e) => e.recurringId === 'r2')).toHaveLength(1); // Feb only
  });

  test('does not generate entries for future months beyond now', () => {
    const now = new Date('2025-01-31');
    const result = generateRecurringExpenses([netflixTemplate], [], now);
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2025-01-15');
  });
});

// ─── applyBudgetCopy ──────────────────────────────────────────────────────────

const baseData = {
  expenses: [],
  categories: ['Hrana'],
  recurrings: [],
  budget: {
    2025: {
      income: {
        plata: [50000, null, null, null, null, null, null, null, null, null, null, null],
        bonus: Array(12).fill(null),
      },
      funds: [
        { id: 'fund-a', name: 'Hrana', amounts: [15000, null, null, null, null, null, null, null, null, null, null, null] },
        { id: 'fund-b', name: 'Transport', amounts: Array(12).fill(null) },
      ],
    },
  },
  trackingMaps: {
    2025: {
      'fund-a': ['Hrana i piće'],
      'fund-b': ['Transport'],
    },
  },
};

describe('applyBudgetCopy', () => {
  test('copies fund names to target year', () => {
    const result = applyBudgetCopy(baseData, 2025, 2026);
    const funds = result.budget[2026].funds;
    expect(funds).toHaveLength(2);
    expect(funds.map((f) => f.name)).toEqual(['Hrana', 'Transport']);
  });

  test('resets all fund amounts to null in target year', () => {
    const result = applyBudgetCopy(baseData, 2025, 2026);
    result.budget[2026].funds.forEach((f) => {
      expect(f.amounts).toEqual(Array(12).fill(null));
    });
  });

  test('new funds get different IDs from source funds', () => {
    const result = applyBudgetCopy(baseData, 2025, 2026);
    const sourceIds = baseData.budget[2025].funds.map((f) => f.id);
    const newIds = result.budget[2026].funds.map((f) => f.id);
    newIds.forEach((id) => expect(sourceIds).not.toContain(id));
  });

  test('copies plata income values, resets bonus to null', () => {
    const result = applyBudgetCopy(baseData, 2025, 2026);
    expect(result.budget[2026].income.plata[0]).toBe(50000);
    expect(result.budget[2026].income.bonus).toEqual(Array(12).fill(null));
  });

  test('remaps trackingMaps to new fund IDs preserving category lists', () => {
    const result = applyBudgetCopy(baseData, 2025, 2026);
    const newIds = result.budget[2026].funds.map((f) => f.id);
    const tracking = result.trackingMaps[2026];
    expect(tracking[newIds[0]]).toEqual(['Hrana i piće']);
    expect(tracking[newIds[1]]).toEqual(['Transport']);
  });

  test('does not mutate source year budget or tracking', () => {
    const result = applyBudgetCopy(baseData, 2025, 2026);
    expect(result.budget[2025]).toEqual(baseData.budget[2025]);
    expect(result.trackingMaps[2025]).toEqual(baseData.trackingMaps[2025]);
  });

  test('returns data unchanged when source year has no budget', () => {
    const result = applyBudgetCopy(baseData, 9999, 2026);
    expect(result).toEqual(baseData);
  });

  test('overwrites existing target year data', () => {
    const dataWithTarget = {
      ...baseData,
      budget: { ...baseData.budget, 2026: { income: { plata: Array(12).fill(99), bonus: Array(12).fill(null) }, funds: [{ id: 'old', name: 'Old', amounts: Array(12).fill(null) }] } },
    };
    const result = applyBudgetCopy(dataWithTarget, 2025, 2026);
    expect(result.budget[2026].funds.map((f) => f.name)).toEqual(['Hrana', 'Transport']);
  });
});
