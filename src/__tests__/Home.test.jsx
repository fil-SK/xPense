import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppContext } from '../App.jsx';
import Home from '../components/Home.jsx';

function renderHome(ctxOverrides = {}) {
  const navigateTo = vi.fn();
  const importData = vi.fn();
  const showToast = vi.fn();
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
    importData,
    showToast,
    deleteRecurring: vi.fn(),
    addSavingsGoal: vi.fn(),
    deleteSavingsGoal: vi.fn(),
    ...ctxOverrides,
  };
  const { container } = render(
    <AppContext.Provider value={ctx}>
      <Home />
    </AppContext.Provider>
  );
  return { navigateTo, importData, showToast, container };
}

describe('Home — quick-add button', () => {
  test('renders the circular add button', () => {
    renderHome();
    expect(screen.getByRole('button', { name: /dodaj trošak/i })).toBeInTheDocument();
  });

  // The hero button now reads "Novi trošak" too (its icon supplies the +), so
  // these must target the modal heading rather than any matching text.
  const modalTitle = { selector: '.modal__title' };

  test('clicking add button opens the expense modal', async () => {
    const user = userEvent.setup();
    renderHome();
    await user.click(screen.getByRole('button', { name: /dodaj trošak/i }));
    expect(screen.getByText('Novi trošak', modalTitle)).toBeInTheDocument();
  });

  test('modal closes when ✕ is clicked', async () => {
    const user = userEvent.setup();
    renderHome();
    await user.click(screen.getByRole('button', { name: /dodaj trošak/i }));
    await user.click(screen.getByRole('button', { name: /zatvori/i }));
    expect(screen.queryByText('Novi trošak', modalTitle)).not.toBeInTheDocument();
  });

  test('the hero button does not repeat the + that its icon already draws', () => {
    renderHome();
    const btn = screen.getByRole('button', { name: /dodaj trošak/i });
    expect(btn).toHaveTextContent(/^Novi trošak$/);
    expect(btn.querySelector('svg')).toBeTruthy();
  });
});

describe('Home — removed Prethodne action card', () => {
  test('does not render Pogledaj prethodne potrošnje card', () => {
    renderHome();
    expect(screen.queryByText(/pogledaj prethodne/i)).not.toBeInTheDocument();
  });
});

describe('Home — JSON import', () => {
  function jsonFile(payload) {
    return new File([JSON.stringify(payload)], 'troskovi.json', { type: 'application/json' });
  }

  const payload = {
    categories: ['Hrana', 'Transport'],
    expenses: [
      { id: 'a', title: 'Ručak', date: '2025-01-15', amount: 900, category: 'Hrana' },
      { id: 'b', title: 'Neispravan', amount: 100 },
    ],
  };

  async function upload(container, file) {
    const user = userEvent.setup();
    await user.upload(container.querySelector('input[type="file"]'), file);
    return user;
  }

  // The whole point of bug 6: picking a file must not replace anything yet.
  test('does not import immediately — it asks first', async () => {
    const { container, importData } = renderHome();
    await upload(container, jsonFile(payload));
    expect(await screen.findByText(/zamenjuje sve trenutne podatke/i)).toBeInTheDocument();
    expect(importData).not.toHaveBeenCalled();
  });

  test('confirming applies the import with the skipped count', async () => {
    const { container, importData } = renderHome();
    const user = await upload(container, jsonFile(payload));
    await screen.findByText(/zamenjuje sve trenutne podatke/i);
    await user.click(screen.getByRole('button', { name: /zameni podatke/i }));

    expect(importData).toHaveBeenCalledTimes(1);
    const [imported, meta] = importData.mock.calls[0];
    expect(imported.expenses).toHaveLength(1);
    expect(meta).toEqual({ skipped: 1 });
  });

  test('cancelling leaves the data alone and closes the dialog', async () => {
    const { container, importData } = renderHome();
    const user = await upload(container, jsonFile(payload));
    await screen.findByText(/zamenjuje sve trenutne podatke/i);
    await user.click(screen.getByRole('button', { name: /otkaži/i }));

    expect(importData).not.toHaveBeenCalled();
    expect(screen.queryByText(/zamenjuje sve trenutne podatke/i)).not.toBeInTheDocument();
  });

  test('a malformed file reports an error and opens nothing', async () => {
    const { container, importData, showToast } = renderHome();
    await upload(container, new File(['not json'], 'troskovi.json'));

    await vi.waitFor(() => expect(showToast).toHaveBeenCalled());
    expect(showToast.mock.calls[0][1]).toBe('danger');
    expect(importData).not.toHaveBeenCalled();
    expect(screen.queryByText(/zamenjuje sve trenutne podatke/i)).not.toBeInTheDocument();
  });
});

describe('Home — redesigned overview + sections', () => {
  test('renders the overview card with monthly total', () => {
    renderHome();
    expect(screen.getByText(/potrošeno ovaj mesec/i)).toBeInTheDocument();
  });

  test('renders Poslednje transakcije section', () => {
    renderHome();
    expect(screen.getByText(/poslednje transakcije/i)).toBeInTheDocument();
  });

  test('renders Grafikoni i uvidi toggle and reveals charts on click', async () => {
    const user = userEvent.setup();
    renderHome();
    expect(screen.getByText(/grafikoni i uvidi/i)).toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: /prikaži/i });
    await user.click(toggle);
    expect(screen.getByRole('button', { name: /sakrij/i })).toBeInTheDocument();
  });
});

describe('Home — recurring templates', () => {
  const template = {
    id: 'r1', title: 'Netflix', amount: 800, category: 'Hrana',
    note: '', startDate: '2026-03-04', frequency: 'monthly',
  };
  const withTemplate = { recurrings: [template] };

  function renderWithTemplate(extra = {}) {
    return renderHome({
      data: {
        expenses: [], categories: ['Hrana'], budget: {}, trackingMaps: {},
        monthlyNotes: {}, savingsGoals: [], ...withTemplate,
      },
      updateRecurring: vi.fn(),
      addCategory: vi.fn(),
      ...extra,
    });
  }

  test('lists the template with edit and delete actions', () => {
    renderWithTemplate();
    expect(screen.getByRole('button', { name: /izmeni ponavljajući trošak: netflix/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ukloni ponavljajući trošak: netflix/i })).toBeInTheDocument();
  });

  test('the edit button opens the modal on the template', async () => {
    const user = userEvent.setup();
    renderWithTemplate();
    await user.click(screen.getByRole('button', { name: /izmeni ponavljajući trošak: netflix/i }));
    expect(screen.getByText('Izmeni ponavljajući trošak', { selector: '.modal__title' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Netflix')).toBeInTheDocument();
  });

  test('delete still removes the template', async () => {
    const user = userEvent.setup();
    const deleteRecurring = vi.fn();
    renderWithTemplate({ deleteRecurring });
    await user.click(screen.getByRole('button', { name: /ukloni ponavljajući trošak: netflix/i }));
    expect(deleteRecurring).toHaveBeenCalledWith('r1');
  });
});
