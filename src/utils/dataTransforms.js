// Pure business logic functions — no React, no side effects.

export function generateRecurringExpenses(recurrings, existingExpenses, now = new Date()) {
  const curYear = now.getFullYear();
  const curMonth = now.getMonth();
  const newExpenses = [];
  for (const r of recurrings) {
    const start = new Date(r.startDate + 'T00:00:00');
    const sy = start.getFullYear();
    const sm = start.getMonth();
    const day = String(start.getDate()).padStart(2, '0');
    for (let y = sy; y <= curYear; y++) {
      const mFrom = y === sy ? sm : 0;
      const mTo = y === curYear ? curMonth : 11;
      for (let m = mFrom; m <= mTo; m++) {
        const monthStr = `${y}-${String(m + 1).padStart(2, '0')}`;
        const exists = existingExpenses.some(
          (e) => e.recurringId === r.id && e.date.startsWith(monthStr)
        );
        if (!exists) {
          newExpenses.push({
            recurringId: r.id,
            title: r.title,
            amount: r.amount,
            category: r.category,
            note: r.note || '',
            date: `${monthStr}-${day}`,
          });
        }
      }
    }
  }
  return newExpenses;
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
        income: { plata: [...source.income.plata], bonus: Array(12).fill(null) },
        funds: newFunds,
      },
    },
    trackingMaps: { ...data.trackingMaps, [toYear]: newTracking },
  };
}
