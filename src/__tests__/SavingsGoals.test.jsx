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
    deleteSavingsGoal,
    showToast: vi.fn(),
    ...ctxOverrides,
  };
  render(
    <AppContext.Provider value={ctx}>
      <SavingsGoals />
    </AppContext.Provider>
  );
  return { addSavingsGoal, deleteSavingsGoal };
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
    // fund has 3 months × 10000 = 30000, target = 30000 → 100%
    expect(screen.getByText(/100%/)).toBeInTheDocument();
  });

  test('shows fund name for linked goal', () => {
    renderGoals({ savingsGoals: [linkedGoal], budget: BUDGET });
    expect(screen.getByText(/Godišnji odmor/)).toBeInTheDocument();
  });

  test('delete requires two clicks', async () => {
    const user = userEvent.setup();
    const { deleteSavingsGoal } = renderGoals({ savingsGoals: [unlinkedGoal] });
    const delBtn = screen.getByTitle(/obriši cilj/i);
    await user.click(delBtn);
    expect(deleteSavingsGoal).not.toHaveBeenCalled();
    await user.click(screen.getByTitle(/potvrdi brisanje/i));
    expect(deleteSavingsGoal).toHaveBeenCalledWith('g1');
  });
});
