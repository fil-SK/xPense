import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppContext } from '../App.jsx';
import BudgetView from '../components/BudgetView.jsx';

const YEAR = new Date().getFullYear();
const FUND_ID = 'fund-1';
const FUND_ID_2 = 'fund-2';

const BASE_FUND = { id: FUND_ID, name: 'Mesečni rashodi', amounts: Array(12).fill(null) };
const FUND_2 = { id: FUND_ID_2, name: 'Štednja', amounts: Array(12).fill(null) };

// No `income.extra` key here on purpose — budgets saved before custom income
// rows existed don't have one, and the view has to tolerate that.
function makeBudget(funds = [BASE_FUND], income = {}) {
  return {
    [YEAR]: {
      income: { plata: Array(12).fill(null), bonus: Array(12).fill(null), ...income },
      funds,
    },
  };
}

function renderBudgetView(dataOverrides = {}) {
  const updateTrackingMap = vi.fn();
  const addBudgetIncomeRow = vi.fn();
  const removeBudgetIncomeRow = vi.fn();
  const renameBudgetIncomeRow = vi.fn();
  const updateBudgetIncomeRow = vi.fn();
  const updateBudgetFund = vi.fn();
  const setBudgetFundKind = vi.fn();
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
    updateBudgetFund,
    setBudgetFundKind,
    addBudgetFund: vi.fn(),
    removeBudgetFund: vi.fn(),
    renameBudgetFund: vi.fn(),
    reorderBudgetFunds: vi.fn(),
    copyBudgetToYear: vi.fn(),
    importBudgetData: vi.fn(),
    showToast: vi.fn(),
    updateTrackingMap,
    addBudgetIncomeRow,
    removeBudgetIncomeRow,
    renameBudgetIncomeRow,
    updateBudgetIncomeRow,
  };
  render(
    <AppContext.Provider value={ctx}>
      <BudgetView />
    </AppContext.Provider>
  );
  return {
    updateTrackingMap,
    addBudgetIncomeRow,
    removeBudgetIncomeRow,
    renameBudgetIncomeRow,
    updateBudgetIncomeRow,
    updateBudgetFund,
    setBudgetFundKind,
  };
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

