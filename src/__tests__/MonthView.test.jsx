import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppContext } from '../App.jsx';
import MonthView from '../components/MonthView.jsx';

function renderMonthView(dataOverrides = {}, ctxOverrides = {}) {
  const setMonthlyNote = vi.fn();
  const navigateTo = vi.fn();
  const deleteExpense = vi.fn();
  const ctx = {
    data: {
      expenses: [],
      categories: ['Hrana'],
      categoryGroups: [],
      budget: {},
      trackingMaps: {},
      recurrings: [],
      monthlyNotes: {},
      savingsGoals: [],
      ...dataOverrides,
    },
    navigateTo,
    prevView: null,
    setMonthlyNote,
    deleteExpense,
    ...ctxOverrides,
  };
  render(
    <AppContext.Provider value={ctx}>
      <MonthView year={2025} month={2} />
    </AppContext.Provider>
  );
  return { setMonthlyNote, navigateTo, deleteExpense };
}

describe('MonthView — back navigation', () => {
  test('back button uses prevView from context when set', async () => {
    const user = userEvent.setup();
    const { navigateTo } = renderMonthView({}, { prevView: 'search' });
    await user.click(screen.getByTitle('Nazad'));
    expect(navigateTo).toHaveBeenCalledWith('search');
  });

  test('back button falls back to "previous" when prevView is null and not isCurrent', async () => {
    const user = userEvent.setup();
    const { navigateTo } = renderMonthView({}, { prevView: null });
    await user.click(screen.getByTitle('Nazad'));
    expect(navigateTo).toHaveBeenCalledWith('previous');
  });
});

describe('MonthView — Analiza toggle', () => {
  test('is not marked active before it is clicked', () => {
    renderMonthView();
    const btn = screen.getByRole('button', { name: /analiza/i });
    expect(btn).not.toHaveClass('btn--toggled');
  });

  // The active state must come from a themed class, never inline colors —
  // hardcoded hex values here used to stay indigo in dark mode.
  test('marks itself active with a class and no inline colors', async () => {
    const user = userEvent.setup();
    renderMonthView();
    const btn = screen.getByRole('button', { name: /analiza/i });
    await user.click(btn);
    expect(btn).toHaveClass('btn--toggled');
    expect(btn.getAttribute('style')).toBeFalsy();
  });
});

