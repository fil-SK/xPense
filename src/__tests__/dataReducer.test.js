import { dataReducer, ACTION_TYPES } from '../state/dataReducer.js';
import { expenseHandlers } from '../state/expensesSlice.js';
import { categoryHandlers } from '../state/categoriesSlice.js';
import { budgetHandlers } from '../state/budgetSlice.js';

function baseData(overrides = {}) {
  return {
    expenses: [
      { id: 'e1', title: 'Ručak', date: '2025-01-10', amount: 900, category: 'Hrana', note: '' },
      { id: 'e2', title: 'Bus', date: '2025-01-11', amount: 100, category: 'Transport', note: '' },
    ],
    categories: ['Hrana', 'Transport', 'Ostalo'],
    categoryGroups: [
      { id: 'g1', name: 'Osnovno', categories: ['Hrana'] },
      { id: 'g2', name: 'Ostalo', categories: ['Transport'] },
    ],
    budget: {
      2025: {
        income: { plata: Array(12).fill(null), bonus: Array(12).fill(null) },
        funds: [
          { id: 'f1', name: 'Hrana', amounts: Array(12).fill(null) },
          { id: 'f2', name: 'Prevoz', amounts: Array(12).fill(null) },
        ],
      },
    },
    trackingMaps: { 2025: { f1: ['Hrana'] } },
    recurrings: [],
    monthlyNotes: {},
    savingsGoals: [],
    ...overrides,
  };
}

const run = (data, type, payload) => dataReducer(data, { type, payload });

describe('dataReducer routing', () => {
  test('throws on an unknown action type', () => {
    expect(() => run(baseData(), 'nope/whatever', {})).toThrow(/unknown action/i);
  });

  // Slices are merged with object spread, so a type defined twice would have
  // one silently shadow the other.
  test('no action type is defined by two slices', () => {
    const keys = [
      ...Object.keys(expenseHandlers),
      ...Object.keys(categoryHandlers),
      ...Object.keys(budgetHandlers),
    ];
    expect(new Set(keys).size).toBe(keys.length);
  });

  test('every slice handler is reachable through the reducer', () => {
    const keys = [
      ...Object.keys(expenseHandlers),
      ...Object.keys(categoryHandlers),
      ...Object.keys(budgetHandlers),
    ];
    keys.forEach((k) => expect(ACTION_TYPES).toContain(k));
  });

  test('data/replace swaps the whole object', () => {
    const next = baseData({ expenses: [] });
    expect(run(baseData(), 'data/replace', next)).toBe(next);
  });

  test('handlers do not mutate the input', () => {
    const data = baseData();
    const snapshot = JSON.parse(JSON.stringify(data));
    run(data, 'expense/add', { id: 'x', title: 'X', date: '2025-02-01', amount: 1, category: 'Hrana' });
    run(data, 'category/delete', { name: 'Hrana' });
    run(data, 'budget/removeFund', { year: 2025, fundId: 'f1' });
    run(data, 'budget/setFundKind', { year: 2025, fundId: 'f1', kind: 'savings' });
    run(data, 'budget/setFundContribution', { year: 2025, fundId: 'f1', monthIdx: 0, value: 500 });
    run(data, 'data/restore', { snapshot: baseData(), keys: ['expenses'] });
    expect(data).toEqual(snapshot);
  });
});

