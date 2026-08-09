import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppContext } from '../App.jsx';
import ExpenseModal from '../components/ExpenseModal.jsx';

const DEFAULT_CATEGORIES = ['Hrana', 'Transport', 'Zabava'];

function renderModal(expense = undefined, ctxOverrides = {}, props = {}) {
  const addExpense = vi.fn();
  const updateExpense = vi.fn();
  const addRecurring = vi.fn();
  const updateRecurring = vi.fn();
  const addCategory = vi.fn();
  const onClose = vi.fn();
  const ctx = {
    data: { expenses: [], categories: DEFAULT_CATEGORIES, budget: {}, trackingMaps: {}, recurrings: [] },
    addExpense,
    updateExpense,
    addRecurring,
    updateRecurring,
    addCategory,
    showToast: vi.fn(),
    ...ctxOverrides,
  };
  const { container } = render(
    <AppContext.Provider value={ctx}>
      <ExpenseModal expense={expense} onClose={onClose} {...props} />
    </AppContext.Provider>
  );
  return { addExpense, updateExpense, addRecurring, updateRecurring, addCategory, onClose, container };
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

// ─── Dialog semantics and keyboard ───────────────────────────────────────────

describe('ExpenseModal — dialog semantics', () => {
  test('is a labelled modal dialog', () => {
    renderModal();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('Novi trošak');
  });

  test('every input is reachable by its visible label', () => {
    renderModal();
    expect(screen.getByLabelText(/naziv \/ opis/i)).toBe(screen.getByPlaceholderText(/npr/i));
    expect(screen.getByLabelText(/datum/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/iznos/i)).toBe(screen.getByRole('spinbutton'));
    expect(screen.getByLabelText(/napomena/i)).toBeInTheDocument();
  });

  test('the category picker is a group labelled Kategorija', () => {
    renderModal();
    expect(screen.getByRole('group', { name: 'Kategorija' })).toBeInTheDocument();
  });

  test('an error message is announced and tied to its input', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole('button', { name: 'Hrana' }));
    await user.click(screen.getByRole('button', { name: /dodaj trošak/i }));
    const title = screen.getByLabelText(/naziv \/ opis/i);
    expect(title).toHaveAttribute('aria-invalid', 'true');
    expect(title).toHaveAccessibleDescription(/naslov je obavezan/i);
  });

  test('opening the modal moves focus into it', () => {
    renderModal();
    expect(screen.getByLabelText(/naziv \/ opis/i)).toHaveFocus();
  });

  test('Tab wraps from the last control back to the first instead of leaving the dialog', async () => {
    const user = userEvent.setup();
    const { container } = renderModal();
    const close = screen.getByRole('button', { name: /zatvori/i });
    const cancel = screen.getByRole('button', { name: /otkaži/i });

    // Submit is disabled without a category, so Otkaži is the last stop.
    cancel.focus();
    await user.tab();
    expect(container.querySelector('.modal')).toContainElement(document.activeElement);
    expect(close).toHaveFocus();

    await user.tab({ shift: true });
    expect(cancel).toHaveFocus();
  });

  test('pills inside a collapsed group card stay out of the tab order', async () => {
    const user = userEvent.setup();
    renderModal(undefined, GROUPED_CTX);
    // Auto starts collapsed
    expect(screen.getByRole('button', { name: 'Gorivo' })).toHaveAttribute('tabindex', '-1');
    await user.click(screen.getByRole('button', { name: /auto/i }));
    expect(screen.getByRole('button', { name: 'Gorivo' })).not.toHaveAttribute('tabindex');
  });

  test('closing returns focus to whatever opened the modal', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    const ctx = {
      data: { expenses: [], categories: DEFAULT_CATEGORIES, budget: {}, trackingMaps: {}, recurrings: [] },
      addExpense: vi.fn(), updateExpense: vi.fn(), addRecurring: vi.fn(), showToast: vi.fn(),
    };
    const { unmount } = render(
      <AppContext.Provider value={ctx}>
        <ExpenseModal onClose={vi.fn()} />
      </AppContext.Provider>
    );
    expect(trigger).not.toHaveFocus();

    unmount();
    expect(trigger).toHaveFocus();
    trigger.remove();
  });
});

