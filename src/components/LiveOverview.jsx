import { useState, useMemo } from 'react';
import { useApp } from '../App.jsx';
import { MONTHS_SR, MONTHS_SR_SHORT } from '../utils/helpers.js';
import {
  elapsedMonths, isSavingsFund, varianceStatus,
  monthlyCategoryTotals, fundActuals, unmappedSpend,
} from '../utils/dataTransforms.js';
import BudgetCell, { fmt } from './BudgetCell.jsx';

// Sums the first `n` months, ignoring "not set". Returns null when the whole
// stretch is unset, so an untouched row reads '—' rather than a confident 0.
function sumThrough(arr, n) {
  let has = false;
  let total = 0;
  for (let i = 0; i < n; i++) {
    if (arr[i] != null) { has = true; total += arr[i]; }
  }
  return has ? total : null;
}

// Deliberately neutral wording. Whether a gap is good or bad depends on the row
// — spending less than planned is fine, saving less than planned is not — so the
// text only states the direction and the colour carries the judgement.
function deltaLabel(actual, planned) {
  if (actual == null || planned == null) return null;
  const d = actual - planned;
  if (d === 0) return 'tačno po planu';
  return `${d > 0 ? '+' : '−'}${fmt(Math.abs(d))} ${d > 0 ? 'iznad plana' : 'ispod plana'}`;
}

// One row of the grid: twelve month cells showing actual over plan, then the
// year-to-date pair. `editable` is passed only by the income rows — everywhere
// else the number is derived and there is nothing to type.
function OverviewRow({
  label, labelHint, plan, actual, elapsed, currentMonth,
  higherIsBetter, editable, rowClass = '',
}) {
  const actualYtd = sumThrough(actual, elapsed);
  const plannedYtd = sumThrough(plan ?? [], elapsed);
  const totalStatus = varianceStatus(actualYtd, plannedYtd, { higherIsBetter });

  return (
    <tr className={`bg__row ${rowClass}`} data-testid={`lgo-row-${label}`}>
      <td className="bg__label-col bg__row-label lgo__row-label">
        <span className="lgo__row-name">{label}</span>
        {labelHint && <span className="lgo__row-hint">{labelHint}</span>}
      </td>

      {actual.map((_, m) => {
        // A month that hasn't happened is not a month where nothing was spent.
        // Showing 0 against the plan would flag every future column as a
        // saving, and every future savings row as a shortfall.
        const isFuture = m >= elapsed;
        const a = isFuture ? null : actual[m];
        const p = plan?.[m] ?? null;
        const status = isFuture ? 'future' : varianceStatus(a, p, { higherIsBetter });

        const body = (
          <>
            <span className="lgo-cell__actual">{isFuture ? '—' : fmt(a)}</span>
            <span className="lgo-cell__plan">{p != null ? `/ ${fmt(p)}` : ''}</span>
          </>
        );

        return (
          <td
            key={m}
            className={`bg__cell lgo-cell lgo-cell--${status} ${m === currentMonth ? 'bg__col--current' : ''}`}
          >
            {editable ? (
              <BudgetCell
                value={editable.overrideOf(m)}
                onSave={(v) => editable.onSave(m, v)}
                className="lgo-cell__edit"
                ariaLabel={`Stvarni prihod za ${label}, ${MONTHS_SR[m]} ${editable.year}`}
                title={
                  editable.overrideOf(m) != null
                    ? 'Ručno upisano — obriši polje da se vrati na plan'
                    : 'Po planu — klikni da upišeš stvarni iznos'
                }
              >
                {body}
              </BudgetCell>
            ) : body}
          </td>
        );
      })}

      <td className={`bg__total-cell lgo-total lgo-total--${totalStatus}`}>
        <span className="lgo-cell__actual">{fmt(actualYtd)}</span>
        <span className="lgo-cell__plan">{plannedYtd != null ? `/ ${fmt(plannedYtd)}` : ''}</span>
      </td>
    </tr>
  );
}

// "Prihodi (do avg.)" — but a year that hasn't started has no "so far" to name.
function ytdLabel(what, elapsed) {
  if (elapsed === 0) return what;
  if (elapsed === 12) return `${what} (cela godina)`;
  return `${what} (do ${MONTHS_SR_SHORT[elapsed - 1]})`;
}

function SummaryCard({ label, actual, planned, higherIsBetter }) {
  const status = varianceStatus(actual, planned, { higherIsBetter });
  return (
    <div className="budget__summary-card">
      <div className="budget__summary-label">
        <span className={`budget__summary-dot lgo-dot--${status}`} />
        {label}
      </div>
      <div className="budget__summary-value">
        {fmt(actual)} <span className="budget__summary-unit">/ {fmt(planned)} RSD</span>
      </div>
      <div className={`lgo__summary-delta lgo__summary-delta--${status}`}>
        {deltaLabel(actual, planned) ?? '—'}
      </div>
    </div>
  );
}

