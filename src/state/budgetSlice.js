// Yearly budget: income rows, funds, the tracking maps that link funds to
// expense categories, and the savings goals that read from a fund. Grouped
// together because they are all keyed by year and fund id.

import { applyBudgetCopy } from '../utils/dataTransforms.js';

// A year the user hasn't touched yet has no entry, so every handler starts
// from this shape rather than guarding for undefined.
export function getYearBudget(data, year) {
  return data.budget?.[year] ?? {
    income: { plata: Array(12).fill(null), bonus: Array(12).fill(null), extra: [] },
    funds: [],
  };
}

// `income.extra` was added after the first budgets were saved, so a stored year
// may not have it at all — read it through here, never off the object directly.
export const incomeExtra = (yb) => yb.income?.extra ?? [];

const setYear = (data, year, yearBudget) => ({
  ...data,
  budget: { ...data.budget, [year]: yearBudget },
});

const setFunds = (data, year, funds) => {
  const yb = getYearBudget(data, year);
  return setYear(data, year, { ...yb, funds });
};

const setIncomeExtra = (data, year, extra) => {
  const yb = getYearBudget(data, year);
  return setYear(data, year, { ...yb, income: { ...yb.income, extra } });
};

export const budgetHandlers = {
  'budget/setIncome': (data, { year, field, monthIdx, value }) => {
    const yb = getYearBudget(data, year);
    const amounts = yb.income[field].map((v, i) => (i === monthIdx ? value : v));
    return setYear(data, year, { ...yb, income: { ...yb.income, [field]: amounts } });
  },

  // Custom income rows live beside the fixed plata/bonus ones and carry the
  // same twelve-slot shape as a fund.
  'budget/setIncomeRowAmount': (data, { year, rowId, monthIdx, value }) => {
    const yb = getYearBudget(data, year);
    return setIncomeExtra(
      data,
      year,
      incomeExtra(yb).map((r) =>
        r.id === rowId
          ? { ...r, amounts: r.amounts.map((v, i) => (i === monthIdx ? value : v)) }
          : r
      )
    );
  },

  'budget/addIncomeRow': (data, { year, row }) =>
    setIncomeExtra(data, year, [...incomeExtra(getYearBudget(data, year)), row]),

  'budget/removeIncomeRow': (data, { year, rowId }) =>
    setIncomeExtra(
      data,
      year,
      incomeExtra(getYearBudget(data, year)).filter((r) => r.id !== rowId)
    ),

  'budget/renameIncomeRow': (data, { year, rowId, name }) =>
    setIncomeExtra(
      data,
      year,
      incomeExtra(getYearBudget(data, year)).map((r) => (r.id === rowId ? { ...r, name } : r))
    ),

  'budget/setFundAmount': (data, { year, fundId, monthIdx, value }) => {
    const yb = getYearBudget(data, year);
    return setFunds(
      data,
      year,
      yb.funds.map((f) =>
        f.id === fundId
          ? { ...f, amounts: f.amounts.map((v, i) => (i === monthIdx ? value : v)) }
          : f
      )
    );
  },

  // `kind` is dropped rather than set to null when the fund goes back to being
  // a spending fund, so it stays byte-identical to one that was never toggled —
  // "absent means spending" then holds literally, including in export files.
  // Nothing else on the fund is touched, so flipping the flag is lossless in
  // both directions: the amounts, any confirmations and the category mapping
  // all survive and come back if it is flipped again.
  'budget/setFundKind': (data, { year, fundId, kind }) => {
    const yb = getYearBudget(data, year);
    return setFunds(
      data,
      year,
      yb.funds.map((f) => {
        if (f.id !== fundId) return f;
        const { kind: _prev, ...rest } = f;
        return kind ? { ...rest, kind } : rest;
      })
    );
  },

  // What the user confirmed actually setting aside, as opposed to what the plan
  // in `amounts` says. `null` un-confirms the month — no separate action type,
  // matching how clearing a budget cell writes `null` to `amounts`.
  'budget/setFundContribution': (data, { year, fundId, monthIdx, value }) => {
    const yb = getYearBudget(data, year);
    return setFunds(
      data,
      year,
      yb.funds.map((f) => {
        if (f.id !== fundId) return f;
        // Absent until the first confirmation, so the array is minted here
        // rather than on every fund that will never need one.
        const base = f.contributions ?? Array(12).fill(null);
        return { ...f, contributions: base.map((v, i) => (i === monthIdx ? value : v)) };
      })
    );
  },

  'budget/addFund': (data, { year, fund }) =>
    setFunds(data, year, [...getYearBudget(data, year).funds, fund]),

  'budget/removeFund': (data, { year, fundId }) =>
    setFunds(data, year, getYearBudget(data, year).funds.filter((f) => f.id !== fundId)),

  'budget/renameFund': (data, { year, fundId, name }) =>
    setFunds(
      data,
      year,
      getYearBudget(data, year).funds.map((f) => (f.id === fundId ? { ...f, name } : f))
    ),

  // Ids not present in the current year are dropped rather than trusted — a
  // stale drag result must not resurrect a removed fund.
  'budget/reorderFunds': (data, { year, orderedIds }) => {
    const { funds } = getYearBudget(data, year);
    const byId = Object.fromEntries(funds.map((f) => [f.id, f]));
    return setFunds(data, year, orderedIds.map((id) => byId[id]).filter(Boolean));
  },

  'budget/copyToYear': (data, { fromYear, toYear }) => applyBudgetCopy(data, fromYear, toYear),

  'budget/import': (data, { budget }) => ({
    ...data,
    budget: { ...data.budget, ...budget },
  }),

  'tracking/set': (data, { year, fundId, categories }) => ({
    ...data,
    trackingMaps: {
      ...data.trackingMaps,
      [year]: { ...(data.trackingMaps?.[year] ?? {}), [fundId]: categories },
    },
  }),

  'goal/add': (data, goal) => ({
    ...data,
    savingsGoals: [...(data.savingsGoals ?? []), goal],
  }),

  'goal/update': (data, { id, updates }) => ({
    ...data,
    savingsGoals: (data.savingsGoals ?? []).map((g) => (g.id === id ? { ...g, ...updates } : g)),
  }),

  'goal/delete': (data, { id }) => ({
    ...data,
    savingsGoals: (data.savingsGoals ?? []).filter((g) => g.id !== id),
  }),
};
