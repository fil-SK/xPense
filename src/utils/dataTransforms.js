// Pure business logic functions — no React, no side effects.

import { isoDate, monthKey } from './helpers.js';

// How close to the allocation counts as "nearly there" rather than fine.
export const THRESHOLD_WARN = 0.9;

// spent / allocated → a status name. `null` means the month has no allocation
// at all, which is different from having one and spending nothing against it.
// Lives here rather than in BudgetPanel because the yearly overview grades the
// same ratio and two copies would drift into disagreeing about the same month.
export function statusKey(ratio) {
  if (ratio === null) return 'unset';
  if (ratio > 1) return 'over';
  if (ratio >= THRESHOLD_WARN) return 'warn';
  return 'ok';
}

// Is this row doing better or worse than its plan?
//
// The direction is the whole point. Spending less than planned on Hrana is not
// an achievement — the money may simply not have been spent *yet* — so a
// spending row under plan reports 'onTrack', never 'ahead'. Setting aside less
// than planned for Putovanje is a real shortfall, so a savings row under plan
// reports 'behind'. One shared red/green scale would call the second case good.
//
// `higherIsBetter` is true for income and savings rows, false for spending.
export function varianceStatus(actual, planned, { higherIsBetter } = {}) {
  if (actual == null || planned == null) return 'unset';
  if (actual === planned) return 'onTrack';
  const above = actual > planned;
  if (higherIsBetter) return above ? 'ahead' : 'behind';
  // Under plan on a spending row is unremarkable, not a win.
  return above ? 'behind' : 'onTrack';
}

// Buckets a year's expenses into per-month category totals in a single pass.
//
// The overview grid asks "what was spent on these categories in this month?"
// once per fund per month. Answering that with getExpensesForMonth would walk
// the whole expense array 12 × funds times; this walks it once and every later
// question is an object lookup.
//
// Month is read off the 'YYYY-MM-DD' string rather than parsed, for the reason
// getExpensesForMonth documents: '2026-02-31' belongs to the month it names.
export function monthlyCategoryTotals(expenses, year) {
  const byMonth = Array.from({ length: 12 }, () => ({}));
  const monthTotals = Array(12).fill(0);
  const prefix = `${year}-`;
  for (const e of expenses ?? []) {
    if (!e.date?.startsWith(prefix)) continue;
    const m = Number(e.date.slice(5, 7)) - 1;
    if (!(m >= 0 && m <= 11)) continue;
    const amount = Number(e.amount) || 0;
    byMonth[m][e.category] = (byMonth[m][e.category] ?? 0) + amount;
    monthTotals[m] += amount;
  }
  return { byMonth, monthTotals };
}

// The twelve *actual* numbers for one fund row.
//
// Which source depends on what kind of fund it is. A savings fund's reality is
// what the user confirmed setting aside (`contributions`, written from
// SavingsPanel); a spending fund's is the expenses filed under its mapped
// categories. Reading expenses for a savings fund would measure it against
// spending that has nothing to do with it — the same trap BudgetPanel avoids.
//
// A spending fund with nothing mapped returns all-null, not all-zero: "not
// tracked" and "tracked, spent nothing" are different answers and the grid
// renders them differently.
export function fundActuals(fund, mappedCats, byMonth) {
  if (isSavingsFund(fund)) {
    const contributions = fund.contributions ?? [];
    return Array.from({ length: 12 }, (_, m) => contributions[m] ?? null);
  }
  if (!mappedCats?.length) return Array(12).fill(null);
  return Array.from({ length: 12 }, (_, m) => {
    const totals = byMonth[m] ?? {};
    return mappedCats.reduce((sum, cat) => sum + (totals[cat] ?? 0), 0);
  });
}

