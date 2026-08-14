import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppContext } from '../App.jsx';
import LiveOverview from '../components/LiveOverview.jsx';

// Pinned so "how much of the year has happened?" is a fact and not the clock.
// August of the current year: months 0–7 are real, 8–11 are still the future.
const NOW = new Date('2026-08-15T12:00:00');
const YEAR = 2026;
const ELAPSED = 8;

// Differing months on purpose — a row that read the wrong month would pass
// against a flat Array(12).fill(x).
const plan = (...pairs) => {
  const arr = Array(12).fill(null);
  pairs.forEach(([i, v]) => { arr[i] = v; });
  return arr;
};
const flatPlan = (v) => Array(12).fill(v);

const spendFund = (overrides = {}) => ({
  id: 'f-spend', name: 'Hrana', amounts: flatPlan(500), ...overrides,
});
const saveFund = (overrides = {}) => ({
  id: 'f-save', name: 'Putovanje', amounts: flatPlan(200), kind: 'savings', ...overrides,
});

const expense = (date, amount, category) => ({
  id: `${date}-${category}-${amount}`, title: 'X', date, amount, category, note: '',
});

function renderOverview({
  funds = [spendFund()],
  income = { plata: flatPlan(2000), bonus: Array(12).fill(null) },
  trackingMaps = { [YEAR]: { 'f-spend': ['Hrana'] } },
  expenses = [],
  actualIncome = {},
  budget,
} = {}) {
  const navigateTo = vi.fn();
  const setActualIncome = vi.fn();
  const ctx = {
    data: {
      expenses,
      categories: ['Hrana', 'Grickalice', 'Pokloni'],
      budget: budget ?? { [YEAR]: { income, funds } },
      actualIncome,
      trackingMaps,
      recurrings: [],
      monthlyNotes: {},
      savingsGoals: [],
    },
    navigateTo,
    setActualIncome,
  };
  const { container } = render(
    <AppContext.Provider value={ctx}>
      <LiveOverview />
    </AppContext.Provider>
  );
  return { container, navigateTo, setActualIncome };
}

// The grid cells carry no role, so rows are scoped by testid and read directly.
function cellsOf(label) {
  const row = screen.getByTestId(`lgo-row-${label}`);
  return [...row.querySelectorAll('.lgo-cell')].map((td) => ({
    actual: td.querySelector('.lgo-cell__actual').textContent,
    plan: td.querySelector('.lgo-cell__plan').textContent,
    status: [...td.classList].find((c) => c.startsWith('lgo-cell--'))?.replace('lgo-cell--', ''),
  }));
}

function totalOf(label) {
  const td = screen.getByTestId(`lgo-row-${label}`).querySelector('.lgo-total');
  return {
    actual: td.querySelector('.lgo-cell__actual').textContent,
    plan: td.querySelector('.lgo-cell__plan').textContent,
    status: [...td.classList].find((c) => c.startsWith('lgo-total--'))?.replace('lgo-total--', ''),
  };
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('when there is nothing to compare against', () => {
  test('a year with no budget points at the Budžet page instead of rendering a blank grid', async () => {
    const user = userEvent.setup();
    const { navigateTo } = renderOverview({ budget: {} });
    expect(screen.getByText(/još nema budžeta/i)).toBeInTheDocument();
    expect(screen.queryByTestId('lgo-row-Hrana')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /otvori budžet/i }));
    expect(navigateTo).toHaveBeenCalledWith('budget');
  });
});

describe('spending rows', () => {
  test('a month cell sums the expenses in the fund\'s mapped categories over its plan', () => {
    renderOverview({
      trackingMaps: { [YEAR]: { 'f-spend': ['Hrana', 'Grickalice'] } },
      expenses: [
        expense('2026-01-05', 620, 'Hrana'),
        expense('2026-01-20', 100, 'Grickalice'),
        expense('2026-02-02', 300, 'Hrana'),
      ],
    });
    const cells = cellsOf('Hrana');
    expect(cells[0].actual).toBe('720');
    expect(cells[0].plan).toBe('/ 500');
    expect(cells[1].actual).toBe('300');
  });

  test('over plan flags, but under plan does not read as a win', () => {
    renderOverview({
      expenses: [expense('2026-01-05', 700, 'Hrana'), expense('2026-02-05', 300, 'Hrana')],
    });
    const cells = cellsOf('Hrana');
    expect(cells[0].status).toBe('behind');
    // The vacation may simply not have happened yet — spending under plan is
    // unremarkable, and colouring it green would claim otherwise.
    expect(cells[1].status).toBe('onTrack');
  });

  test('a fund with no mapped categories says so rather than reporting zero spend', () => {
    renderOverview({ trackingMaps: { [YEAR]: {} } });
    const cells = cellsOf('Hrana');
    expect(cells[0].actual).toBe('—');
    expect(cells[0].status).toBe('unset');
    expect(screen.getByText(/nema kategorija/i)).toBeInTheDocument();
  });
});

