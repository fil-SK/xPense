import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppContext } from '../App.jsx';
import GlobalSearch from '../components/GlobalSearch.jsx';

const CATEGORIES = ['Hrana', 'Transport', 'Zabava'];

const SAMPLE_EXPENSES = [
  { id: '1', title: 'Kafa i čaj', category: 'Hrana', date: '2025-03-05', amount: 350, note: '' },
  { id: '2', title: 'Taksi', category: 'Transport', date: '2025-02-10', amount: 800, note: 'aerodrom' },
  { id: '3', title: 'Netflix', category: 'Zabava', date: '2025-01-01', amount: 1000, note: '', recurringId: 'r1' },
];

function renderSearch(expenses = [], overrides = {}) {
  const navigateTo = vi.fn();
  const ctx = {
    data: { expenses, categories: CATEGORIES, budget: {}, trackingMaps: {}, recurrings: [] },
    navigateTo,
    ...overrides,
  };
  render(
    <AppContext.Provider value={ctx}>
      <GlobalSearch />
    </AppContext.Provider>
  );
  return { navigateTo };
}

describe('GlobalSearch', () => {
  test('renders search input and page title', () => {
    renderSearch();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByText(/pretraga troškova/i)).toBeInTheDocument();
  });

  test('shows empty-state message when query is blank', () => {
    renderSearch(SAMPLE_EXPENSES);
    expect(screen.getByText(/unesite pojam/i)).toBeInTheDocument();
  });

  test('filters expenses by title (case-insensitive)', async () => {
    const user = userEvent.setup();
    renderSearch(SAMPLE_EXPENSES);
    await user.type(screen.getByRole('textbox'), 'kafa');
    expect(screen.getByText('Kafa i čaj')).toBeInTheDocument();
    expect(screen.queryByText('Taksi')).not.toBeInTheDocument();
    expect(screen.queryByText('Netflix')).not.toBeInTheDocument();
  });

  test('filters expenses by category', async () => {
    const user = userEvent.setup();
    renderSearch(SAMPLE_EXPENSES);
    await user.type(screen.getByRole('textbox'), 'transport');
    expect(screen.getByText('Taksi')).toBeInTheDocument();
    expect(screen.queryByText('Kafa i čaj')).not.toBeInTheDocument();
  });

  test('filters expenses by note', async () => {
    const user = userEvent.setup();
    renderSearch(SAMPLE_EXPENSES);
    await user.type(screen.getByRole('textbox'), 'aerodrom');
    expect(screen.getByText('Taksi')).toBeInTheDocument();
    expect(screen.queryByText('Netflix')).not.toBeInTheDocument();
  });

  test('shows result count when query matches', async () => {
    const user = userEvent.setup();
    renderSearch(SAMPLE_EXPENSES);
    await user.type(screen.getByRole('textbox'), 'a');
    expect(screen.getByText(/rezultat/i)).toBeInTheDocument();
  });

  test('shows "no results" message for unmatched query', async () => {
    const user = userEvent.setup();
    renderSearch(SAMPLE_EXPENSES);
    await user.type(screen.getByRole('textbox'), 'zzznematoga');
    expect(screen.getByText(/nema rezultata/i)).toBeInTheDocument();
  });

  test('clicking a result navigates to the correct month', async () => {
    const user = userEvent.setup();
    const { navigateTo } = renderSearch(SAMPLE_EXPENSES);
    await user.type(screen.getByRole('textbox'), 'Taksi');
    await user.click(screen.getByText('Taksi').closest('.expense-item'));
    // Taksi date: 2025-02-10 → year 2025, month index 1 (February)
    expect(navigateTo).toHaveBeenCalledWith('month', 2025, 1);
  });

  test('back button navigates to home', async () => {
    const user = userEvent.setup();
    const { navigateTo } = renderSearch(SAMPLE_EXPENSES);
    await user.click(screen.getByTitle(/nazad/i));
    expect(navigateTo).toHaveBeenCalledWith('home');
  });

  test('recurring badge is shown for recurring expenses', async () => {
    const user = userEvent.setup();
    renderSearch(SAMPLE_EXPENSES);
    await user.type(screen.getByRole('textbox'), 'Netflix');
    // Netflix has recurringId so 🔄 badge should appear
    expect(screen.getAllByTitle(/ponavljajući/i).length).toBeGreaterThan(0);
  });
});