describe('ExpenseModal — submit on Enter', () => {
  test('Enter in the title field saves the expense', async () => {
    const user = userEvent.setup();
    const { addExpense, onClose } = renderModal();
    await user.click(screen.getByRole('button', { name: 'Hrana' }));
    await user.type(screen.getByRole('spinbutton'), '350');
    await user.type(screen.getByLabelText(/naziv \/ opis/i), 'Kafa{Enter}');
    expect(addExpense).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Kafa', amount: 350, category: 'Hrana' })
    );
    expect(onClose).toHaveBeenCalled();
  });

  test('Enter in the amount field saves the expense', async () => {
    const user = userEvent.setup();
    const { addExpense } = renderModal();
    await user.click(screen.getByRole('button', { name: 'Hrana' }));
    await user.type(screen.getByLabelText(/naziv \/ opis/i), 'Kafa');
    await user.type(screen.getByRole('spinbutton'), '350{Enter}');
    expect(addExpense).toHaveBeenCalled();
  });

  test('Enter with an empty form shows validation instead of saving', async () => {
    const user = userEvent.setup();
    const { addExpense } = renderModal();
    await user.click(screen.getByRole('button', { name: 'Hrana' }));
    await user.type(screen.getByLabelText(/naziv \/ opis/i), '{Enter}');
    expect(addExpense).not.toHaveBeenCalled();
    expect(screen.getByText(/naslov je obavezan/i)).toBeInTheDocument();
  });

  test('Enter in edit mode saves the changes', async () => {
    const user = userEvent.setup();
    const { updateExpense } = renderModal(existingExpense);
    await user.type(screen.getByDisplayValue('Stari trošak'), ' dopuna{Enter}');
    expect(updateExpense).toHaveBeenCalledWith('e1', expect.objectContaining({ title: 'Stari trošak dopuna' }));
  });

  test('Enter in the note textarea inserts a newline instead of saving', async () => {
    const user = userEvent.setup();
    const { addExpense } = renderModal();
    await user.click(screen.getByRole('button', { name: 'Hrana' }));
    await user.type(screen.getByLabelText(/naziv \/ opis/i), 'Kafa');
    await user.type(screen.getByRole('spinbutton'), '350');
    await user.type(screen.getByLabelText(/napomena/i), 'prva{Enter}druga');
    expect(addExpense).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/napomena/i)).toHaveValue('prva\ndruga');
  });

  test('non-submit buttons do not submit the form', async () => {
    const user = userEvent.setup();
    const { addExpense, addRecurring } = renderModal();
    await user.click(screen.getByRole('button', { name: 'Hrana' }));
    await user.click(screen.getByRole('button', { name: /ponavljajući trošak/i }));
    expect(addExpense).not.toHaveBeenCalled();
    expect(addRecurring).not.toHaveBeenCalled();
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

// ─── Inline "add category" ───────────────────────────────────────────────────

describe('ExpenseModal — inline category creation', () => {
  const addBtn = { name: /nova kategorija/i };
  const nameInput = () => screen.getByLabelText(/naziv nove kategorije/i);

  test('offers an add-category button next to the picker', () => {
    renderModal();
    expect(screen.getByRole('button', addBtn)).toBeInTheDocument();
    expect(screen.queryByLabelText(/naziv nove kategorije/i)).not.toBeInTheDocument();
  });

  test('clicking it reveals a labelled input and focuses it', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole('button', addBtn));
    expect(nameInput()).toBeInTheDocument();
    expect(nameInput()).toHaveFocus();
  });

  test('saving adds the category and selects it, which enables submit', async () => {
    const user = userEvent.setup();
    const { addCategory } = renderModal();
    expect(screen.getByRole('button', { name: /dodaj trošak/i })).toBeDisabled();
    await user.click(screen.getByRole('button', addBtn));
    await user.type(nameInput(), '  Zdravlje  ');
    await user.click(screen.getByRole('button', { name: /^dodaj$/i }));
    expect(addCategory).toHaveBeenCalledWith('Zdravlje');
    expect(screen.getByRole('button', { name: /dodaj trošak/i })).not.toBeDisabled();
  });

  // The input sits inside the expense <form>, so Enter must not save the expense.
  test('Enter in the name field adds the category instead of submitting the form', async () => {
    const user = userEvent.setup();
    const { addCategory, addExpense } = renderModal();
    await user.type(screen.getByPlaceholderText(/npr\. Ručak/i), 'Lek');
    await user.type(screen.getByRole('spinbutton'), '450');
    await user.click(screen.getByRole('button', addBtn));
    await user.type(nameInput(), 'Zdravlje{Enter}');
    expect(addCategory).toHaveBeenCalledWith('Zdravlje');
    expect(addExpense).not.toHaveBeenCalled();
  });

  test('an existing name is rejected with an error tied to the input', async () => {
    const user = userEvent.setup();
    const { addCategory } = renderModal();
    await user.click(screen.getByRole('button', addBtn));
    await user.type(nameInput(), 'Hrana');
    await user.click(screen.getByRole('button', { name: /^dodaj$/i }));
    expect(addCategory).not.toHaveBeenCalled();
    const error = screen.getByText(/kategorija već postoji/i);
    expect(nameInput()).toHaveAttribute('aria-describedby', error.id);
  });

  test('an empty name is rejected', async () => {
    const user = userEvent.setup();
    const { addCategory } = renderModal();
    await user.click(screen.getByRole('button', addBtn));
    await user.click(screen.getByRole('button', { name: /^dodaj$/i }));
    expect(addCategory).not.toHaveBeenCalled();
    expect(screen.getByText(/unesite naziv kategorije/i)).toBeInTheDocument();
  });

  // Escape must peel off one layer at a time, not jump straight out of the modal.
  test('Escape closes the name field and keeps the modal open', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();
    await user.click(screen.getByRole('button', addBtn));
    await user.type(nameInput(), 'Zdravlje');
    await user.keyboard('{Escape}');
    expect(screen.queryByLabelText(/naziv nove kategorije/i)).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', addBtn)).toHaveFocus();
  });

  // Note the modal footer has an "Otkaži" of its own, so this one is scoped.
  test('cancelling returns focus to the add-category button', async () => {
    const user = userEvent.setup();
    const { container } = renderModal();
    await user.click(screen.getByRole('button', addBtn));
    await user.click(within(container.querySelector('.cat-add')).getByRole('button', { name: /otkaži/i }));
    expect(screen.queryByLabelText(/naziv nove kategorije/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', addBtn)).toHaveFocus();
  });

  test('a half-typed category name counts as unsaved work', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();
    await user.click(screen.getByRole('button', addBtn));
    await user.type(nameInput(), 'Zdrav');
    await user.click(screen.getByRole('button', { name: /zatvori/i }));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText(/odbaci unos/i)).toBeInTheDocument();
  });
});

