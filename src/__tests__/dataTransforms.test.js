import {
  generateRecurringExpenses, applyBudgetCopy, isEmptyData, applyExpenseDeletion,
  elapsedMonths, goalProgress,
} from '../utils/dataTransforms.js';

// ─── isEmptyData ──────────────────────────────────────────────────────────────

describe('isEmptyData', () => {
  const blank = {
    expenses: [], categories: ['Hrana'], budget: {}, trackingMaps: {},
    recurrings: [], monthlyNotes: {}, savingsGoals: [], categoryGroups: [],
  };

  test('a freshly loaded default record counts as empty', () => {
    expect(isEmptyData(blank)).toBe(true);
  });

  test('null or undefined counts as empty', () => {
    expect(isEmptyData(null)).toBe(true);
    expect(isEmptyData(undefined)).toBe(true);
  });

  test('default categories alone do not count as content', () => {
    expect(isEmptyData({ ...blank, categories: ['Hrana', 'Transport', 'Zabava'] })).toBe(true);
  });

  test.each([
    ['expenses', { expenses: [{ id: '1', amount: 1, date: '2025-01-01', title: 'X', category: 'Hrana' }] }],
    ['budget', { budget: { 2025: { income: {}, funds: [] } } }],
    ['recurrings', { recurrings: [{ id: 'r1' }] }],
    ['savingsGoals', { savingsGoals: [{ id: 'g1' }] }],
    ['monthlyNotes', { monthlyNotes: { 2025: { 0: 'beleska' } } }],
    ['categoryGroups', { categoryGroups: [{ id: 'g', name: 'Režije', categories: [] }] }],
  ])('%s makes it non-empty', (_label, patch) => {
    expect(isEmptyData({ ...blank, ...patch })).toBe(false);
  });
});

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

  test('clamps the day to months shorter than the start day', () => {
    const t = { ...netflixTemplate, startDate: '2025-01-31' };
    const now = new Date('2025-04-30');
    const result = generateRecurringExpenses([t], [], now);
    expect(result.map((e) => e.date)).toEqual([
      '2025-01-31', '2025-02-28', '2025-03-31', '2025-04-30',
    ]);
  });

  test('clamps to February 29 in a leap year', () => {
    const t = { ...netflixTemplate, startDate: '2024-01-30' };
    const now = new Date('2024-02-29');
    const result = generateRecurringExpenses([t], [], now);
    expect(result.map((e) => e.date)).toEqual(['2024-01-30', '2024-02-29']);
  });

  test('every generated date falls in the month it was generated for', () => {
    const t = { ...netflixTemplate, startDate: '2025-01-31' };
    const now = new Date('2025-12-31');
    const result = generateRecurringExpenses([t], [], now);
    expect(result).toHaveLength(12);
    result.forEach((e, i) => {
      const parsed = new Date(e.date + 'T00:00:00');
      expect(parsed.getMonth()).toBe(i);
      expect(parsed.getFullYear()).toBe(2025);
    });
  });

  test('does not regenerate months listed in skippedMonths', () => {
    const t = { ...netflixTemplate, skippedMonths: ['2025-02'] };
    const now = new Date('2025-03-01');
    const result = generateRecurringExpenses([t], [], now);
    expect(result.map((e) => e.date)).toEqual(['2025-01-15', '2025-03-15']);
  });

  test('skips every listed month', () => {
    const t = { ...netflixTemplate, skippedMonths: ['2025-01', '2025-03'] };
    const now = new Date('2025-03-01');
    const result = generateRecurringExpenses([t], [], now);
    expect(result.map((e) => e.date)).toEqual(['2025-02-15']);
  });

  // The "already generated?" test is an index of 'recurringId|YYYY-MM' keys
  // built once, rather than a scan of the expense list per candidate month.
  // These pin the parts of that key that could silently go wrong.
  test('an existing month for one template does not suppress another', () => {
    const spotify = { ...netflixTemplate, id: 'r2', title: 'Spotify' };
    const existing = [{ id: 'e1', date: '2025-02-15', recurringId: 'r1' }];
    const now = new Date('2025-02-20');
    const result = generateRecurringExpenses([netflixTemplate, spotify], existing, now);
    // r1 already has February, r2 still needs January and February.
    expect(result.filter((e) => e.recurringId === 'r1')).toHaveLength(1); // Jan only
    expect(result.filter((e) => e.recurringId === 'r2')).toHaveLength(2);
  });

  test('matches an existing entry on any day of the month, not just the template day', () => {
    // Template day is the 15th; the stored entry was edited to the 3rd.
    const existing = [{ id: 'e1', date: '2025-02-03', recurringId: 'r1' }];
    const now = new Date('2025-02-20');
    const result = generateRecurringExpenses([netflixTemplate], existing, now);
    expect(result.map((e) => e.date)).toEqual(['2025-01-15']);
  });

  test('a hand-entered expense in the same month does not count as generated', () => {
    // No recurringId, so it must not suppress generation for that month.
    const existing = [{ id: 'e1', date: '2025-02-15', amount: 800 }];
    const now = new Date('2025-02-20');
    const result = generateRecurringExpenses([netflixTemplate], existing, now);
    expect(result.map((e) => e.date)).toEqual(['2025-01-15', '2025-02-15']);
  });

  test('an existing entry in a neighbouring month does not suppress this one', () => {
    // Guards the zero-padding in the key: '2025-1' must not match '2025-11'.
    const t = { ...netflixTemplate, startDate: '2025-11-15' };
    const existing = [{ id: 'e1', date: '2025-12-15', recurringId: 'r1' }];
    const now = new Date('2025-12-20');
    const result = generateRecurringExpenses([t], existing, now);
    expect(result.map((e) => e.date)).toEqual(['2025-11-15']);
  });

  test('tolerates an existing generated row with no date', () => {
    const existing = [{ id: 'e1', recurringId: 'r1' }];
    const now = new Date('2025-02-20');
    expect(() => generateRecurringExpenses([netflixTemplate], existing, now)).not.toThrow();
    expect(generateRecurringExpenses([netflixTemplate], existing, now)).toHaveLength(2);
  });

  test('an empty or missing skippedMonths changes nothing', () => {
    const now = new Date('2025-03-01');
    expect(generateRecurringExpenses([{ ...netflixTemplate, skippedMonths: [] }], [], now)).toHaveLength(3);
    expect(generateRecurringExpenses([netflixTemplate], [], now)).toHaveLength(3);
  });

  test('one template’s skips do not affect another', () => {
    const spotify = { ...netflixTemplate, id: 'r2', title: 'Spotify', skippedMonths: ['2025-02'] };
    const now = new Date('2025-03-01');
    const result = generateRecurringExpenses([netflixTemplate, spotify], [], now);
    expect(result.filter((e) => e.recurringId === 'r1')).toHaveLength(3);
    expect(result.filter((e) => e.recurringId === 'r2')).toHaveLength(2);
  });

  test('does not generate entries for future months beyond now', () => {
    const now = new Date('2025-01-31');
    const result = generateRecurringExpenses([netflixTemplate], [], now);
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2025-01-15');
  });
});

