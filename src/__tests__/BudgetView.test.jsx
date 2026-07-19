import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppContext } from '../App.jsx';
import BudgetView from '../components/BudgetView.jsx';

const YEAR = new Date().getFullYear();
const FUND_ID = 'fund-1';
const FUND_ID_2 = 'fund-2';

const BASE_FUND = { id: FUND_ID, name: 'Mesečni rashodi', amounts: Array(12).fill(null) };
const FUND_2 = { id: FUND_ID_2, name: 'Štednja', amounts: Array(12).fill(null) };

function makeBudget(funds = [BASE_FUND]) {
  return {
    [YEAR]: {
      income: { plata: Array(12).fill(null), bonus: Array(12).fill(null) },
      funds,
    },
  };
}

function renderBudgetView(dataOverrides = {}) {
  const updateTrackingMap = vi.fn();
  const ctx = {
    data: {
      expenses: [],
      categories: ['Hrana', 'Transport', 'Zabava'],
      budget: makeBudget(),
      trackingMaps: {},
      recurrings: [],
      monthlyNotes: {},
      savingsGoals: [],
      ...dataOverrides,
    },
    updateBudgetIncome: vi.fn(),
    updateBudgetFund: vi.fn(),
    addBudgetFund: vi.fn(),
    removeBudgetFund: vi.fn(),
    renameBudgetFund: vi.fn(),
    reorderBudgetFunds: vi.fn(),
    copyBudgetToYear: vi.fn(),
    importBudgetData: vi.fn(),
    showToast: vi.fn(),
    updateTrackingMap,
  };
  render(
    <AppContext.Provider value={ctx}>
      <BudgetView />
    </AppContext.Provider>
  );
  return { updateTrackingMap };
}

describe('BudgetView — category chip', () => {
  test('renders a chip for each fund row', () => {
    renderBudgetView({ budget: makeBudget([BASE_FUND, FUND_2]) });
    expect(screen.getAllByTitle('Kategorije troškova za ovaj fond')).toHaveLength(2);
  });

  test('chip shows mapped category count when categories are already linked', () => {
    renderBudgetView({
      trackingMaps: { [YEAR]: { [FUND_ID]: ['Hrana', 'Transport'] } },
    });
    expect(screen.getByRole('button', { name: '📂 2' })).toBeInTheDocument();
  });

  test('chip shows no count when no categories are linked', () => {
    renderBudgetView();
    expect(screen.getByRole('button', { name: '📂' })).toBeInTheDocument();
  });
});

describe('BudgetView — inline tracking panel', () => {
  test('clicking chip opens the panel and shows all category pills', async () => {
    const user = userEvent.setup();
    renderBudgetView();
    await user.click(screen.getByTitle('Kategorije troškova za ovaj fond'));
    expect(screen.getByRole('button', { name: /hrana/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /transport/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /zabava/i })).toBeInTheDocument();
  });

  test('chip title changes to "Sakrij kategorije" when panel is open', async () => {
    const user = userEvent.setup();
    renderBudgetView();
    await user.click(screen.getByTitle('Kategorije troškova za ovaj fond'));
    expect(screen.getByTitle('Sakrij kategorije')).toBeInTheDocument();
  });

  test('clicking chip again collapses the panel', async () => {
    const user = userEvent.setup();
    renderBudgetView();
    await user.click(screen.getByTitle('Kategorije troškova za ovaj fond'));
    expect(screen.getByRole('button', { name: /hrana/i })).toBeInTheDocument();
    await user.click(screen.getByTitle('Sakrij kategorije'));
    expect(screen.queryByRole('button', { name: /hrana/i })).not.toBeInTheDocument();
  });

  test('opening a second fund panel closes the first', async () => {
    const user = userEvent.setup();
    renderBudgetView({ budget: makeBudget([BASE_FUND, FUND_2]) });
    const [chip1, chip2] = screen.getAllByTitle('Kategorije troškova za ovaj fond');
    await user.click(chip1);
    expect(screen.getByTitle('Sakrij kategorije')).toBeInTheDocument();
    await user.click(chip2);
    expect(screen.getAllByTitle('Sakrij kategorije')).toHaveLength(1);
  });

  test('shows "Nema kategorija" message when no expense categories exist', async () => {
    const user = userEvent.setup();
    renderBudgetView({ categories: [] });
    await user.click(screen.getByTitle('Kategorije troškova za ovaj fond'));
    expect(screen.getByText(/nema kategorija/i)).toBeInTheDocument();
  });
});

describe('BudgetView — pill interaction', () => {
  test('clicking an unmapped pill calls updateTrackingMap to add it', async () => {
    const user = userEvent.setup();
    const { updateTrackingMap } = renderBudgetView();
    await user.click(screen.getByTitle('Kategorije troškova za ovaj fond'));
    await user.click(screen.getByRole('button', { name: /hrana/i }));
    expect(updateTrackingMap).toHaveBeenCalledWith(YEAR, FUND_ID, ['Hrana']);
  });

  test('clicking a mapped pill calls updateTrackingMap to remove it', async () => {
    const user = userEvent.setup();
    const { updateTrackingMap } = renderBudgetView({
      trackingMaps: { [YEAR]: { [FUND_ID]: ['Hrana'] } },
    });
    await user.click(screen.getByTitle('Kategorije troškova za ovaj fond'));
    await user.click(screen.getByRole('button', { name: /hrana/i }));
    expect(updateTrackingMap).toHaveBeenCalledWith(YEAR, FUND_ID, []);
  });

  test('mapped category pill shows a check indicator', async () => {
    const user = userEvent.setup();
    renderBudgetView({
      trackingMaps: { [YEAR]: { [FUND_ID]: ['Hrana'] } },
    });
    await user.click(screen.getByTitle('Kategorije troškova za ovaj fond'));
    expect(screen.getByText(/✓/)).toBeInTheDocument();
  });
});