// The undo behind every delete toast. It restores named fields only — that is
// the whole point of it existing next to data/replace, so the tests below pin
// both halves: the named field comes back, the unnamed one does not.
describe('data/restore', () => {
  test('restores a named field from the snapshot', () => {
    const before = baseData();
    const after = run(before, 'expense/delete', { id: 'e1' });
    const undone = run(after, 'data/restore', { snapshot: before, keys: ['expenses'] });
    expect(undone.expenses).toEqual(before.expenses);
  });

  test('leaves fields the delete never touched at their current value', () => {
    const before = baseData();
    const afterDelete = run(before, 'expense/delete', { id: 'e1' });
    // Something unrelated happens while the undo toast is up.
    const afterEdit = run(afterDelete, 'category/add', { name: 'Putovanja' });

    const undone = run(afterEdit, 'data/restore', { snapshot: before, keys: ['expenses'] });
    expect(undone.expenses).toEqual(before.expenses);
    expect(undone.categories).toContain('Putovanja');
  });

  test('restores several fields at once', () => {
    const before = baseData();
    const after = run(before, 'category/delete', { name: 'Hrana' });
    expect(after.expenses[0].category).toBe('Ostalo');

    const undone = run(after, 'data/restore', {
      snapshot: before,
      keys: ['categories', 'categoryGroups', 'expenses'],
    });
    expect(undone.categories).toContain('Hrana');
    expect(undone.expenses[0].category).toBe('Hrana');
    expect(undone.categoryGroups).toEqual(before.categoryGroups);
  });

  // Deleting a generated expense also writes skippedMonths on the template, so
  // restoring `expenses` alone would put the row back and let the next
  // generation pass skip it right out again.
  test('lifting skippedMonths needs recurrings in the key list', () => {
    const before = baseData({
      expenses: [{ id: 'r1-jan', recurringId: 'r1', title: 'Kirija', date: '2025-01-01', amount: 500, category: 'Ostalo' }],
      recurrings: [{ id: 'r1', title: 'Kirija', amount: 500, category: 'Ostalo', startDate: '2025-01-01', frequency: 'monthly' }],
    });
    const after = run(before, 'expense/delete', { id: 'r1-jan' });
    expect(after.recurrings[0].skippedMonths).toEqual(['2025-01']);

    const undone = run(after, 'data/restore', {
      snapshot: before,
      keys: ['expenses', 'recurrings'],
    });
    expect(undone.expenses).toHaveLength(1);
    expect(undone.recurrings[0].skippedMonths).toBeUndefined();
  });
});

describe('expenses slice', () => {
  test('expense/add appends', () => {
    const added = { id: 'e3', title: 'Kafa', date: '2025-01-12', amount: 200, category: 'Hrana' };
    const result = run(baseData(), 'expense/add', added);
    expect(result.expenses).toHaveLength(3);
    expect(result.expenses[2]).toEqual(added);
  });

  test('expense/update patches only the matching row', () => {
    const result = run(baseData(), 'expense/update', { id: 'e1', updates: { amount: 1500 } });
    expect(result.expenses[0]).toMatchObject({ id: 'e1', amount: 1500, title: 'Ručak' });
    expect(result.expenses[1].amount).toBe(100);
  });

  test('expense/delete removes the row', () => {
    const result = run(baseData(), 'expense/delete', { id: 'e1' });
    expect(result.expenses.map((e) => e.id)).toEqual(['e2']);
  });

  test('expense/delete records the month on a generated expense’s template', () => {
    const data = baseData({
      expenses: [{ id: 'g', recurringId: 'r1', date: '2025-03-04', amount: 800, category: 'Zabava', title: 'Netflix' }],
      recurrings: [{ id: 'r1', title: 'Netflix', startDate: '2025-01-04' }],
    });
    const result = run(data, 'expense/delete', { id: 'g' });
    expect(result.recurrings[0].skippedMonths).toEqual(['2025-03']);
  });

  test('expense/addGenerated appends all of them', () => {
    const generated = [
      { id: 'x1', recurringId: 'r1', date: '2025-02-01', amount: 800, category: 'Zabava', title: 'N' },
      { id: 'x2', recurringId: 'r1', date: '2025-03-01', amount: 800, category: 'Zabava', title: 'N' },
    ];
    const result = run(baseData(), 'expense/addGenerated', generated);
    expect(result.expenses).toHaveLength(4);
  });

  test('expense/addGenerated with nothing to add keeps the same object', () => {
    const data = baseData();
    expect(run(data, 'expense/addGenerated', [])).toBe(data);
  });

  test('recurring/add and recurring/delete', () => {
    const withOne = run(baseData(), 'recurring/add', { id: 'r1', title: 'Netflix' });
    expect(withOne.recurrings).toHaveLength(1);
    expect(run(withOne, 'recurring/delete', { id: 'r1' }).recurrings).toEqual([]);
  });

  test('recurring/update patches the template and leaves siblings alone', () => {
    const data = baseData({
      recurrings: [
        { id: 'r1', title: 'Netflix', amount: 800, category: 'Zabava', startDate: '2025-01-04' },
        { id: 'r2', title: 'Teretana', amount: 3000, category: 'Sport', startDate: '2025-01-01' },
      ],
    });
    const result = run(data, 'recurring/update', { id: 'r1', updates: { amount: 1200 } });
    expect(result.recurrings[0]).toMatchObject({ id: 'r1', title: 'Netflix', amount: 1200, startDate: '2025-01-04' });
    expect(result.recurrings[1].amount).toBe(3000);
  });

  // Editing the template must not rewrite months that were already generated —
  // those are records of money that was actually spent.
  test('recurring/update leaves already generated expenses untouched', () => {
    const data = baseData({
      expenses: [{ id: 'g', recurringId: 'r1', date: '2025-02-04', amount: 800, category: 'Zabava', title: 'Netflix' }],
      recurrings: [{ id: 'r1', title: 'Netflix', amount: 800, category: 'Zabava', startDate: '2025-01-04' }],
    });
    const result = run(data, 'recurring/update', { id: 'r1', updates: { amount: 1200 } });
    expect(result.expenses[0].amount).toBe(800);
  });

  test('note/set writes a nested year/month without disturbing siblings', () => {
    const seeded = baseData({ monthlyNotes: { 2025: { 0: 'januar' } } });
    const result = run(seeded, 'note/set', { year: 2025, month: 3, text: 'april' });
    expect(result.monthlyNotes[2025]).toEqual({ 0: 'januar', 3: 'april' });
  });

  test('note/set creates the year when absent', () => {
    const result = run(baseData(), 'note/set', { year: 2026, month: 1, text: 'nešto' });
    expect(result.monthlyNotes[2026][1]).toBe('nešto');
  });
});

