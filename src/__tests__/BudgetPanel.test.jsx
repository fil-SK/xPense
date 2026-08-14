import { render, screen } from '@testing-library/react';
import { AppContext } from '../App.jsx';
import BudgetPanel from '../components/BudgetPanel.jsx';

const YEAR = 2025;
const MONTH = 5;
const FUND_ID = 'f1';
const CAT = 'Hrana';

function makeCtx(dataOverrides = {}) {
  return {
    data: {
      expenses: [],
      categories: [CAT],
      budget: {},
      trackingMaps: {},
      recurrings: [],
      monthlyNotes: {},
      savingsGoals: [],
      ...dataOverrides,
    },
  };
}

function renderPanel(dataOverrides = {}) {
  const { container } = render(
    <AppContext.Provider value={makeCtx(dataOverrides)}>
      <BudgetPanel year={YEAR} month={MONTH} />
    </AppContext.Provider>
  );
  return { container };
}

describe('BudgetPanel — renders nothing without tracking', () => {
  test('returns null when trackingMaps is empty', () => {
    const { container } = renderPanel();
    expect(container.firstChild).toBeNull();
  });

  test('returns null when fund has no mapped categories', () => {
    const { container } = renderPanel({
      budget: {
        [YEAR]: { income: {}, funds: [{ id: FUND_ID, name: 'Test', amounts: Array(12).fill(10000) }] },
      },
      trackingMaps: { [YEAR]: { [FUND_ID]: [] } },
    });
    expect(container.firstChild).toBeNull();
  });
});

// A savings fund's money is set aside, not spent, so it must never be measured
// against expenses — including any categories it still carries from before it
// was flagged, which the toggle deliberately leaves in place.
describe('BudgetPanel — savings funds are not spending', () => {
  const savingsFund = { id: 'f-save', name: 'Putovanje', amounts: Array(12).fill(20000), kind: 'savings' };

  test('a savings fund with mapped categories is excluded', () => {
    const { container } = renderPanel({
      budget: { [YEAR]: { income: {}, funds: [savingsFund] } },
      trackingMaps: { [YEAR]: { 'f-save': [CAT] } },
    });
    expect(container.firstChild).toBeNull();
  });

  test('a mixed year shows only the spending fund', () => {
    renderPanel({
      budget: {
        [YEAR]: {
          income: {},
          funds: [
            savingsFund,
            { id: FUND_ID, name: 'Mesečni rashodi', amounts: Array(12).fill(50000) },
          ],
        },
      },
      trackingMaps: { [YEAR]: { 'f-save': [CAT], [FUND_ID]: [CAT] } },
    });
    expect(screen.getByText('Mesečni rashodi')).toBeInTheDocument();
    expect(screen.queryByText('Putovanje')).not.toBeInTheDocument();
  });
});

describe('BudgetPanel — fund rows', () => {
  const budget = {
    [YEAR]: {
      income: {},
      funds: [{ id: FUND_ID, name: 'Mesečni rashodi', amounts: Array(12).fill(50000) }],
    },
  };
  const trackingMaps = { [YEAR]: { [FUND_ID]: [CAT] } };

  test('renders fund name', () => {
    renderPanel({ budget, trackingMaps });
    expect(screen.getByText('Mesečni rashodi')).toBeInTheDocument();
  });

  test('renders spent / allocated amounts', () => {
    const expenses = [{ id: '1', date: '2025-06-10', amount: 20000, category: CAT, title: 'x', note: '' }];
    renderPanel({ budget, trackingMaps, expenses });
    expect(screen.getByText(/20\.000 \/ 50\.000/)).toBeInTheDocument();
  });

  test('renders positive remaining for under-budget fund', () => {
    const expenses = [{ id: '1', date: '2025-06-10', amount: 20000, category: CAT, title: 'x', note: '' }];
    renderPanel({ budget, trackingMaps, expenses });
    expect(screen.getByText(/\+30\.000/)).toBeInTheDocument();
  });

  test('renders negative remaining for over-budget fund', () => {
    const expenses = [{ id: '1', date: '2025-06-10', amount: 60000, category: CAT, title: 'x', note: '' }];
    renderPanel({ budget, trackingMaps, expenses });
    expect(screen.getByText(/−10\.000/)).toBeInTheDocument();
  });

  test('sums multiple expenses in the mapped category', () => {
    const expenses = [
      { id: '1', date: '2025-06-10', amount: 8000, category: CAT, title: 'x', note: '' },
      { id: '2', date: '2025-06-11', amount: 2000, category: CAT, title: 'y', note: '' },
    ];
    renderPanel({ budget, trackingMaps, expenses });
    expect(screen.getByText(/10\.000 \/ 50\.000/)).toBeInTheDocument();
  });

  // Spend goes through getTotalAmount, so a string amount adds rather than
  // concatenating. withDefaults normalizes these on load, but the panel must
  // not be the thing that depends on that having happened.
  test('adds string amounts instead of concatenating them', () => {
    const expenses = [
      { id: '1', date: '2025-06-10', amount: '8000', category: CAT, title: 'x', note: '' },
      { id: '2', date: '2025-06-11', amount: '2000', category: CAT, title: 'y', note: '' },
    ];
    renderPanel({ budget, trackingMaps, expenses });
    expect(screen.getByText(/10\.000 \/ 50\.000/)).toBeInTheDocument();
    expect(screen.getByText(/\+40\.000/)).toBeInTheDocument();
  });

  test('renders "nije postavljeno" when budget amount is null', () => {
    const nullBudget = {
      [YEAR]: {
        income: {},
        funds: [{ id: FUND_ID, name: 'Fond', amounts: Array(12).fill(null) }],
      },
    };
    renderPanel({ budget: nullBudget, trackingMaps });
    expect(screen.getByText(/nije postavljeno/i)).toBeInTheDocument();
  });
});
