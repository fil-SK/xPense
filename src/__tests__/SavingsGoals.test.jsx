import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppContext } from '../App.jsx';
import SavingsGoals from '../components/SavingsGoals.jsx';

const FUND_ID = 'fund-1';
const BUDGET = {
  2025: {
    income: { plata: Array(12).fill(null), bonus: Array(12).fill(null) },
    funds: [{ id: FUND_ID, name: 'Godišnji odmor', amounts: [10000, 10000, 10000, null, null, null, null, null, null, null, null, null] }],
  },
};

function renderGoals(dataOverrides = {}, ctxOverrides = {}) {
  const addSavingsGoal = vi.fn();
  const updateSavingsGoal = vi.fn();
  const deleteSavingsGoal = vi.fn();
  const ctx = {
    data: {
      expenses: [],
      categories: ['Hrana'],
      budget: {},
      trackingMaps: {},
      recurrings: [],
      monthlyNotes: {},
      savingsGoals: [],
      ...dataOverrides,
    },
    addSavingsGoal,
    updateSavingsGoal,
    deleteSavingsGoal,
    showToast: vi.fn(),
    ...ctxOverrides,
  };
  render(
    <AppContext.Provider value={ctx}>
      <SavingsGoals />
    </AppContext.Provider>
  );
  return { addSavingsGoal, updateSavingsGoal, deleteSavingsGoal };
}

describe('SavingsGoals — empty state', () => {
  test('renders section title and add button', () => {
    renderGoals();
    expect(screen.getByText(/ciljevi štednje/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dodaj cilj/i })).toBeInTheDocument();
  });

  test('shows empty-state message when no goals exist', () => {
    renderGoals();
    expect(screen.getByText(/nema postavljenih ciljeva/i)).toBeInTheDocument();
  });

  test('clicking + Dodaj cilj reveals the form', async () => {
    const user = userEvent.setup();
    renderGoals();
    await user.click(screen.getByRole('button', { name: /dodaj cilj/i }));
    expect(screen.getByPlaceholderText(/naziv cilja/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/ciljna suma/i)).toBeInTheDocument();
  });
});

describe('SavingsGoals — add form', () => {
  test('calls addSavingsGoal with correct data on submit', async () => {
    const user = userEvent.setup();
    const { addSavingsGoal } = renderGoals();
    await user.click(screen.getByRole('button', { name: /dodaj cilj/i }));
    await user.type(screen.getByPlaceholderText(/naziv cilja/i), 'Odmor');
    await user.type(screen.getByPlaceholderText(/ciljna suma/i), '100000');
    await user.click(screen.getByRole('button', { name: /^dodaj cilj$/i }));
    expect(addSavingsGoal).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Odmor', target: 100000 })
    );
  });

  test('does not call addSavingsGoal when name is empty', async () => {
    const user = userEvent.setup();
    const { addSavingsGoal } = renderGoals();
    await user.click(screen.getByRole('button', { name: /dodaj cilj/i }));
    await user.type(screen.getByPlaceholderText(/ciljna suma/i), '50000');
    await user.click(screen.getByRole('button', { name: /^dodaj cilj$/i }));
    expect(addSavingsGoal).not.toHaveBeenCalled();
  });

  test('shows fund selector with fund options when budget data exists', async () => {
    const user = userEvent.setup();
    renderGoals({ budget: BUDGET });
    await user.click(screen.getByRole('button', { name: /dodaj cilj/i }));
    expect(screen.getByRole('option', { name: 'Godišnji odmor' })).toBeInTheDocument();
  });
});

describe('SavingsGoals — goal display', () => {
  const unlinkedGoal = { id: 'g1', name: 'Peni fond', target: 50000, fundId: null, year: null };
  const linkedGoal = { id: 'g2', name: 'Letovanje', target: 30000, fundId: FUND_ID, year: 2025 };

  test('renders goal name and amounts', () => {
    renderGoals({ savingsGoals: [unlinkedGoal] });
    expect(screen.getByText('Peni fond')).toBeInTheDocument();
    expect(screen.getByText(/50\.000/)).toBeInTheDocument();
  });

  test('shows 0 / target for unlinked goal', () => {
    renderGoals({ savingsGoals: [unlinkedGoal] });
    expect(screen.getByText(/0%/)).toBeInTheDocument();
  });

  test('calculates progress from linked budget fund', () => {
    renderGoals({ savingsGoals: [linkedGoal], budget: BUDGET });
    // 2025 is a past year, so all twelve months count: 3 × 10000 = 30000 of 30000 → 100%
    expect(screen.getByText(/100%/)).toBeInTheDocument();
  });

  test('shows fund name for linked goal', () => {
    renderGoals({ savingsGoals: [linkedGoal], budget: BUDGET });
    expect(screen.getByText(/Godišnji odmor/)).toBeInTheDocument();
  });

  // The confirm click was replaced by the undo on the toast.
  test('delete fires on the first click', async () => {
    const user = userEvent.setup();
    const { deleteSavingsGoal } = renderGoals({ savingsGoals: [unlinkedGoal] });
    await user.click(screen.getByRole('button', { name: /obriši cilj: peni fond/i }));
    expect(deleteSavingsGoal).toHaveBeenCalledWith('g1');
    expect(deleteSavingsGoal).toHaveBeenCalledTimes(1);
  });
});