describe('savings rows', () => {
  test('the actual is what was confirmed, not what was spent', () => {
    const contributions = plan([0, 200], [1, 100]);
    renderOverview({
      funds: [saveFund({ contributions })],
      // A category still mapped from before the 💰 flag was switched on. It
      // must not be read as this fund's reality.
      trackingMaps: { [YEAR]: { 'f-save': ['Hrana'] } },
      expenses: [expense('2026-01-05', 9999, 'Hrana')],
    });
    const cells = cellsOf('Putovanje');
    expect(cells[0].actual).toBe('200');
    expect(cells[1].actual).toBe('100');
  });

  test('under plan is behind on a savings row — the scale is inverted', () => {
    renderOverview({ funds: [saveFund({ contributions: plan([0, 100], [1, 200], [2, 300]) })] });
    const cells = cellsOf('Putovanje');
    expect(cells[0].status).toBe('behind');
    expect(cells[1].status).toBe('onTrack');
    expect(cells[2].status).toBe('ahead');
  });

  test('a confirmed zero is a real answer, an unconfirmed month is not', () => {
    renderOverview({ funds: [saveFund({ contributions: plan([0, 0]) })] });
    const cells = cellsOf('Putovanje');
    expect(cells[0].actual).toBe('0');
    expect(cells[0].status).toBe('behind');
    expect(cells[1].actual).toBe('—');
    expect(cells[1].status).toBe('unset');
  });
});

describe('spending outside the budget', () => {
  test('an expense in a category no fund maps shows up in Van budžeta', () => {
    renderOverview({
      expenses: [expense('2026-01-05', 400, 'Hrana'), expense('2026-01-06', 40, 'Pokloni')],
    });
    expect(cellsOf('Van budžeta')[0].actual).toBe('40');
    expect(cellsOf('Hrana')[0].actual).toBe('400');
  });

  // Counting it in both fund rows is deliberate; subtracting it twice here
  // would push this row negative and stop the column adding up.
  // A savings fund's row shows confirmations, not expenses, so its (possibly
  // stale) mapping accounts for nothing on screen. Treating it as "tracked"
  // would make that spending disappear from the page entirely.
  test('spending mapped only to a savings fund still shows up as untracked', () => {
    renderOverview({
      funds: [spendFund(), saveFund()],
      trackingMaps: { [YEAR]: { 'f-spend': ['Hrana'], 'f-save': ['Pokloni'] } },
      expenses: [expense('2026-01-05', 400, 'Hrana'), expense('2026-01-06', 40, 'Pokloni')],
    });
    expect(cellsOf('Van budžeta')[0].actual).toBe('40');
  });

  test('a category mapped to two funds is subtracted only once', () => {
    renderOverview({
      funds: [spendFund(), spendFund({ id: 'f-2', name: 'Kućni' })],
      trackingMaps: { [YEAR]: { 'f-spend': ['Hrana'], 'f-2': ['Hrana', 'Grickalice'] } },
      expenses: [expense('2026-01-05', 400, 'Hrana'), expense('2026-01-06', 40, 'Pokloni')],
    });
    expect(cellsOf('Van budžeta')[0].actual).toBe('40');
  });
});

