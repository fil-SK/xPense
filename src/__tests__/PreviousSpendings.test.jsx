import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppContext } from '../App.jsx';
import PreviousSpendings from '../components/PreviousSpendings.jsx';

const CURRENT_YEAR = new Date().getFullYear();

function renderPrev(dataOverrides = {}, ctxOverrides = {}) {
  const navigateTo = vi.fn();
  const ctx = {
    data: {
      expenses: [],
      categories: [],
      budget: {},
      trackingMaps: {},
      recurrings: [],
      monthlyNotes: {},
      savingsGoals: [],
      ...dataOverrides,
    },
    navigateTo,
    ...ctxOverrides,
  };
  render(
    <AppContext.Provider value={ctx}>
      <PreviousSpendings />
    </AppContext.Provider>
  );
  return { navigateTo };
}

describe('PreviousSpendings — month grid', () => {
  test('renders all 12 month cards', () => {
    renderPrev();
    const cards = document.querySelectorAll('.month-card');
    expect(cards).toHaveLength(12);
  });

  test('renders the current year by default', () => {
    renderPrev();
    expect(screen.getByText(String(CURRENT_YEAR))).toBeInTheDocument();
  });

  test('clicking a past month calls navigateTo', async () => {
    const user = userEvent.setup();
    const { navigateTo } = renderPrev();
    // January (month 0) is always in the past for any year >= current
    const januaryCard = document.querySelectorAll('.month-card')[0];
    await user.click(januaryCard);
    expect(navigateTo).toHaveBeenCalled();
  });
});

// Cards used to be clickable <div>s — no role, no tab stop.
describe('PreviousSpendings — month cards are keyboard reachable', () => {
  test('a past month is a button named for the month, year and totals', () => {
    renderPrev({
      expenses: [{ id: '1', title: 'Kafa', category: 'Hrana', date: `${CURRENT_YEAR}-01-05`, amount: 350 }],
    });
    const card = screen.getByRole('button', { name: new RegExp(`januar ${CURRENT_YEAR}.*1 transakcija`, 'i') });
    expect(card).toHaveClass('month-card');
  });

  test('an empty past month says so rather than reading as a bare number', () => {
    renderPrev();
    expect(
      screen.getByRole('button', { name: new RegExp(`januar ${CURRENT_YEAR} — nema troškova`, 'i') })
    ).toBeInTheDocument();
  });

  test('Enter on a focused month card navigates', async () => {
    const user = userEvent.setup();
    const { navigateTo } = renderPrev();
    const card = screen.getByRole('button', { name: new RegExp(`januar ${CURRENT_YEAR}`, 'i') });
    card.focus();
    await user.keyboard('{Enter}');
    expect(navigateTo).toHaveBeenCalledWith('month', CURRENT_YEAR, 0);
  });

  // A future month has nothing to open, so it must not collect a tab stop.
  test('future months are disabled', () => {
    const currentMonth = new Date().getMonth();
    if (currentMonth === 11) return; // December: no future month exists this year
    renderPrev();
    const cards = document.querySelectorAll('.month-card');
    expect(cards[currentMonth + 1]).toBeDisabled();
    expect(cards[currentMonth]).not.toBeDisabled();
  });
});

describe('PreviousSpendings — monthly note snippet', () => {
  test('shows note snippet on card when note exists', () => {
    renderPrev({ monthlyNotes: { [CURRENT_YEAR]: { 0: 'Auto servis bio skup' } } });
    expect(screen.getByText('Auto servis bio skup')).toBeInTheDocument();
  });

  test('truncates note longer than 55 characters', () => {
    const longNote = 'A'.repeat(60);
    renderPrev({ monthlyNotes: { [CURRENT_YEAR]: { 0: longNote } } });
    expect(screen.getByText(`${'A'.repeat(55)}…`)).toBeInTheDocument();
  });

  test('does not render note element when note is empty', () => {
    renderPrev({ monthlyNotes: { [CURRENT_YEAR]: { 0: '' } } });
    expect(document.querySelector('.month-card__note')).toBeNull();
  });

  test('does not render note element when monthlyNotes is empty', () => {
    renderPrev();
    expect(document.querySelector('.month-card__note')).toBeNull();
  });
});
