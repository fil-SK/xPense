import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppContext } from '../App.jsx';
import MonthView from '../components/MonthView.jsx';

function renderMonthView(dataOverrides = {}, ctxOverrides = {}) {
  const setMonthlyNote = vi.fn();
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
      ...dataOverrides,
    },
    navigateTo,
    prevView: null,
    setMonthlyNote,
    ...ctxOverrides,
  };
  render(
    <AppContext.Provider value={ctx}>
      <MonthView year={2025} month={2} />
    </AppContext.Provider>
  );
  return { setMonthlyNote, navigateTo };
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
