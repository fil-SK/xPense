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
  const { container } = render(
    <AppContext.Provider value={ctx}>
      <ExpenseModal expense={expense} onClose={onClose} />
    </AppContext.Provider>
  );
  return { addExpense, updateExpense, addRecurring, onClose, container };
}

// ─── Add mode ────────────────────────────────────────────────────────────────

describe('ExpenseModal — add mode', () => {
  test('renders add form heading and submit button', () => {
    renderModal();
    expect(screen.getByText('Novi trošak')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dodaj trošak/i })).toBeInTheDocument();
  });

  test('shows recurring toggle button only in add mode', () => {
    renderModal();
    expect(screen.getByRole('button', { name: /ponavljajući trošak/i })).toBeInTheDocument();
    expect(screen.getByText(/ponavljajući trošak/i)).toBeInTheDocument();
  });

  test('calls addExpense with correct payload on valid submit', async () => {
    const user = userEvent.setup();
    const { addExpense, onClose } = renderModal();
    await user.type(screen.getByPlaceholderText(/npr/i), 'Kafa');
    await user.type(screen.getByRole('spinbutton'), '350');
    await user.click(screen.getByRole('button', { name: 'Hrana' }));
    await user.click(screen.getByRole('button', { name: /dodaj trošak/i }));
    expect(addExpense).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Kafa', amount: 350, category: 'Hrana' })
    );
    expect(onClose).toHaveBeenCalled();
  });

  test('calls addRecurring (not addExpense) when recurring button is toggled', async () => {
    const user = userEvent.setup();
    const { addExpense, addRecurring } = renderModal();
    await user.type(screen.getByPlaceholderText(/npr/i), 'Netflix');
    await user.type(screen.getByRole('spinbutton'), '800');
    await user.click(screen.getByRole('button', { name: 'Hrana' }));
    await user.click(screen.getByRole('button', { name: /ponavljajući trošak/i }));
    await user.click(screen.getByRole('button', { name: /dodaj trošak/i }));
    expect(addRecurring).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Netflix', amount: 800, frequency: 'monthly' })
    );
    expect(addExpense).not.toHaveBeenCalled();
  });

  test('submit button is disabled until a category is selected', () => {
    renderModal();
    expect(screen.getByRole('button', { name: /dodaj trošak/i })).toBeDisabled();
  });

  test('submit button enables after selecting a category', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole('button', { name: 'Hrana' }));
    expect(screen.getByRole('button', { name: /dodaj trošak/i })).not.toBeDisabled();
  });

  test('shows validation errors on submit with category but empty title and amount', async () => {
    const user = userEvent.setup();
    const { addExpense } = renderModal();
    await user.click(screen.getByRole('button', { name: 'Hrana' }));
    await user.click(screen.getByRole('button', { name: /dodaj trošak/i }));
    expect(screen.getByText(/naslov je obavezan/i)).toBeInTheDocument();
    expect(screen.getByText(/unesite ispravan iznos/i)).toBeInTheDocument();
    expect(addExpense).not.toHaveBeenCalled();
  });

  test('shows amount error for zero amount', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole('button', { name: 'Hrana' }));
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
    await user.click(screen.getByRole('button', { name: 'Hrana' }));
    await user.type(screen.getByPlaceholderText(/npr/i), '  Kafa  ');
    await user.type(screen.getByRole('spinbutton'), '100');
    await user.click(screen.getByRole('button', { name: /dodaj trošak/i }));
    expect(addExpense).toHaveBeenCalledWith(expect.objectContaining({ title: 'Kafa' }));
  });

  test('rounds non-integer amounts', async () => {
    const user = userEvent.setup();
    const { addExpense } = renderModal();
    await user.click(screen.getByRole('button', { name: 'Hrana' }));
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

  test('does not show recurring button in edit mode', () => {
    renderModal(existingExpense);
    expect(screen.queryByRole('button', { name: /ponavljajući trošak/i })).not.toBeInTheDocument();
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

// ─── Category group picker ────────────────────────────────────────────────────

const GROUPED_CTX = {
  data: {
    expenses: [],
    categories: ['Hrana', 'Gorivo', 'Netflix'],
    categoryGroups: [
      { id: 'g1', name: 'Namirnice', categories: ['Hrana'] },
      { id: 'g2', name: 'Auto', categories: ['Gorivo'] },
    ],
  },
};

describe('ExpenseModal — category group picker', () => {
  test('shows group card headers when categoryGroups exist', () => {
    renderModal(undefined, GROUPED_CTX);
    expect(screen.getByRole('button', { name: /namirnice/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /auto/i })).toBeInTheDocument();
  });

  test('shows Opšte section for categories not in any group', () => {
    renderModal(undefined, GROUPED_CTX);
    expect(screen.getByRole('button', { name: /opšte/i })).toBeInTheDocument();
  });

  test('auto-expands group containing the default selected category', () => {
    renderModal(undefined, GROUPED_CTX);
    // Hrana is the first category and is in Namirnice; its pill should be visible
    expect(screen.getByRole('button', { name: 'Hrana' })).toBeInTheDocument();
  });

  test('clicking a collapsed group header expands it to show pills', async () => {
    const user = userEvent.setup();
    renderModal(undefined, GROUPED_CTX);
    // Auto is collapsed initially (Gorivo is not the default selection)
    await user.click(screen.getByRole('button', { name: /auto/i }));
    expect(screen.getByRole('button', { name: 'Gorivo' })).toBeInTheDocument();
  });

  test('selecting a pill sets the category and keeps the group open', async () => {
    const user = userEvent.setup();
    const { addExpense } = renderModal(undefined, GROUPED_CTX);
    // Expand Auto group
    await user.click(screen.getByRole('button', { name: /auto/i }));
    await user.click(screen.getByRole('button', { name: 'Gorivo' }));
    // Group stays open (Gorivo pill still visible)
    expect(screen.getByRole('button', { name: 'Gorivo' })).toBeInTheDocument();
    // Submit and verify category
    await user.type(screen.getByPlaceholderText(/npr/i), 'Benzin');
    await user.type(screen.getByRole('spinbutton'), '5000');
    await user.click(screen.getByRole('button', { name: /dodaj trošak/i }));
    expect(addExpense).toHaveBeenCalledWith(expect.objectContaining({ category: 'Gorivo' }));
  });

  test('falls back to flat pills when categoryGroups is empty', () => {
    renderModal();
    // In the default renderModal, data has no categoryGroups → flat pills rendered directly
    expect(screen.getByRole('button', { name: 'Hrana' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Transport' })).toBeInTheDocument();
  });
});

// ─── Unsaved-changes guard ───────────────────────────────────────────────────

const confirmVisible = () => screen.queryByRole('alertdialog') !== null;

describe('ExpenseModal — discard confirmation', () => {
  test('clicking the overlay on an untouched form closes immediately', async () => {
    const user = userEvent.setup();
    const { onClose, container } = renderModal();
    await user.click(container.querySelector('.modal-overlay'));
    expect(onClose).toHaveBeenCalled();
    expect(confirmVisible()).toBe(false);
  });

  test('clicking the overlay with a filled field asks before discarding', async () => {
    const user = userEvent.setup();
    const { onClose, container } = renderModal();
    await user.type(screen.getByPlaceholderText(/npr/i), 'Kafa');
    await user.click(container.querySelector('.modal-overlay'));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  test('confirming the discard closes the modal', async () => {
    const user = userEvent.setup();
    const { onClose, container } = renderModal();
    await user.type(screen.getByPlaceholderText(/npr/i), 'Kafa');
    await user.click(container.querySelector('.modal-overlay'));
    await user.click(screen.getByRole('button', { name: /^odbaci$/i }));
    expect(onClose).toHaveBeenCalled();
  });

  test('cancelling the discard keeps the modal and the typed values', async () => {
    const user = userEvent.setup();
    const { onClose, container } = renderModal();
    await user.type(screen.getByPlaceholderText(/npr/i), 'Kafa');
    await user.click(container.querySelector('.modal-overlay'));
    await user.click(screen.getByRole('button', { name: /nastavi unos/i }));
    expect(onClose).not.toHaveBeenCalled();
    expect(confirmVisible()).toBe(false);
    expect(screen.getByDisplayValue('Kafa')).toBeInTheDocument();
  });

  test('the ✕ and Otkaži buttons are guarded too', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();
    await user.type(screen.getByRole('spinbutton'), '350');

    await user.click(screen.getByRole('button', { name: /zatvori/i }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /nastavi unos/i }));

    await user.click(screen.getByRole('button', { name: /otkaži/i }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  test('Escape asks first, and a second Escape returns to the form', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();
    await user.type(screen.getByPlaceholderText(/npr/i), 'Kafa');

    await user.keyboard('{Escape}');
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    await user.keyboard('{Escape}');
    expect(confirmVisible()).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue('Kafa')).toBeInTheDocument();
  });

  test('selecting a category alone counts as unsaved work', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();
    await user.click(screen.getByRole('button', { name: 'Hrana' }));
    await user.keyboard('{Escape}');
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  test('toggling recurring alone counts as unsaved work', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();
    await user.click(screen.getByRole('button', { name: /ponavljajući trošak/i }));
    await user.keyboard('{Escape}');
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  test('an unmodified edit form closes without asking', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal(existingExpense);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
    expect(confirmVisible()).toBe(false);
  });

  test('an edited edit form asks before discarding', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal(existingExpense);
    await user.type(screen.getByDisplayValue('Stari trošak'), ' dopuna');
    await user.keyboard('{Escape}');
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  test('saving is never blocked by the guard', async () => {
    const user = userEvent.setup();
    const { addExpense, onClose } = renderModal();
    await user.type(screen.getByPlaceholderText(/npr/i), 'Kafa');
    await user.type(screen.getByRole('spinbutton'), '350');
    await user.click(screen.getByRole('button', { name: 'Hrana' }));
    await user.click(screen.getByRole('button', { name: /dodaj trošak/i }));
    expect(addExpense).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
    expect(confirmVisible()).toBe(false);
  });
});

// ─── Layout ──────────────────────────────────────────────────────────────────

describe('ExpenseModal — scrollable body', () => {
  test('form fields live in a scrollable body, header and footer stay outside it', () => {
    const { container } = renderModal();
    const body = container.querySelector('.modal__body');
    expect(body).toBeTruthy();
    // Scrollable region holds the form, not the title bar or action buttons
    expect(body).toContainElement(screen.getByPlaceholderText(/npr/i));
    expect(body).toContainElement(screen.getByRole('button', { name: /ponavljajući trošak/i }));
    expect(body).not.toContainElement(screen.getByText('Novi trošak'));
    expect(body).not.toContainElement(screen.getByRole('button', { name: /dodaj trošak/i }));
  });
});