// ─── applyExpenseDeletion ─────────────────────────────────────────────────────

describe('applyExpenseDeletion', () => {
  const manual = { id: 'm1', title: 'Ručak', date: '2025-02-10', amount: 900, category: 'Hrana' };
  const generated = { id: 'g1', recurringId: 'r1', title: 'Netflix', date: '2025-02-15', amount: 800, category: 'Zabava' };

  function makeData(extra = {}) {
    return {
      expenses: [manual, generated],
      categories: ['Hrana', 'Zabava'],
      recurrings: [netflixTemplate],
      ...extra,
    };
  }

  test('removes the expense', () => {
    const result = applyExpenseDeletion(makeData(), 'm1');
    expect(result.expenses.map((e) => e.id)).toEqual(['g1']);
  });

  test('leaves recurrings untouched for a manually added expense', () => {
    const result = applyExpenseDeletion(makeData(), 'm1');
    expect(result.recurrings[0].skippedMonths).toBeUndefined();
  });

  test('records the month on the template for a generated expense', () => {
    const result = applyExpenseDeletion(makeData(), 'g1');
    expect(result.expenses.map((e) => e.id)).toEqual(['m1']);
    expect(result.recurrings[0].skippedMonths).toEqual(['2025-02']);
  });

  test('appends without duplicating an already skipped month', () => {
    const data = makeData({ recurrings: [{ ...netflixTemplate, skippedMonths: ['2025-02'] }] });
    const result = applyExpenseDeletion(data, 'g1');
    expect(result.recurrings[0].skippedMonths).toEqual(['2025-02']);
  });

  test('keeps months skipped earlier', () => {
    const data = makeData({ recurrings: [{ ...netflixTemplate, skippedMonths: ['2025-01'] }] });
    const result = applyExpenseDeletion(data, 'g1');
    expect(result.recurrings[0].skippedMonths).toEqual(['2025-01', '2025-02']);
  });

  test('only touches the template that generated the expense', () => {
    const spotify = { ...netflixTemplate, id: 'r2' };
    const data = makeData({ recurrings: [netflixTemplate, spotify] });
    const result = applyExpenseDeletion(data, 'g1');
    expect(result.recurrings[0].skippedMonths).toEqual(['2025-02']);
    expect(result.recurrings[1].skippedMonths).toBeUndefined();
  });

  test('is a no-op for an unknown id', () => {
    const result = applyExpenseDeletion(makeData(), 'nope');
    expect(result.expenses).toHaveLength(2);
    expect(result.recurrings[0].skippedMonths).toBeUndefined();
  });

  test('survives a missing recurrings array', () => {
    const data = { expenses: [generated], categories: [] };
    expect(applyExpenseDeletion(data, 'g1').recurrings).toEqual([]);
  });

  // The regression this whole mechanism exists for.
  test('a deleted generated expense is not recreated by the next generation pass', () => {
    const now = new Date('2025-03-01');
    const existing = generateRecurringExpenses([netflixTemplate], [], now)
      .map((e, i) => ({ ...e, id: `gen${i}` }));
    expect(existing.map((e) => e.date)).toEqual(['2025-01-15', '2025-02-15', '2025-03-15']);

    const data = { expenses: existing, categories: [], recurrings: [netflixTemplate] };
    const afterDelete = applyExpenseDeletion(data, 'gen1'); // drop February

    const regenerated = generateRecurringExpenses(afterDelete.recurrings, afterDelete.expenses, now);
    expect(regenerated).toEqual([]);
    expect(afterDelete.expenses.map((e) => e.date)).toEqual(['2025-01-15', '2025-03-15']);
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

// ─── elapsedMonths / goalProgress ─────────────────────────────────────────────

describe('elapsedMonths', () => {
  const march = new Date('2026-03-15T12:00:00');

  test('counts the current month as elapsed', () => {
    expect(elapsedMonths(2026, march)).toBe(3);
  });

  test('a past year is fully elapsed', () => {
    expect(elapsedMonths(2025, march)).toBe(12);
  });

  test('a future year has not started', () => {
    expect(elapsedMonths(2027, march)).toBe(0);
  });

  test('January of the current year counts as one month, not zero', () => {
    expect(elapsedMonths(2026, new Date('2026-01-01T00:00:00'))).toBe(1);
  });
});

describe('goalProgress', () => {
  const march = new Date('2026-03-15T12:00:00');
  const fullYear = { id: 'f1', name: 'Odmor', amounts: Array(12).fill(10000) };

  // The bug this function exists to fix: the plan for the whole year used to be
  // reported as money already saved.
  test('only months up to and including the current one count as saved', () => {
    const { saved, pct } = goalProgress(fullYear, 120000, 2026, march);
    expect(saved).toBe(30000);
    expect(pct).toBe(25);
  });

  test('the full year is still reported as planned', () => {
    const { planned, plannedPct } = goalProgress(fullYear, 120000, 2026, march);
    expect(planned).toBe(120000);
    expect(plannedPct).toBe(100);
  });

  test('a filled-in plan does not read as saved in January', () => {
    const jan = new Date('2026-01-05T00:00:00');
    expect(goalProgress(fullYear, 120000, 2026, jan).pct).toBeCloseTo(8.33, 1);
  });

  test('a past year counts every month', () => {
    expect(goalProgress(fullYear, 120000, 2025, march).saved).toBe(120000);
  });

  test('a future year has nothing saved but keeps its plan', () => {
    const { saved, pct, planned } = goalProgress(fullYear, 120000, 2027, march);
    expect(saved).toBe(0);
    expect(pct).toBe(0);
    expect(planned).toBe(120000);
  });

  test('null months are "not set" and add nothing to either total', () => {
    const sparse = { amounts: [10000, null, 5000, null, null, null, null, null, null, null, null, null] };
    const { saved, planned } = goalProgress(sparse, 100000, 2026, march);
    expect(saved).toBe(15000);
    expect(planned).toBe(15000);
  });

  test('progress is capped at 100% when the plan overshoots the target', () => {
    expect(goalProgress(fullYear, 10000, 2025, march).pct).toBe(100);
  });

  test('a zero or missing target reports 0% rather than Infinity', () => {
    expect(goalProgress(fullYear, 0, 2025, march).pct).toBe(0);
    expect(goalProgress(fullYear, undefined, 2025, march).pct).toBe(0);
  });

  test('a missing fund is handled without throwing', () => {
    expect(goalProgress(undefined, 50000, 2026, march)).toMatchObject({ saved: 0, planned: 0, pct: 0 });
  });
});
