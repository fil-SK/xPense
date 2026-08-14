// Pure business logic functions — no React, no side effects.

import { isoDate, monthKey } from './helpers.js';

// "Nothing worth keeping yet." Used to decide whether restoring from the backup
// file is safe — categories alone are defaults, so they don't count as content.
export function isEmptyData(data) {
  if (!data) return true;
  return (
    (data.expenses?.length ?? 0) === 0 &&
    (data.recurrings?.length ?? 0) === 0 &&
    (data.savingsGoals?.length ?? 0) === 0 &&
    Object.keys(data.budget ?? {}).length === 0 &&
    Object.keys(data.monthlyNotes ?? {}).length === 0 &&
    (data.categoryGroups?.length ?? 0) === 0
  );
}

// Index of the (template, month) pairs that already have a generated expense,
// keyed 'recurringId|YYYY-MM'. Only rows carrying a recurringId can match, so
// hand-entered expenses never enter the index.
//
// This is what keeps the generator off the expense list: the "does this month
// already exist?" test used to be a .some() over every expense, nested inside
// the template × year × month loops, so the work grew as templates × months ×
// expenses. Built once up front it is a single pass plus O(1) lookups.
function indexGeneratedMonths(existingExpenses) {
  const seen = new Set();
  for (const e of existingExpenses) {
    if (e.recurringId) seen.add(`${e.recurringId}|${e.date?.slice(0, 7)}`);
  }
  return seen;
}

export function generateRecurringExpenses(recurrings, existingExpenses, now = new Date()) {
  const curYear = now.getFullYear();
  const curMonth = now.getMonth();
  const alreadyGenerated = indexGeneratedMonths(existingExpenses);
  const newExpenses = [];
  for (const r of recurrings) {
    // Months the user deleted by hand — regenerating them would undo that.
    const skipped = new Set(r.skippedMonths ?? []);
    const start = new Date(r.startDate + 'T00:00:00');
    const sy = start.getFullYear();
    const sm = start.getMonth();
    const day = start.getDate();
    for (let y = sy; y <= curYear; y++) {
      const mFrom = y === sy ? sm : 0;
      const mTo = y === curYear ? curMonth : 11;
      for (let m = mFrom; m <= mTo; m++) {
        const monthStr = monthKey(y, m);
        if (skipped.has(monthStr)) continue;
        if (!alreadyGenerated.has(`${r.id}|${monthStr}`)) {
          newExpenses.push({
            recurringId: r.id,
            title: r.title,
            amount: r.amount,
            category: r.category,
            note: r.note || '',
            // Clamped: a template starting on the 31st lands on the 28th/30th
            // in shorter months rather than spilling into the next one.
            date: isoDate(y, m, day),
          });
        }
      }
    }
  }
  return newExpenses;
}

// Deletes one expense. When it was auto-generated from a recurring template,
// the month is recorded on that template so the generator won't recreate it on
// the next startup.
export function applyExpenseDeletion(data, id) {
  const target = data.expenses.find((e) => e.id === id);
  const expenses = data.expenses.filter((e) => e.id !== id);
  if (!target?.recurringId) return { ...data, expenses };

  const month = target.date.slice(0, 7);
  return {
    ...data,
    expenses,
    recurrings: (data.recurrings ?? []).map((r) => {
      if (r.id !== target.recurringId) return r;
      const skipped = r.skippedMonths ?? [];
      if (skipped.includes(month)) return r;
      return { ...r, skippedMonths: [...skipped, month] };
    }),
  };
}

// How many of a year's twelve months have already happened, counting the
// current one. A past year is fully elapsed, a future year not at all.
export function elapsedMonths(year, now = new Date()) {
  const curYear = now.getFullYear();
  if (year < curYear) return 12;
  if (year > curYear) return 0;
  return now.getMonth() + 1;
}
// Progress on a savings goal linked to a budget fund.
//
// A fund's twelve amounts are a *plan*, so summing all of them answers "how
// much will this fund hold in December?" — not "how much is saved?". Filling in
// the year made every goal read 100% on the 1st of January. Only the months
// that have already happened count toward `saved`; the whole year stays
// available as `planned` so the plan is shown rather than silently dropped.
//
// The current month counts as saved: that month's allocation is set aside
// during it, and excluding it would park every goal at 0% for a month.
// `null` months are "not set" and contribute nothing to either total.
export function goalProgress(fund, target, year, now = new Date()) {
  const amounts = fund?.amounts ?? [];
  const elapsed = elapsedMonths(year, now);
  let saved = 0;
  let planned = 0;
  amounts.forEach((v, i) => {
    const amount = Number(v) || 0;
    planned += amount;
    if (i < elapsed) saved += amount;
  });
  const toPct = (v) => (target > 0 ? Math.min(100, (v / target) * 100) : 0);
  return { saved, planned, pct: toPct(saved), plannedPct: toPct(planned), elapsed };
}

export function applyBudgetCopy(data, fromYear, toYear) {
  const source = data.budget?.[fromYear];
  if (!source) return data;
  const fundIdMap = {};
  const newFunds = source.funds.map((f) => {
    const newId = crypto.randomUUID();
    fundIdMap[f.id] = newId;
    return { id: newId, name: f.name, amounts: Array(12).fill(null) };
  });
  const sourceTracking = data.trackingMaps?.[fromYear] ?? {};
  const newTracking = Object.fromEntries(
    Object.entries(sourceTracking).map(([oldId, cats]) => [fundIdMap[oldId] ?? oldId, cats])
  );
  return {
    ...data,
    budget: {
      ...data.budget,
      [toYear]: {
        income: {
          plata: [...source.income.plata],
          bonus: Array(12).fill(null),
          // Custom income rows carry over as structure only, like the funds —
          // last year's amounts on a one-off income would be a guess.
          extra: (source.income.extra ?? []).map((r) => ({
            id: crypto.randomUUID(),
            name: r.name,
            amounts: Array(12).fill(null),
          })),
        },
        funds: newFunds,
      },
    },
    trackingMaps: { ...data.trackingMaps, [toYear]: newTracking },
  };
}