// Progress is what the user confirmed setting aside, not what the year plans to
// set aside. Summing the plan used to report a goal as fully saved on the 1st of
// January, on nothing but the user's word that they meant to save it.
describe('SavingsGoals — progress measures confirmed savings', () => {
  const CUR_FUND = 'fund-2026';
  const plannedYear = (contributions) => ({
    2026: {
      income: { plata: Array(12).fill(null), bonus: Array(12).fill(null) },
      funds: [{
        id: CUR_FUND,
        name: 'Letovanje',
        amounts: Array(12).fill(10000),
        kind: 'savings',
        ...(contributions ? { contributions } : {}),
      }],
    },
  });
  const confirmed = (...months) => {
    const arr = Array(12).fill(null);
    months.forEach(([i, v]) => { arr[i] = v; });
    return arr;
  };
  const PLANNED_YEAR = plannedYear();
  const goal = { id: 'g3', name: 'Letovanje', target: 120000, fundId: CUR_FUND, year: 2026 };

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-03-15T12:00:00'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test('the saved line is the sum of the confirmed months', () => {
    const budget = plannedYear(confirmed([0, 10000], [1, 8000]));
    renderGoals({ savingsGoals: [goal], budget });
    expect(screen.getByText(/Ušteđeno: 18\.000 RSD \/ 120\.000 RSD \(15%\)/)).toBeInTheDocument();
  });

  test('a filled-in plan with nothing confirmed reads as nothing saved', () => {
    renderGoals({ savingsGoals: [goal], budget: PLANNED_YEAR });
    expect(screen.getByText(/Ušteđeno: 0 RSD \/ 120\.000 RSD \(0%\)/)).toBeInTheDocument();
  });

  // What the bar used to show is now a line of its own, labelled as the plan.
  test('the elapsed plan is shown as "Očekivano do sada"', () => {
    renderGoals({ savingsGoals: [goal], budget: PLANNED_YEAR });
    expect(screen.getByText(/Očekivano do sada: 30\.000 RSD \(25%\)/)).toBeInTheDocument();
  });

  test('"Očekivano do sada" is hidden when the confirmations match the plan', () => {
    const budget = plannedYear(confirmed([0, 10000], [1, 10000], [2, 10000]));
    renderGoals({ savingsGoals: [goal], budget });
    expect(screen.queryByText(/očekivano do sada/i)).not.toBeInTheDocument();
  });

  test('the rest of the year is still shown, labelled as a plan', () => {
    renderGoals({ savingsGoals: [goal], budget: PLANNED_YEAR });
    expect(screen.getByText(/Po planu do kraja 2026: 120\.000 RSD \(100%\)/)).toBeInTheDocument();
  });

  test('a past year is fully elapsed, so the plan line is dropped', () => {
    renderGoals({ savingsGoals: [{ ...goal, fundId: FUND_ID, year: 2025 }], budget: BUDGET });
    expect(screen.queryByText(/po planu do kraja/i)).not.toBeInTheDocument();
  });

  test('the bar is a progressbar reporting the confirmed amount', () => {
    const budget = plannedYear(confirmed([0, 10000], [1, 8000]));
    renderGoals({ savingsGoals: [goal], budget });
    const bar = screen.getByRole('progressbar', { name: /napredak: letovanje/i });
    expect(bar).toHaveAttribute('aria-valuenow', '15');
    expect(bar).toHaveAttribute('aria-valuetext', expect.stringContaining('Ušteđeno 18.000 RSD'));
  });

  // A 0% bar on a funded goal looks like a bug unless it says what is missing,
  // and the missing step differs by whether the fund is flagged at all.
  test('a savings fund with nothing confirmed points at the month view', () => {
    renderGoals({ savingsGoals: [goal], budget: PLANNED_YEAR });
    expect(screen.getByText(/nema potvrđenih odvajanja/i)).toBeInTheDocument();
  });

  test('a fund that is not flagged as savings points at the 💰 toggle', () => {
    const budget = {
      2026: {
        income: { plata: Array(12).fill(null), bonus: Array(12).fill(null) },
        funds: [{ id: CUR_FUND, name: 'Letovanje', amounts: Array(12).fill(10000) }],
      },
    };
    renderGoals({ savingsGoals: [goal], budget });
    expect(screen.getByText(/nije označen kao fond štednje/i)).toBeInTheDocument();
  });

  test('the explain line is gone once a month is confirmed', () => {
    const budget = plannedYear(confirmed([0, 10000]));
    renderGoals({ savingsGoals: [goal], budget });
    expect(screen.queryByText(/nema potvrđenih odvajanja/i)).not.toBeInTheDocument();
  });

  test('an unlinked goal says why it sits at 0%', () => {
    renderGoals({ savingsGoals: [{ id: 'g4', name: 'Peni fond', target: 50000, fundId: null, year: null }] });
    expect(screen.getByText(/nije povezan sa fondom/i)).toBeInTheDocument();
  });
});