// ─── Recurring template edit ─────────────────────────────────────────────────

describe('ExpenseModal — editing a recurring template', () => {
  const TEMPLATE = {
    id: 'r1',
    title: 'Netflix',
    amount: 800,
    category: 'Zabava',
    note: 'porodični',
    startDate: '2026-03-04',
    frequency: 'monthly',
  };

  const renderTemplate = () => renderModal(undefined, {}, { recurring: TEMPLATE });

  test('opens with the template values and its own heading', () => {
    renderTemplate();
    expect(screen.getByText('Izmeni ponavljajući trošak', { selector: '.modal__title' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/npr\. Ručak/i)).toHaveValue('Netflix');
    expect(screen.getByRole('spinbutton')).toHaveValue(800);
    expect(screen.getByRole('button', { name: 'Zabava' })).toHaveAttribute('aria-pressed', 'true');
  });

  // Moving the start date would back-fill or orphan whole months, so it is shown
  // as text rather than as an editable field.
  test('shows the start date read-only, with no date input at all', () => {
    const { container } = renderTemplate();
    expect(container.querySelector('input[type="date"]')).toBeNull();
    expect(screen.getByText('2026-03-04')).toBeInTheDocument();
    expect(screen.getByText(/datum početka se ne menja/i)).toBeInTheDocument();
  });

  test('hides the make-recurring toggle — it is already recurring', () => {
    renderTemplate();
    expect(screen.queryByRole('button', { name: 'Ponavljajući trošak' })).not.toBeInTheDocument();
  });

  test('saving calls updateRecurring without touching startDate', async () => {
    const user = userEvent.setup();
    const { updateRecurring, addRecurring, addExpense, onClose } = renderTemplate();
    await user.clear(screen.getByRole('spinbutton'));
    await user.type(screen.getByRole('spinbutton'), '1200');
    await user.click(screen.getByRole('button', { name: /sačuvaj izmene/i }));

    expect(updateRecurring).toHaveBeenCalledTimes(1);
    const [id, updates] = updateRecurring.mock.calls[0];
    expect(id).toBe('r1');
    expect(updates).toEqual({ title: 'Netflix', amount: 1200, category: 'Zabava', note: 'porodični' });
    expect(updates).not.toHaveProperty('date');
    expect(updates).not.toHaveProperty('startDate');
    expect(addRecurring).not.toHaveBeenCalled();
    expect(addExpense).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  test('an unchanged template closes without the discard confirm', async () => {
    const user = userEvent.setup();
    const { onClose } = renderTemplate();
    await user.click(screen.getByRole('button', { name: /zatvori/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
