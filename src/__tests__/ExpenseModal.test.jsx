import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppContext } from '../App.jsx';
import ExpenseModal from '../components/ExpenseModal.jsx';

const DEFAULT_CATEGORIES = ['Hrana', 'Transport', 'Zabava'];

function renderModal(expense = undefined, ctxOverrides = {}) {
  const addExpense = vi.fn();
  const updateExpense = vi.fn();
  const addRecurring = vi.fn();
  const onClose = vi.fn();
  const ctx = {
    data: { expenses: [], categories: DEFAULT_CATEGORIES, budget: {}, trackingMaps: {}, recurrings: [] },
    addExpense,
    updateExpense,
    addRecurring,
    showToast: vi.fn(),
    ...ctxOverrides,
  };
  render(
    <AppContext.Provider value={ctx}>
      <ExpenseModal expense={expense} onClose={onClose} />
    </AppContext.Provider>
  );
  return { addExpense, updateExpense, addRecurring, onClose };
}

// ─── Add mode ────────────────────────────────────────────────────────────────

describe('ExpenseModal — add mode', () => {
  test('renders add form heading and submit button', () => {
    renderModal();
    expect(screen.getByText('Novi trošak')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dodaj trošak/i })).toBeInTheDocument();
  });

  test('shows recurring checkbox only in add mode', () => {
    renderModal();
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
    expect(screen.getByText(/ponavljajući trošak/i)).toBeInTheDocument();
  });

  test('calls addExpense with correct payload on valid submit', async () => {
    const user = userEvent.setup();
    const { addExpense, onClose } = renderModal();
    await user.type(screen.getByPlaceholderText(/npr/i), 'Kafa');
    await user.type(screen.getByRole('spinbutton'), '350');
    await user.click(screen.getByRole('button', { name: /dodaj trošak/i }));
    expect(addExpense).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Kafa', amount: 350, category: 'Hrana' })
    );
    expect(onClose).toHaveBeenCalled();
  });

  test('calls addRecurring (not addExpense) when recurring checkbox is checked', async () => {
    const user = userEvent.setup();
    const { addExpense, addRecurring } = renderModal();
    await user.type(screen.getByPlaceholderText(/npr/i), 'Netflix');
    await user.type(screen.getByRole('spinbutton'), '800');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /dodaj trošak/i }));
    expect(addRecurring).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Netflix', amount: 800, frequency: 'monthly' })
    );
    expect(addExpense).not.toHaveBeenCalled();
  });

  test('shows validation errors on empty submit', async () => {
    const user = userEvent.setup();
    const { addExpense } = renderModal();
    await user.click(screen.getByRole('button', { name: /dodaj trošak/i }));
    expect(screen.getByText(/naslov je obavezan/i)).toBeInTheDocument();
    expect(screen.getByText(/unesite ispravan iznos/i)).toBeInTheDocument();
    expect(addExpense).not.toHaveBeenCalled();
  });

  test('shows amount error for zero amount', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.type(screen.getByPlaceholderText(/npr/i), 'Test');
    await user.type(screen.getByRole('spinbutton'), '0');
    await user.click(screen.getByRole('button', { name: /dodaj trošak/i }));
    expect(screen.getByText(/unesite ispravan iznos/i)).toBeInTheDocument();
  });

  test('Escape key closes the modal', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  test('Cancel button closes the modal', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();
    await user.click(screen.getByRole('button', { name: /otkaži/i }));
    expect(onClose).toHaveBeenCalled();
  });

  test('trims whitespace from title before saving', async () => {
    const user = userEvent.setup();
    const { addExpense } = renderModal();
    await user.type(screen.getByPlaceholderText(/npr/i), '  Kafa  ');
    await user.type(screen.getByRole('spinbutton'), '100');
    await user.click(screen.getByRole('button', { name: /dodaj trošak/i }));
    expect(addExpense).toHaveBeenCalledWith(expect.objectContaining({ title: 'Kafa' }));
  });

  test('rounds non-integer amounts', async () => {
    const user = userEvent.setup();
    const { addExpense } = renderModal();
    await user.type(screen.getByPlaceholderText(/npr/i), 'Roba');
    await user.type(screen.getByRole('spinbutton'), '99.9');
    await user.click(screen.getByRole('button', { name: /dodaj trošak/i }));
    expect(addExpense).toHaveBeenCalledWith(expect.objectContaining({ amount: 100 }));
  });
});

// ─── Edit mode ───────────────────────────────────────────────────────────────

const existingExpense = {
  id: 'e1',
  title: 'Stari trošak',
  date: '2025-03-01',
  amount: 1000,
  category: 'Transport',
  note: 'neka napomena',
};

describe('ExpenseModal — edit mode', () => {
  test('renders edit form with pre-filled values', () => {
    renderModal(existingExpense);
    expect(screen.getByText('Izmeni trošak')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Stari trošak')).toBeInTheDocument();
    expect(screen.getByDisplayValue('1000')).toBeInTheDocument();
    expect(screen.getByDisplayValue('neka napomena')).toBeInTheDocument();
  });

  test('does not show recurring checkbox in edit mode', () => {
    renderModal(existingExpense);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  test('calls updateExpense (not addExpense) on save', async () => {
    const user = userEvent.setup();
    const { updateExpense, addExpense, onClose } = renderModal(existingExpense);
    const titleInput = screen.getByDisplayValue('Stari trošak');
    await user.clear(titleInput);
    await user.type(titleInput, 'Novi naziv');
    await user.click(screen.getByRole('button', { name: /sačuvaj izmene/i }));
    expect(updateExpense).toHaveBeenCalledWith('e1', expect.objectContaining({ title: 'Novi naziv' }));
    expect(addExpense).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  test('shows validation error when title is cleared in edit mode', async () => {
    const user = userEvent.setup();
    const { updateExpense } = renderModal(existingExpense);
    await user.clear(screen.getByDisplayValue('Stari trošak'));
    await user.click(screen.getByRole('button', { name: /sačuvaj izmene/i }));
    expect(screen.getByText(/naslov je obavezan/i)).toBeInTheDocument();
    expect(updateExpense).not.toHaveBeenCalled();
  });
});