// What was spent outside every tracked fund, per month.
//
// Subtracted over the *union* of all mapped categories, not fund by fund: a
// category mapped to two funds is deliberately counted in both of their rows,
// but subtracting it twice here would push this row negative and make the
// column stop adding up.
export function unmappedSpend(byMonth, monthTotals, yearMaps) {
  const mapped = new Set();
  Object.values(yearMaps ?? {}).forEach((cats) => (cats ?? []).forEach((c) => mapped.add(c)));
  return monthTotals.map((total, m) => {
    let tracked = 0;
    for (const [cat, amount] of Object.entries(byMonth[m] ?? {})) {
      if (mapped.has(cat)) tracked += amount;
    }
    return total - tracked;
  });
}

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
    Object.keys(data.actualIncome ?? {}).length === 0 &&
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
// A fund is either a spending fund (compared against expenses in its mapped
// categories) or a savings fund (money set aside, confirmed month by month).
// The flag is absent on every fund written before it existed, so absent must
// mean spending — the reading that leaves old data behaving exactly as it did.
export const isSavingsFund = (fund) => fund?.kind === 'savings';

// The zero progress a goal reports when it isn't linked to a fund that exists.
// Exported so SavingsGoals doesn't hand-maintain a mirror of the shape below —
// a missing key there renders as NaN rather than failing loudly.
export const NO_PROGRESS = {
  saved: 0, planned: 0, expected: 0,
  pct: 0, plannedPct: 0, expectedPct: 0,
  elapsed: 0, confirmedMonths: 0,
};

// Progress on a savings goal linked to a budget fund.
//
// A fund's twelve `amounts` are a *plan*. This used to count every elapsed
// month as saved, which answered "how much was I intending to have set aside by
// now?" and reported it as fact — the app assumed the money had been moved
// because the user had written down that it would be.
//
// `saved` is now what the user actually confirmed: the non-null entries in
// `contributions`, written one month at a time from SavingsPanel. All of them
// count, not just the elapsed ones — a confirmation exists because the user
// asserted the money is set aside, so confirming ahead is real.
//
// The plan is not dropped, it is relabelled. `expected` is the old number (the
// elapsed part of the plan) and `planned` the whole year, so the goal can show
// the gap between what should have been set aside by now and what was.
// `null` months are "not set" and contribute nothing to any total.
export function goalProgress(fund, target, year, now = new Date()) {
  const amounts = fund?.amounts ?? [];
  const contributions = fund?.contributions ?? [];
  const elapsed = elapsedMonths(year, now);

  let planned = 0;
  let expected = 0;
  amounts.forEach((v, i) => {
    const amount = Number(v) || 0;
    planned += amount;
    if (i < elapsed) expected += amount;
  });

  // Counted separately from the sum: a confirmed zero is a real confirmation,
  // and `saved === 0` alone can't tell it apart from never having confirmed.
  let saved = 0;
  let confirmedMonths = 0;
  contributions.forEach((v) => {
    if (v == null) return;
    saved += Number(v) || 0;
    confirmedMonths += 1;
  });

  const toPct = (v) => (target > 0 ? Math.min(100, (v / target) * 100) : 0);
  return {
    saved, planned, expected,
    pct: toPct(saved), plannedPct: toPct(planned), expectedPct: toPct(expected),
    elapsed, confirmedMonths,
  };
}

export function applyBudgetCopy(data, fromYear, toYear) {
  const source = data.budget?.[fromYear];
  if (!source) return data;
  const fundIdMap = {};
  // This field list is a deliberate whitelist, not a spread: structure copies
  // to the new year, recorded values do not. `kind` is structure (a savings
  // fund stays one); `contributions` are last year's record and must not follow
  // the plan into next year. A new fund field is dropped unless added here.
  const newFunds = source.funds.map((f) => {
    const newId = crypto.randomUUID();
    fundIdMap[f.id] = newId;
    return {
      id: newId,
      name: f.name,
      amounts: Array(12).fill(null),
      ...(f.kind ? { kind: f.kind } : {}),
    };
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