describe('categories slice', () => {
  test('category/add appends', () => {
    expect(run(baseData(), 'category/add', { name: 'Sport' }).categories).toContain('Sport');
  });

  test('category/rename fans out to expenses and groups', () => {
    const result = run(baseData(), 'category/rename', { oldName: 'Hrana', newName: 'Namirnice' });
    expect(result.categories).toContain('Namirnice');
    expect(result.categories).not.toContain('Hrana');
    expect(result.expenses[0].category).toBe('Namirnice');
    expect(result.categoryGroups[0].categories).toEqual(['Namirnice']);
  });

  test('category/delete reassigns its expenses to Ostalo', () => {
    const result = run(baseData(), 'category/delete', { name: 'Hrana' });
    expect(result.categories).not.toContain('Hrana');
    expect(result.expenses[0].category).toBe('Ostalo');
    expect(result.categoryGroups[0].categories).toEqual([]);
  });

  test('category/archive leaves past expenses on the old name', () => {
    const result = run(baseData(), 'category/archive', { name: 'Hrana' });
    expect(result.categories).not.toContain('Hrana');
    expect(result.expenses[0].category).toBe('Hrana');
    expect(result.categoryGroups[0].categories).toEqual([]);
  });

  test('group/add starts empty', () => {
    const result = run(baseData(), 'group/add', { id: 'g3', name: 'Režije' });
    expect(result.categoryGroups[2]).toEqual({ id: 'g3', name: 'Režije', categories: [] });
  });

  test('group/rename and group/delete', () => {
    const renamed = run(baseData(), 'group/rename', { id: 'g1', name: 'Hrana i piće' });
    expect(renamed.categoryGroups[0].name).toBe('Hrana i piće');
    expect(run(baseData(), 'group/delete', { id: 'g1' }).categoryGroups.map((g) => g.id)).toEqual(['g2']);
  });

  test('group/setMembers moves a category out of its previous group', () => {
    const result = run(baseData(), 'group/setMembers', { groupId: 'g1', members: ['Hrana', 'Transport'] });
    expect(result.categoryGroups[0].categories).toEqual(['Hrana', 'Transport']);
    expect(result.categoryGroups[1].categories).toEqual([]);
  });
});