describe('MonthView — category filter', () => {
  // March 2025 is what renderMonthView shows. 'Putovanje' is deliberately only
  // spent in February, so it must never show up as a pill here.
  const CATEGORIES = ['Hrana', 'Struja', 'Voda', 'Bioskop', 'Putovanje'];
  const GROUPS = [
    { id: 'g1', name: 'Režije', categories: ['Struja', 'Voda'] },
    { id: 'g2', name: 'Slobodno vreme', categories: ['Bioskop'] },
    { id: 'g3', name: 'Putovanja', categories: ['Putovanje'] },
  ];
  const EXPENSES = [
    { id: 'e1', date: '2025-03-02', amount: 200,  category: 'Hrana',     title: 'Kafa' },
    { id: 'e2', date: '2025-03-05', amount: 3000, category: 'Struja',    title: 'Struja mart' },
    { id: 'e3', date: '2025-03-06', amount: 1200, category: 'Voda',      title: 'Voda mart' },
    { id: 'e4', date: '2025-03-10', amount: 800,  category: 'Bioskop',   title: 'Bioskop' },
    { id: 'e5', date: '2025-03-12', amount: 900,  category: 'Hrana',     title: 'Ručak' },
    { id: 'e6', date: '2025-02-01', amount: 5000, category: 'Putovanje', title: 'Kopaonik' },
  ];

  function renderFilterable(overrides = {}) {
    return renderMonthView({
      expenses: EXPENSES,
      categories: CATEGORIES,
      categoryGroups: GROUPS,
      ...overrides,
    });
  }

  const openFilter = async (user) => user.click(screen.getByRole('button', { name: /^🏷️ Filter/ }));
  const rowTitles = () =>
    screen
      .getAllByRole('button', { name: /^Izmeni trošak: / })
      .map((el) => el.getAttribute('aria-label').replace('Izmeni trošak: ', ''));

  test('the filter button is hidden when the month has nothing to filter', () => {
    renderMonthView();
    expect(screen.queryByRole('button', { name: /Filter/ })).not.toBeInTheDocument();
  });

  test('lists only the categories spent in this month, with their counts', async () => {
    const user = userEvent.setup();
    renderFilterable();
    await openFilter(user);

    const pills = screen.getByRole('group', { name: 'Kategorije' });
    ['Hrana', 'Struja', 'Voda', 'Bioskop'].forEach((c) => {
      expect(within(pills).getByRole('button', { name: c })).toBeInTheDocument();
    });
    // Only spent in February.
    expect(within(pills).queryByRole('button', { name: 'Putovanje' })).not.toBeInTheDocument();
    // The count is decoration, not part of the name — but it is on screen.
    expect(within(pills).getByRole('button', { name: 'Hrana' })).toHaveTextContent('Hrana2');
  });

  test('selecting a category narrows the list to it', async () => {
    const user = userEvent.setup();
    renderFilterable();
    await openFilter(user);
    await user.click(screen.getByRole('button', { name: 'Hrana' }));

    expect(rowTitles()).toEqual(['Ručak', 'Kafa']);
    expect(screen.getByRole('button', { name: 'Hrana' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('clicking a selected category deselects it and restores the list', async () => {
    const user = userEvent.setup();
    renderFilterable();
    await openFilter(user);
    await user.click(screen.getByRole('button', { name: 'Hrana' }));
    await user.click(screen.getByRole('button', { name: 'Hrana' }));
    expect(rowTitles()).toHaveLength(5);
  });

  test('two categories are a union, not an intersection', async () => {
    const user = userEvent.setup();
    renderFilterable();
    await openFilter(user);
    await user.click(screen.getByRole('button', { name: 'Hrana' }));
    await user.click(screen.getByRole('button', { name: 'Bioskop' }));
    expect(rowTitles().sort()).toEqual(['Bioskop', 'Kafa', 'Ručak']);
  });

  // The point of the feature: "sve iz Režija" in one click.
  test('a group chip selects every category in the group at once', async () => {
    const user = userEvent.setup();
    renderFilterable();
    await openFilter(user);
    await user.click(screen.getByRole('button', { name: 'Režije' }));

    expect(rowTitles().sort()).toEqual(['Struja mart', 'Voda mart']);
    expect(screen.getByRole('button', { name: 'Struja' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Voda' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('clicking a fully-selected group chip clears its categories', async () => {
    const user = userEvent.setup();
    renderFilterable();
    await openFilter(user);
    const chip = screen.getByRole('button', { name: 'Režije' });
    await user.click(chip);
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    await user.click(chip);
    expect(chip).toHaveAttribute('aria-pressed', 'false');
    expect(rowTitles()).toHaveLength(5);
  });

  // A half-selected group is not pressed, and pressing it completes the set
  // rather than wiping the category the user already picked.
  test('a partly-selected group chip fills in the rest', async () => {
    const user = userEvent.setup();
    renderFilterable();
    await openFilter(user);
    await user.click(screen.getByRole('button', { name: 'Struja' }));

    const chip = screen.getByRole('button', { name: 'Režije' });
    expect(chip).toHaveAttribute('aria-pressed', 'false');
    await user.click(chip);
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    expect(rowTitles().sort()).toEqual(['Struja mart', 'Voda mart']);
  });

  test('picking a group’s categories by hand marks the chip pressed', async () => {
    const user = userEvent.setup();
    renderFilterable();
    await openFilter(user);
    await user.click(screen.getByRole('button', { name: 'Struja' }));
    await user.click(screen.getByRole('button', { name: 'Voda' }));
    expect(screen.getByRole('button', { name: 'Režije' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('a group with nothing spent this month gets no chip', async () => {
    const user = userEvent.setup();
    renderFilterable();
    await openFilter(user);
    const groups = screen.getByRole('group', { name: 'Grupe' });
    expect(within(groups).getByRole('button', { name: 'Režije' })).toBeInTheDocument();
    expect(within(groups).queryByRole('button', { name: 'Putovanja' })).not.toBeInTheDocument();
  });

  test('the group row is absent when no groups are configured', async () => {
    const user = userEvent.setup();
    renderFilterable({ categoryGroups: [] });
    await openFilter(user);
    expect(screen.queryByRole('group', { name: 'Grupe' })).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Kategorije' })).toBeInTheDocument();
  });

  test('survives a context without categoryGroups at all', async () => {
    const user = userEvent.setup();
    renderMonthView({ expenses: EXPENSES, categories: CATEGORIES, categoryGroups: undefined });
    await openFilter(user);
    expect(screen.getByRole('group', { name: 'Kategorije' })).toBeInTheDocument();
  });

  test('the summary reports the filtered count and total', async () => {
    const user = userEvent.setup();
    renderFilterable();
    await openFilter(user);
    await user.click(screen.getByRole('button', { name: 'Režije' }));
    // 3.000 + 1.200 of 5 rows.
    expect(screen.getByText(/Prikazano:/)).toHaveTextContent('Prikazano: 2 od 5');
    expect(screen.getByText(/Prikazano:/)).toHaveTextContent('4.200 RSD');
  });

  // The stats row is the month, not the selection — the summary line is what
  // answers "koliko na Režije".
  test('the month stats stay unfiltered', async () => {
    const user = userEvent.setup();
    renderFilterable();
    await openFilter(user);
    await user.click(screen.getByRole('button', { name: 'Režije' }));
    expect(screen.getByText('Ukupno potrošeno').nextSibling).toHaveTextContent('6.100 RSD');
    expect(screen.getByText('Broj transakcija').nextSibling).toHaveTextContent('5');
  });

  test('"Poništi filter" clears the selection', async () => {
    const user = userEvent.setup();
    renderFilterable();
    await openFilter(user);
    await user.click(screen.getByRole('button', { name: 'Režije' }));
    await user.click(screen.getByRole('button', { name: 'Poništi filter' }));

    expect(rowTitles()).toHaveLength(5);
    expect(screen.queryByText(/Prikazano:/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Režije' })).toHaveAttribute('aria-pressed', 'false');
  });

  // The clear button is the only way back off a filter once the panel is shut,
  // so it must not live inside the panel.
  test('the summary and its clear button outlive the collapsed panel', async () => {
    const user = userEvent.setup();
    renderFilterable();
    await openFilter(user);
    await user.click(screen.getByRole('button', { name: 'Režije' }));
    await openFilter(user); // close it again

    expect(screen.queryByRole('group', { name: 'Kategorije' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Poništi filter' })).toBeInTheDocument();
    expect(rowTitles().sort()).toEqual(['Struja mart', 'Voda mart']);
  });

  test('the toolbar button carries the number of selected categories', async () => {
    const user = userEvent.setup();
    renderFilterable();
    const btn = screen.getByRole('button', { name: /^🏷️ Filter/ });
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    await openFilter(user);
    expect(btn).toHaveAttribute('aria-expanded', 'true');
    await user.click(screen.getByRole('button', { name: 'Režije' }));
    expect(btn).toHaveTextContent('🏷️ Filter (2)');
  });

  test('filter and search narrow together', async () => {
    const user = userEvent.setup();
    renderFilterable();
    await openFilter(user);
    await user.click(screen.getByRole('button', { name: 'Hrana' }));
    await user.type(screen.getByPlaceholderText(/pretraži troškove/i), 'kafa');
    expect(rowTitles()).toEqual(['Kafa']);
  });

  test('an empty result from filter + search still reads as a search miss', async () => {
    const user = userEvent.setup();
    renderFilterable();
    await openFilter(user);
    await user.click(screen.getByRole('button', { name: 'Hrana' }));
    await user.type(screen.getByPlaceholderText(/pretraži troškove/i), 'struja');
    expect(screen.getByText('Nema rezultata za pretragu.')).toBeInTheDocument();
  });
});

describe('MonthView — monthly note', () => {
  test('renders note textarea with placeholder', () => {
    renderMonthView();
    expect(screen.getByPlaceholderText(/napomena za ovaj mesec/i)).toBeInTheDocument();
  });

  test('pre-fills existing note from data', () => {
    renderMonthView({ monthlyNotes: { 2025: { 2: 'Auto servis bio skup' } } });
    expect(screen.getByDisplayValue('Auto servis bio skup')).toBeInTheDocument();
  });

  test('calls setMonthlyNote on blur with trimmed text', async () => {
    const user = userEvent.setup();
    const { setMonthlyNote } = renderMonthView();
    const textarea = screen.getByPlaceholderText(/napomena za ovaj mesec/i);
    await user.type(textarea, '  skupo  ');
    await user.tab();
    expect(setMonthlyNote).toHaveBeenCalledWith(2025, 2, 'skupo');
  });

  test('does not call setMonthlyNote if text is unchanged', async () => {
    const user = userEvent.setup();
    const { setMonthlyNote } = renderMonthView({ monthlyNotes: { 2025: { 2: 'skupo' } } });
    const textarea = screen.getByDisplayValue('skupo');
    await user.click(textarea);
    await user.tab();
    expect(setMonthlyNote).not.toHaveBeenCalled();
  });
});