describe('SavingsGoals — accessible form fields', () => {
  test('every field is reachable by its label, not just its placeholder', async () => {
    const user = userEvent.setup();
    renderGoals({ budget: BUDGET });
    await user.click(screen.getByRole('button', { name: /dodaj cilj/i }));
    expect(screen.getByLabelText(/naziv cilja/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/ciljna suma/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^godina$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^fond$/i)).toBeInTheDocument();
  });

  test('Enter in the name field submits the form', async () => {
    const user = userEvent.setup();
    const { addSavingsGoal } = renderGoals();
    await user.click(screen.getByRole('button', { name: /dodaj cilj/i }));
    await user.type(screen.getByLabelText(/ciljna suma/i), '80000');
    await user.type(screen.getByLabelText(/naziv cilja/i), 'Odmor{Enter}');
    expect(addSavingsGoal).toHaveBeenCalledWith(expect.objectContaining({ name: 'Odmor', target: 80000 }));
  });
});

describe('SavingsGoals — edit', () => {
  const linked = { id: 'g2', name: 'Letovanje', target: 30000, fundId: FUND_ID, year: 2025 };

  test('the edit button opens the form pre-filled with the goal', async () => {
    const user = userEvent.setup();
    renderGoals({ savingsGoals: [linked], budget: BUDGET });
    await user.click(screen.getByTitle(/izmeni cilj/i));
    expect(screen.getByText(/^izmeni cilj$/i, { selector: '.goal-form__title' })).toBeInTheDocument();
    expect(screen.getByLabelText(/naziv cilja/i)).toHaveValue('Letovanje');
    expect(screen.getByLabelText(/ciljna suma/i)).toHaveValue(30000);
    expect(screen.getByLabelText(/^fond$/i)).toHaveValue(FUND_ID);
  });

  test('saving calls updateSavingsGoal, not addSavingsGoal', async () => {
    const user = userEvent.setup();
    const { updateSavingsGoal, addSavingsGoal } = renderGoals({ savingsGoals: [linked], budget: BUDGET });
    await user.click(screen.getByTitle(/izmeni cilj/i));
    const targetInput = screen.getByLabelText(/ciljna suma/i);
    await user.clear(targetInput);
    await user.type(targetInput, '45000');
    await user.click(screen.getByRole('button', { name: /sačuvaj izmene/i }));

    expect(updateSavingsGoal).toHaveBeenCalledWith('g2', {
      name: 'Letovanje', target: 45000, fundId: FUND_ID, year: 2025,
    });
    expect(addSavingsGoal).not.toHaveBeenCalled();
    // Form closes and drops back to add mode.
    expect(screen.queryByLabelText(/naziv cilja/i)).not.toBeInTheDocument();
  });

  test('unlinking the fund clears the year too', async () => {
    const user = userEvent.setup();
    const { updateSavingsGoal } = renderGoals({ savingsGoals: [linked], budget: BUDGET });
    await user.click(screen.getByTitle(/izmeni cilj/i));
    await user.selectOptions(screen.getByLabelText(/^fond$/i), '');
    await user.click(screen.getByRole('button', { name: /sačuvaj izmene/i }));
    expect(updateSavingsGoal).toHaveBeenCalledWith('g2', expect.objectContaining({ fundId: null, year: null }));
  });

  // Opening add after an edit must not leave the edited goal's values behind.
  test('cancelling an edit and reopening gives a blank add form', async () => {
    const user = userEvent.setup();
    renderGoals({ savingsGoals: [linked], budget: BUDGET });
    await user.click(screen.getByTitle(/izmeni cilj/i));
    await user.click(screen.getByRole('button', { name: /otkaži/i }));
    await user.click(screen.getByRole('button', { name: /dodaj cilj/i }));
    expect(screen.getByLabelText(/naziv cilja/i)).toHaveValue('');
    expect(screen.getByRole('button', { name: /^dodaj cilj$/i })).toBeInTheDocument();
  });
});