describe('BudgetView — savings toggle', () => {
  const SAVINGS_FUND = { ...FUND_2, name: 'Putovanje', kind: 'savings' };

  test('every fund row carries a 💰 chip named after its fund', () => {
    renderBudgetView({ budget: makeBudget([BASE_FUND, FUND_2]) });
    expect(screen.getByRole('button', { name: 'Fond štednje: Mesečni rashodi' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fond štednje: Štednja' })).toBeInTheDocument();
  });

  test('the chip reports whether the fund is a savings fund', () => {
    renderBudgetView({ budget: makeBudget([BASE_FUND, SAVINGS_FUND]) });
    expect(screen.getByRole('button', { name: 'Fond štednje: Mesečni rashodi' }))
      .toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Fond štednje: Putovanje' }))
      .toHaveAttribute('aria-pressed', 'true');
  });

  test('clicking marks a spending fund as savings', async () => {
    const user = userEvent.setup();
    const { setBudgetFundKind } = renderBudgetView();
    await user.click(screen.getByRole('button', { name: 'Fond štednje: Mesečni rashodi' }));
    expect(setBudgetFundKind).toHaveBeenCalledWith(YEAR, FUND_ID, 'savings');
  });

  test('clicking an already-savings fund switches it back', async () => {
    const user = userEvent.setup();
    const { setBudgetFundKind } = renderBudgetView({ budget: makeBudget([SAVINGS_FUND]) });
    await user.click(screen.getByRole('button', { name: 'Fond štednje: Putovanje' }));
    expect(setBudgetFundKind).toHaveBeenCalledWith(YEAR, FUND_ID_2, null);
  });

  // A savings fund is never compared against expenses, so offering it a
  // category mapping would be a lie.
  test('a savings fund gets no 📂 chip and no tracking panel', () => {
    renderBudgetView({ budget: makeBudget([SAVINGS_FUND]) });
    expect(screen.queryByTitle('Kategorije troškova za ovaj fond')).not.toBeInTheDocument();
  });

  test('a mixed year still offers the 📂 chip on the spending fund', () => {
    renderBudgetView({ budget: makeBudget([BASE_FUND, SAVINGS_FUND]) });
    expect(screen.getAllByTitle('Kategorije troškova za ovaj fond')).toHaveLength(1);
  });
});

describe('BudgetView — confirmed savings in the grid', () => {
  const confirmedFund = (month, value) => {
    const contributions = Array(12).fill(null);
    contributions[month] = value;
    return { ...BASE_FUND, name: 'Putovanje', kind: 'savings', contributions };
  };

  test('a confirmed month is marked, and says how much was set aside', () => {
    renderBudgetView({ budget: makeBudget([confirmedFund(1, 15000)]) });
    expect(screen.getByRole('img', { name: 'Odvojeno: 15.000 RSD' })).toBeInTheDocument();
  });

  test('only the confirmed months are marked', () => {
    renderBudgetView({ budget: makeBudget([confirmedFund(1, 15000)]) });
    expect(screen.getAllByRole('img', { name: /odvojeno:/i })).toHaveLength(1);
  });

  // A confirmed zero is a confirmation; an unconfirmed month is not.
  test('a confirmed zero is marked too', () => {
    renderBudgetView({ budget: makeBudget([confirmedFund(1, 0)]) });
    expect(screen.getByRole('img', { name: 'Odvojeno: 0 RSD' })).toBeInTheDocument();
  });

  test('a spending fund is never marked', () => {
    const withContribs = { ...BASE_FUND, contributions: Array(12).fill(5000) };
    renderBudgetView({ budget: makeBudget([withContribs]) });
    expect(screen.queryByRole('img', { name: /odvojeno:/i })).not.toBeInTheDocument();
  });

  // The ✓ is an adornment, not a replacement — the plan behind it is still the
  // editable cell it always was.
  test('the plan cell stays editable on a confirmed month', async () => {
    const user = userEvent.setup();
    const { updateBudgetFund } = renderBudgetView({ budget: makeBudget([confirmedFund(1, 15000)]) });
    // The February cell — the one carrying the ✓.
    const febCell = document.querySelectorAll('.bg__row--savings .bg__cell .bgc')[1];
    await user.click(febCell);
    const input = document.querySelector('.bgc-input');
    expect(input).not.toBeNull();
    await user.type(input, '25000{Enter}');
    expect(updateBudgetFund).toHaveBeenCalledWith(YEAR, FUND_ID, 1, 25000);
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

describe('BudgetView — custom income rows', () => {
  const HONORAR = { id: 'inc-1', name: 'Honorar', amounts: Array(12).fill(null) };
  const withIncome = (rows) => ({ budget: makeBudget([BASE_FUND], { extra: rows }) });

  test('a budget saved without income.extra still renders the income section', () => {
    renderBudgetView();
    expect(screen.getByText('Plata')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/dodaj prihod/i)).toBeInTheDocument();
  });

  test('renders a row for each custom income source', () => {
    renderBudgetView(withIncome([HONORAR, { ...HONORAR, id: 'inc-2', name: 'Izdavanje' }]));
    expect(screen.getByText('Honorar')).toBeInTheDocument();
    expect(screen.getByText('Izdavanje')).toBeInTheDocument();
  });

  test('Enter in the add field creates the row and clears the input', async () => {
    const user = userEvent.setup();
    const { addBudgetIncomeRow } = renderBudgetView();
    const input = screen.getByPlaceholderText(/dodaj prihod/i);
    await user.type(input, 'Honorar{Enter}');
    expect(addBudgetIncomeRow).toHaveBeenCalledWith(YEAR, 'Honorar');
    expect(input).toHaveValue('');
  });

  test('a blank name adds nothing', async () => {
    const user = userEvent.setup();
    const { addBudgetIncomeRow } = renderBudgetView();
    await user.type(screen.getByPlaceholderText(/dodaj prihod/i), '   {Enter}');
    expect(addBudgetIncomeRow).not.toHaveBeenCalled();
  });

  test('the delete button is named after its row and deletes on the first click', async () => {
    const user = userEvent.setup();
    const { removeBudgetIncomeRow } = renderBudgetView(withIncome([HONORAR]));
    await user.click(screen.getByRole('button', { name: 'Obriši prihod: Honorar' }));
    expect(removeBudgetIncomeRow).toHaveBeenCalledWith(YEAR, 'inc-1');
  });

  test('double-clicking the name opens a rename input, Enter saves', async () => {
    const user = userEvent.setup();
    const { renameBudgetIncomeRow } = renderBudgetView(withIncome([HONORAR]));
    await user.dblClick(screen.getByText('Honorar'));
    const input = screen.getByDisplayValue('Honorar');
    await user.clear(input);
    await user.type(input, 'Freelance{Enter}');
    expect(renameBudgetIncomeRow).toHaveBeenCalledWith(YEAR, 'inc-1', 'Freelance');
  });

  test('editing a month cell saves against that row', async () => {
    const user = userEvent.setup();
    const { updateBudgetIncomeRow } = renderBudgetView(withIncome([HONORAR]));
    await user.click(document.querySelector('.bg__row--income .bgc'));
    await user.type(document.querySelector('.bgc-input'), '5000{Enter}');
    expect(updateBudgetIncomeRow).toHaveBeenCalledWith(YEAR, 'inc-1', 0, 5000);
  });

  test('custom income counts toward the monthly and yearly income totals', () => {
    const plata = Array(12).fill(null);
    plata[0] = 1000;
    const amounts = Array(12).fill(null);
    amounts[0] = 500;
    renderBudgetView({
      budget: makeBudget([BASE_FUND], { plata, extra: [{ ...HONORAR, amounts }] }),
    });
    const total = (1500).toLocaleString('sr-RS');
    // The January subtotal cell and the year total on the subtotal row.
    expect(screen.getAllByText(total).length).toBeGreaterThanOrEqual(2);
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
