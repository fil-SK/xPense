import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppContext } from '../App.jsx';
import Home from '../components/Home.jsx';

function renderHome(ctxOverrides = {}) {
  const navigateTo = vi.fn();
  const ctx = {
    data: {
      expenses: [],
      categories: ['Hrana'],
      budget: {},
      trackingMaps: {},
      recurrings: [],
      monthlyNotes: {},
      savingsGoals: [],
    },
    navigateTo,
    importData: vi.fn(),
    showToast: vi.fn(),
    deleteRecurring: vi.fn(),
    addSavingsGoal: vi.fn(),
    deleteSavingsGoal: vi.fn(),
    ...ctxOverrides,
  };
  render(
    <AppContext.Provider value={ctx}>
      <Home />
    </AppContext.Provider>
  );
  return { navigateTo };
}

describe('Home — quick-add button', () => {
  test('renders the circular add button', () => {
    renderHome();
    expect(screen.getByRole('button', { name: /dodaj trošak/i })).toBeInTheDocument();
  });

  test('clicking add button opens the expense modal', async () => {
    const user = userEvent.setup();
    renderHome();
    await user.click(screen.getByRole('button', { name: /dodaj trošak/i }));
    expect(screen.getByText('Novi trošak')).toBeInTheDocument();
  });

  test('modal closes when ✕ is clicked', async () => {
    const user = userEvent.setup();
    renderHome();
    await user.click(screen.getByRole('button', { name: /dodaj trošak/i }));
    await user.click(screen.getByRole('button', { name: '✕' }));
    expect(screen.queryByText('Novi trošak')).not.toBeInTheDocument();
  });
});

describe('Home — removed Prethodne action card', () => {
  test('does not render Pogledaj prethodne potrošnje card', () => {
    renderHome();
    expect(screen.queryByText(/pogledaj prethodne/i)).not.toBeInTheDocument();
  });

  test('still renders current month action card', () => {
    renderHome();
    expect(screen.getByText(/potrošnja ovog meseca/i)).toBeInTheDocument();
  });

  test('still renders budget action card', () => {
    renderHome();
    expect(screen.getByText(/budžet/i)).toBeInTheDocument();
  });
});