describe('income rows', () => {
  test('a month with no override shows the planned figure', () => {
    renderOverview({ income: { plata: plan([0, 2000]), bonus: Array(12).fill(null) } });
    const cells = cellsOf('Plata');
    expect(cells[0].actual).toBe('2.000');
    expect(cells[0].plan).toBe('/ 2.000');
    expect(cells[0].status).toBe('onTrack');
  });

  test('an override replaces the plan for that month and flags the variance', () => {
    renderOverview({
      income: { plata: flatPlan(2000), bonus: Array(12).fill(null) },
      actualIncome: { [YEAR]: { plata: plan([0, 2300]) } },
    });
    const cells = cellsOf('Plata');
    expect(cells[0].actual).toBe('2.300');
    expect(cells[0].plan).toBe('/ 2.000');
    expect(cells[0].status).toBe('ahead');
    // Untouched months still read straight off the plan.
    expect(cells[1].actual).toBe('2.000');
    expect(cells[1].status).toBe('onTrack');
  });

  test('typing an amount records it against that row and month', async () => {
    const user = userEvent.setup();
    const { setActualIncome } = renderOverview();
    await user.click(screen.getByRole('button', { name: /stvarni prihod za plata, januar 2026/i }));
    const input = screen.getByLabelText(/stvarni prihod za plata, januar 2026/i);
    await user.clear(input);
    await user.type(input, '2300{Enter}');
    expect(setActualIncome).toHaveBeenCalledWith(YEAR, 'plata', 0, 2300);
  });

  // Clearing the field is the whole revert mechanism — null means "no override,
  // show the plan", so the budget never has to be edited to undo a correction.
  test('emptying the field reverts the month to the plan', async () => {
    const user = userEvent.setup();
    const { setActualIncome } = renderOverview({
      actualIncome: { [YEAR]: { plata: plan([0, 2300]) } },
    });
    await user.click(screen.getByRole('button', { name: /stvarni prihod za plata, januar 2026/i }));
    const input = screen.getByLabelText(/stvarni prihod za plata, januar 2026/i);
    await user.clear(input);
    await user.type(input, '{Enter}');
    expect(setActualIncome).toHaveBeenCalledWith(YEAR, 'plata', 0, null);
  });

  test('a custom income row is editable under its own id', async () => {
    const user = userEvent.setup();
    const { setActualIncome } = renderOverview({
      income: {
        plata: flatPlan(2000),
        bonus: Array(12).fill(null),
        extra: [{ id: 'inc-1', name: 'Honorar', amounts: flatPlan(300) }],
      },
    });
    await user.click(screen.getByRole('button', { name: /stvarni prihod za honorar, mart 2026/i }));
    const input = screen.getByLabelText(/stvarni prihod za honorar, mart 2026/i);
    await user.clear(input);
    await user.type(input, '450{Enter}');
    expect(setActualIncome).toHaveBeenCalledWith(YEAR, 'inc-1', 2, 450);
  });

  test('nothing on the page can write to the budget itself', () => {
    const { setActualIncome } = renderOverview();
    // The only action the view is given is the override one — no budget writer
    // is in scope, so the plan cannot be edited from here even by accident.
    expect(typeof setActualIncome).toBe('function');
    expect(screen.queryByRole('button', { name: /kopiraj u/i })).not.toBeInTheDocument();
  });
});

describe('months that have not happened yet', () => {
  test('a future month shows its plan and no actual, and is never graded', () => {
    renderOverview({ expenses: [expense('2026-01-05', 700, 'Hrana')] });
    const cells = cellsOf('Hrana');
    expect(cells[ELAPSED - 1].status).not.toBe('future');
    // Without this, every remaining month of the year reads as a 500 saving.
    expect(cells[ELAPSED].actual).toBe('—');
    expect(cells[ELAPSED].plan).toBe('/ 500');
    expect(cells[ELAPSED].status).toBe('future');
    expect(cells[11].status).toBe('future');
  });
});

describe('the year-to-date column', () => {
  // Eight months of actuals against twelve months of plan would report every
  // row in the app as comfortably under budget in August.
  test('compares against the plan through the elapsed months only', () => {
    renderOverview({ expenses: [expense('2026-01-05', 400, 'Hrana')] });
    const total = totalOf('Hrana');
    expect(total.actual).toBe('400');
    expect(total.plan).toBe('/ 4.000'); // 8 × 500, not 12 × 500
  });

  test('a fund that is over plan for the year so far reads as behind', () => {
    renderOverview({
      expenses: [expense('2026-01-05', 3000, 'Hrana'), expense('2026-02-05', 2000, 'Hrana')],
    });
    expect(totalOf('Hrana').status).toBe('behind');
  });
});

describe('drilling into a month', () => {
  test('a month header opens that month', async () => {
    const user = userEvent.setup();
    const { navigateTo } = renderOverview();
    await user.click(screen.getByRole('button', { name: /otvori mart 2026/i }));
    expect(navigateTo).toHaveBeenCalledWith('month', YEAR, 2);
  });
});
