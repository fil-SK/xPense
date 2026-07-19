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
