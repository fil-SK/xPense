import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppContext } from '../App.jsx';
import ExpenseItem from '../components/ExpenseItem.jsx';

const EXPENSE = {
  id: 'e1', title: 'Kafa i čaj', category: 'Hrana',
  date: '2025-03-05', amount: 350, note: '',
};

function renderItem(expense = EXPENSE) {
  const deleteExpense = vi.fn();
  const ctx = {
    data: {
      expenses: [expense],
      categories: ['Hrana', 'Transport'],
      categoryGroups: [],
      budget: {},
      trackingMaps: {},
      recurrings: [],
    },
    deleteExpense,
    // ExpenseModal opens from this row, so its actions have to be present too.
    addExpense: vi.fn(),
    updateExpense: vi.fn(),
    addRecurring: vi.fn(),
    updateRecurring: vi.fn(),
    addCategory: vi.fn(),
    showToast: vi.fn(),
  };
  render(
    <AppContext.Provider value={ctx}>
      <ExpenseItem expense={expense} />
    </AppContext.Provider>
  );
  return { deleteExpense };
}

// The row used to be a bare clickable <div>: no role, no tab stop, no keyboard
// path to the edit modal at all.
describe('ExpenseItem — keyboard reachability', () => {
  test('exposes the row as a button named after the expense', () => {
    renderItem();
    expect(screen.getByRole('button', { name: /izmeni trošak: kafa i čaj/i })).toBeInTheDocument();
  });

  test('the row is in the tab order', async () => {
    const user = userEvent.setup();
    renderItem();
    await user.tab();
    expect(screen.getByRole('button', { name: /izmeni trošak: kafa i čaj/i })).toHaveFocus();
  });

  test('Enter on the focused row opens the edit modal', async () => {
    const user = userEvent.setup();
    renderItem();
    await user.tab();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Izmeni trošak')).toBeInTheDocument();
  });

  test('Space on the focused row opens the edit modal', async () => {
    const user = userEvent.setup();
    renderItem();
    await user.tab();
    await user.keyboard(' ');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  test('clicking the row still opens the edit modal', async () => {
    const user = userEvent.setup();
    renderItem();
    await user.click(screen.getByRole('button', { name: /izmeni trošak: kafa i čaj/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

// The row wraps ✏️ and 🗑️, so their own Enter/Space activations bubble up to
// the row's handler. Unguarded, 🗑️ would arm the delete *and* open the modal
// over it — the exact bug the e.target check in handleKeyDown prevents.
describe('ExpenseItem — nested action buttons', () => {
  test('Enter on the delete button does not also open the modal', async () => {
    const user = userEvent.setup();
    renderItem();
    screen.getByTitle('Obriši').focus();
    await user.keyboard('{Enter}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('Space on the delete button does not also open the modal', async () => {
    const user = userEvent.setup();
    renderItem();
    screen.getByTitle('Obriši').focus();
    await user.keyboard(' ');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('delete still needs two activations, and fires on the second', async () => {
    const user = userEvent.setup();
    const { deleteExpense } = renderItem();
    const del = screen.getByTitle('Obriši');
    await user.click(del);
    expect(deleteExpense).not.toHaveBeenCalled();
    await user.click(screen.getByTitle(/klikni ponovo/i));
    expect(deleteExpense).toHaveBeenCalledWith('e1');
  });

  test('the edit button opens the modal exactly once', async () => {
    const user = userEvent.setup();
    renderItem();
    await user.click(screen.getByTitle('Izmeni'));
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });
});