export default function LiveOverview() {
  const { data, navigateTo, setActualIncome } = useApp();
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);

  const currentMonth = year === thisYear ? new Date().getMonth() : -1;
  const elapsed = elapsedMonths(year);
  const yb = data.budget?.[year];
  const yearMaps = data.trackingMaps?.[year] ?? {};

  const { byMonth, monthTotals } = useMemo(
    () => monthlyCategoryTotals(data.expenses, year),
    [data.expenses, year]
  );

  const overrides = data.actualIncome?.[year] ?? {};

  // Income rows: the plan is the default and an override replaces it month by
  // month, so an untouched year reads exactly like the budget it came from.
  const incomeRows = useMemo(() => {
    if (!yb) return [];
    const forYear = data.actualIncome?.[year] ?? {};
    const rows = [
      { key: 'plata', label: 'Plata', plan: yb.income?.plata ?? [] },
      { key: 'bonus', label: 'Bonus / Ostalo', plan: yb.income?.bonus ?? [] },
      ...(yb.income?.extra ?? []).map((r) => ({ key: r.id, label: r.name, plan: r.amounts })),
    ];
    return rows.map((row) => ({
      ...row,
      actual: Array.from({ length: 12 }, (_, m) => forYear[row.key]?.[m] ?? row.plan?.[m] ?? null),
    }));
  }, [yb, data.actualIncome, year]);

  const funds = yb?.funds ?? [];
  const spendingRows = funds.filter((f) => !isSavingsFund(f)).map((f) => {
    const mapped = yearMaps[f.id] ?? [];
    return { fund: f, mapped, actual: fundActuals(f, mapped, byMonth) };
  });
  const savingsRows = funds.filter(isSavingsFund).map((f) => ({
    fund: f,
    actual: fundActuals(f, [], byMonth),
  }));

  // Only the *spending* funds' mappings count as "tracked" here. A savings fund
  // can still carry a stale mapping from before its 💰 flag was switched on, and
  // its row shows confirmations rather than expenses — so passing the whole
  // yearMaps would treat those categories as accounted for while no row in the
  // grid actually shows them, and the spending would vanish from the page.
  const spendingMaps = Object.fromEntries(spendingRows.map((r) => [r.fund.id, r.mapped]));
  const unmapped = unmappedSpend(byMonth, monthTotals, spendingMaps);

  const cols = Array.from({ length: 12 }, (_, i) => i);
  // A column nobody set stays null so it renders '—'. Summing straight to 0
  // would claim "planned nothing, got nothing" about a month never touched.
  const perMonth = (rows, pick) =>
    cols.map((m) => {
      let has = false;
      let total = 0;
      for (const r of rows) {
        const v = pick(r)?.[m];
        if (v != null) { has = true; total += v; }
      }
      return has ? total : null;
    });

  const incomeActual = perMonth(incomeRows, (r) => r.actual);
  const incomePlan = perMonth(incomeRows, (r) => r.plan);
  const spendPlan = perMonth(spendingRows, (r) => r.fund.amounts);
  const savingsActual = perMonth(savingsRows, (r) => r.actual);
  const savingsPlan = perMonth(savingsRows, (r) => r.fund.amounts);

  // Actual spending is every expense in the month, not just the tracked ones —
  // the Van budžeta row exists so that difference is visible rather than lost.
  const spendActual = monthTotals;
  const num = (v) => v ?? 0;
  const balanceActual = cols.map((m) => num(incomeActual[m]) - num(spendActual[m]) - num(savingsActual[m]));
  const balancePlan = cols.map((m) => num(incomePlan[m]) - num(spendPlan[m]) - num(savingsPlan[m]));

  if (!yb || (funds.length === 0 && incomeRows.every((r) => (r.plan ?? []).every((v) => v == null)))) {
    return (
      <div className="budget lgo">
        <div className="budget__head">
          <div className="budget__head-text">
            <div className="budget__title">Live godišnji pregled</div>
          </div>
          <div className="lgo__year-nav">
            <button className="budget__year-nav" onClick={() => setYear((y) => y - 1)} aria-label="Prethodna godina">‹</button>
            <div className="lgo__year">{year}</div>
            <button className="budget__year-nav" onClick={() => setYear((y) => y + 1)} aria-label="Sledeća godina">›</button>
          </div>
        </div>
        <div className="lgo__empty">
          Za {year} još nema budžeta. Isplaniraj godinu na stranici <strong>Budžet</strong> —
          ovde se onda vidi kako stvarno stanje stoji u odnosu na taj plan.
          <div>
            <button className="btn btn--primary btn--sm" onClick={() => navigateTo('budget')}>
              Otvori Budžet
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="budget lgo">
      <div className="budget__head">
        <div className="budget__head-text">
          <div className="budget__title">Live godišnji pregled</div>
          <div className="budget__hint">
            Plan iz budžeta naspram onoga što se stvarno dogodilo. Budžet se ovde ne menja.
          </div>
        </div>
        <div className="lgo__year-nav">
          <button className="budget__year-nav" onClick={() => setYear((y) => y - 1)} aria-label="Prethodna godina">‹</button>
          <div className="lgo__year">{year}</div>
          <button className="budget__year-nav" onClick={() => setYear((y) => y + 1)} aria-label="Sledeća godina">›</button>
        </div>
      </div>

      <div className="budget__summary">
        <SummaryCard
          label={ytdLabel('Prihodi', elapsed)}
          actual={sumThrough(incomeActual, elapsed)}
          planned={sumThrough(incomePlan, elapsed)}
          higherIsBetter
        />
        <SummaryCard
          label={ytdLabel('Potrošnja', elapsed)}
          actual={sumThrough(spendActual, elapsed)}
          planned={sumThrough(spendPlan, elapsed)}
          higherIsBetter={false}
        />
        <SummaryCard
          label={ytdLabel('Štednja', elapsed)}
          actual={sumThrough(savingsActual, elapsed)}
          planned={sumThrough(savingsPlan, elapsed)}
          higherIsBetter
        />
      </div>

      <div className="budget__hint" style={{ marginBottom: -4 }}>
        Gornji broj je stvarno stanje, donji plan · klikni na mesec da otvoriš njegove troškove ·
        prihod se može ručno ispraviti, sve ostalo se računa iz unetih troškova i odvajanja
      </div>

      <div className="budget__scroll">
        <table className="bg">
          <thead>
            <tr>
              <th className="bg__th bg__label-col">Stavka</th>
              {cols.map((m) => (
                <th key={m} className={`bg__th bg__month-head ${m === currentMonth ? 'bg__col--current' : ''}`}>
                  <button
                    type="button"
                    className="lgo__month-btn"
                    aria-label={`Otvori ${MONTHS_SR[m]} ${year}`}
                    onClick={() => navigateTo('month', year, m)}
                  >
                    {MONTHS_SR_SHORT[m]}
                  </button>
                </th>
              ))}
              <th className="bg__th bg__total-head">Ukupno (do sada)</th>
            </tr>
          </thead>

          <tbody>
            <tr className="bg__section-row"><td colSpan={14} className="bg__section-label">PRIHODI</td></tr>
            {incomeRows.map((row) => (
              <OverviewRow
                key={row.key}
                label={row.label}
                plan={row.plan}
                actual={row.actual}
                elapsed={elapsed}
                currentMonth={currentMonth}
                higherIsBetter
                editable={{
                  year,
                  overrideOf: (m) => overrides[row.key]?.[m] ?? null,
                  onSave: (m, v) => setActualIncome(year, row.key, m, v),
                }}
              />
            ))}
            <OverviewRow
              label="Ukupno prihodi"
              plan={incomePlan}
              actual={incomeActual}
              elapsed={elapsed}
              currentMonth={currentMonth}
              higherIsBetter
              rowClass="bg__subtotal-row"
            />

            <tr className="bg__section-row"><td colSpan={14} className="bg__section-label">RASHODI / FONDOVI</td></tr>
            {spendingRows.map(({ fund, mapped, actual }) => (
              <OverviewRow
                key={fund.id}
                label={fund.name}
                labelHint={mapped.length === 0 ? 'nema kategorija' : null}
                plan={fund.amounts}
                actual={actual}
                elapsed={elapsed}
                currentMonth={currentMonth}
                higherIsBetter={false}
              />
            ))}
            {/* Without this row the grid quietly under-reports: everything spent
                on a category no fund maps would simply not appear anywhere. */}
            <OverviewRow
              label="Van budžeta"
              labelHint="nije ni u jednom fondu"
              plan={null}
              actual={unmapped}
              elapsed={elapsed}
              currentMonth={currentMonth}
              higherIsBetter={false}
              rowClass="lgo__row--unmapped"
            />
            <OverviewRow
              label="Ukupno rashodi"
              plan={spendPlan}
              actual={spendActual}
              elapsed={elapsed}
              currentMonth={currentMonth}
              higherIsBetter={false}
              rowClass="bg__subtotal-row"
            />

            {savingsRows.length > 0 && (
              <>
                <tr className="bg__section-row"><td colSpan={14} className="bg__section-label">ŠTEDNJA</td></tr>
                {savingsRows.map(({ fund, actual }) => (
                  <OverviewRow
                    key={fund.id}
                    label={fund.name}
                    plan={fund.amounts}
                    actual={actual}
                    elapsed={elapsed}
                    currentMonth={currentMonth}
                    higherIsBetter
                    rowClass="bg__row--savings"
                  />
                ))}
                <OverviewRow
                  label="Ukupno štednja"
                  plan={savingsPlan}
                  actual={savingsActual}
                  elapsed={elapsed}
                  currentMonth={currentMonth}
                  higherIsBetter
                  rowClass="bg__subtotal-row"
                />
              </>
            )}

            <OverviewRow
              label="BILANS"
              plan={balancePlan}
              actual={balanceActual}
              elapsed={elapsed}
              currentMonth={currentMonth}
              higherIsBetter
              rowClass="bg__balance-row"
            />
          </tbody>
        </table>
      </div>
    </div>
  );
}