describe('budget slice', () => {
  const withIncomeRows = () => {
    const data = baseData();
    data.budget[2025].income.extra = [
      { id: 'i1', name: 'Honorar', amounts: Array(12).fill(null) },
      { id: 'i2', name: 'Izdavanje', amounts: Array(12).fill(null) },
    ];
    return data;
  };

  test('budget/setIncome writes one month', () => {
    const result = run(baseData(), 'budget/setIncome', { year: 2025, field: 'plata', monthIdx: 2, value: 90000 });
    expect(result.budget[2025].income.plata[2]).toBe(90000);
    expect(result.budget[2025].income.plata[1]).toBeNull();
  });

  // baseData has no `income.extra` — budgets saved before custom income rows
  // existed don't, so every handler has to cope with the key being absent.
  test('budget/addIncomeRow appends to a year that never had an extra list', () => {
    const row = { id: 'i1', name: 'Honorar', amounts: Array(12).fill(null) };
    const result = run(baseData(), 'budget/addIncomeRow', { year: 2025, row });
    expect(result.budget[2025].income.extra).toEqual([row]);
    expect(result.budget[2025].income.plata).toHaveLength(12);
    expect(result.budget[2025].funds).toHaveLength(2);
  });

  test('budget/addIncomeRow creates a year that does not exist yet', () => {
    const row = { id: 'i1', name: 'Honorar', amounts: Array(12).fill(null) };
    const result = run(baseData(), 'budget/addIncomeRow', { year: 2030, row });
    expect(result.budget[2030].income.extra).toEqual([row]);
    expect(result.budget[2030].funds).toEqual([]);
  });

  test('budget/setIncomeRowAmount writes one cell of one row', () => {
    const withRows = withIncomeRows();
    const result = run(withRows, 'budget/setIncomeRowAmount', { year: 2025, rowId: 'i2', monthIdx: 3, value: 12000 });
    expect(result.budget[2025].income.extra[1].amounts[3]).toBe(12000);
    expect(result.budget[2025].income.extra[0].amounts[3]).toBeNull();
    expect(withRows.budget[2025].income.extra[1].amounts[3]).toBeNull();
  });

  test('budget/removeIncomeRow and budget/renameIncomeRow', () => {
    expect(run(withIncomeRows(), 'budget/removeIncomeRow', { year: 2025, rowId: 'i1' })
      .budget[2025].income.extra.map((r) => r.id)).toEqual(['i2']);
    expect(run(withIncomeRows(), 'budget/renameIncomeRow', { year: 2025, rowId: 'i1', name: 'Freelance' })
      .budget[2025].income.extra[0].name).toBe('Freelance');
  });

  test('income row handlers leave plata and bonus alone', () => {
    const result = run(withIncomeRows(), 'budget/removeIncomeRow', { year: 2025, rowId: 'i1' });
    expect(result.budget[2025].income.plata).toHaveLength(12);
    expect(result.budget[2025].income.bonus).toHaveLength(12);
  });

  test('budget/setFundAmount writes one cell of one fund', () => {
    const result = run(baseData(), 'budget/setFundAmount', { year: 2025, fundId: 'f2', monthIdx: 0, value: 5000 });
    expect(result.budget[2025].funds[1].amounts[0]).toBe(5000);
    expect(result.budget[2025].funds[0].amounts[0]).toBeNull();
  });

  test('budget/setFundKind marks one fund and leaves its siblings alone', () => {
    const result = run(baseData(), 'budget/setFundKind', { year: 2025, fundId: 'f1', kind: 'savings' });
    expect(result.budget[2025].funds[0].kind).toBe('savings');
    expect('kind' in result.budget[2025].funds[1]).toBe(false);
  });

  // Dropped rather than set to null, so a spending fund stays byte-identical to
  // one that was never toggled and "absent means spending" holds literally.
  test('budget/setFundKind removes the key when switched back', () => {
    const savings = run(baseData(), 'budget/setFundKind', { year: 2025, fundId: 'f1', kind: 'savings' });
    const back = run(savings, 'budget/setFundKind', { year: 2025, fundId: 'f1', kind: null });
    expect('kind' in back.budget[2025].funds[0]).toBe(false);
  });

  test('budget/setFundKind leaves the amounts and any contributions intact', () => {
    const data = baseData();
    data.budget[2025].funds[0].amounts[0] = 9000;
    data.budget[2025].funds[0].contributions = Array(12).fill(null);
    data.budget[2025].funds[0].contributions[0] = 7000;
    const result = run(data, 'budget/setFundKind', { year: 2025, fundId: 'f1', kind: 'savings' });
    expect(result.budget[2025].funds[0].amounts[0]).toBe(9000);
    expect(result.budget[2025].funds[0].contributions[0]).toBe(7000);
  });

  test('budget/setFundKind on a year that does not exist yet does not throw', () => {
    expect(() => run(baseData(), 'budget/setFundKind', { year: 2030, fundId: 'f1', kind: 'savings' }))
      .not.toThrow();
  });

  // The array is absent until the first confirmation, so it has to be minted.
  test('budget/setFundContribution creates the twelve slots on a fund with none', () => {
    const result = run(baseData(), 'budget/setFundContribution', { year: 2025, fundId: 'f1', monthIdx: 2, value: 20000 });
    const fund = result.budget[2025].funds[0];
    expect(fund.contributions).toHaveLength(12);
    expect(fund.contributions[2]).toBe(20000);
    expect(fund.contributions[1]).toBeNull();
    expect(fund.amounts).toEqual(Array(12).fill(null));
    expect(result.budget[2025].funds[1].contributions).toBeUndefined();
  });

  test('budget/setFundContribution with null un-confirms just that month', () => {
    const one = run(baseData(), 'budget/setFundContribution', { year: 2025, fundId: 'f1', monthIdx: 0, value: 100 });
    const two = run(one, 'budget/setFundContribution', { year: 2025, fundId: 'f1', monthIdx: 1, value: 200 });
    const cleared = run(two, 'budget/setFundContribution', { year: 2025, fundId: 'f1', monthIdx: 0, value: null });
    expect(cleared.budget[2025].funds[0].contributions[0]).toBeNull();
    expect(cleared.budget[2025].funds[0].contributions[1]).toBe(200);
  });

  // "I set aside nothing this month" is an answer the plan can't express, so it
  // has to survive as distinct from never having been asked.
  test('budget/setFundContribution stores a confirmed zero as zero, not null', () => {
    const result = run(baseData(), 'budget/setFundContribution', { year: 2025, fundId: 'f1', monthIdx: 0, value: 0 });
    expect(result.budget[2025].funds[0].contributions[0]).toBe(0);
  });

  test('budget/addFund appends to the year', () => {
    const fund = { id: 'f3', name: 'Štednja', amounts: Array(12).fill(null) };
    const result = run(baseData(), 'budget/addFund', { year: 2025, fund });
    expect(result.budget[2025].funds).toHaveLength(3);
  });

  test('budget/addFund creates a year that does not exist yet', () => {
    const fund = { id: 'f9', name: 'Novo', amounts: Array(12).fill(null) };
    const result = run(baseData(), 'budget/addFund', { year: 2030, fund });
    expect(result.budget[2030].funds).toEqual([fund]);
    expect(result.budget[2030].income.plata).toHaveLength(12);
  });

  test('budget/removeFund and budget/renameFund', () => {
    expect(run(baseData(), 'budget/removeFund', { year: 2025, fundId: 'f1' }).budget[2025].funds)
      .toHaveLength(1);
    expect(run(baseData(), 'budget/renameFund', { year: 2025, fundId: 'f1', name: 'Namirnice' })
      .budget[2025].funds[0].name).toBe('Namirnice');
  });

  test('budget/reorderFunds applies the given order', () => {
    const result = run(baseData(), 'budget/reorderFunds', { year: 2025, orderedIds: ['f2', 'f1'] });
    expect(result.budget[2025].funds.map((f) => f.id)).toEqual(['f2', 'f1']);
  });

  test('budget/reorderFunds ignores ids that no longer exist', () => {
    const result = run(baseData(), 'budget/reorderFunds', { year: 2025, orderedIds: ['f2', 'ghost', 'f1'] });
    expect(result.budget[2025].funds.map((f) => f.id)).toEqual(['f2', 'f1']);
  });

  test('budget/import merges years rather than replacing the map', () => {
    const result = run(baseData(), 'budget/import', { budget: { 2026: { income: {}, funds: [] } } });
    expect(Object.keys(result.budget).sort()).toEqual(['2025', '2026']);
  });

  test('budget/copyToYear carries the fund structure across', () => {
    const result = run(baseData(), 'budget/copyToYear', { fromYear: 2025, toYear: 2026 });
    expect(result.budget[2026].funds.map((f) => f.name)).toEqual(['Hrana', 'Prevoz']);
    expect(result.budget[2026].funds[0].id).not.toBe('f1');
  });

  test('tracking/set replaces the list for one fund only', () => {
    const result = run(baseData(), 'tracking/set', { year: 2025, fundId: 'f2', categories: ['Transport'] });
    expect(result.trackingMaps[2025]).toEqual({ f1: ['Hrana'], f2: ['Transport'] });
  });

  test('tracking/set creates the year when absent', () => {
    const result = run(baseData(), 'tracking/set', { year: 2027, fundId: 'f1', categories: ['Hrana'] });
    expect(result.trackingMaps[2027]).toEqual({ f1: ['Hrana'] });
  });

  test('goal/add and goal/delete', () => {
    const withGoal = run(baseData(), 'goal/add', { id: 'g1', name: 'Odmor', target: 100000 });
    expect(withGoal.savingsGoals).toHaveLength(1);
    expect(run(withGoal, 'goal/delete', { id: 'g1' }).savingsGoals).toEqual([]);
  });

  test('goal/update patches only the matching goal', () => {
    const data = baseData({
      savingsGoals: [
        { id: 'g1', name: 'Odmor', target: 100000, fundId: null, year: null },
        { id: 'g2', name: 'Auto', target: 500000, fundId: null, year: null },
      ],
    });
    const result = run(data, 'goal/update', { id: 'g1', updates: { target: 120000, fundId: 'f1', year: 2025 } });
    expect(result.savingsGoals[0]).toEqual({ id: 'g1', name: 'Odmor', target: 120000, fundId: 'f1', year: 2025 });
    expect(result.savingsGoals[1].target).toBe(500000);
  });
});
