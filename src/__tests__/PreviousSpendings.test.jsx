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
