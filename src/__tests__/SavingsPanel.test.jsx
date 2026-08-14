import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppContext } from '../App.jsx';
import SavingsPanel from '../components/SavingsPanel.jsx';

const YEAR = 2026;
const MONTH = 1; // Februar
const FUND_ID = 'f-save';

// Differing months on purpose: a row that prefilled the wrong month's plan
// would pass against a flat Array(12).fill(x).
const PLAN = Array(12).fill(null);
PLAN[0] = 10000;
PLAN[1] = 20000;
PLAN[2] = 30000;

const savingsFund = (overrides = {}) => ({
  id: FUND_ID,
  name: 'Putovanje',
  amounts: [...PLAN],
  kind: 'savings',
  ...overrides,
});

const withConfirmed = (month, value) => {
  const contributions = Array(12).fill(null);
  contributions[month] = value;
  return savingsFund({ contributions });
};

function renderPanel(funds, { month = MONTH } = {}) {
  const confirmFundContribution = vi.fn();
  const clearFundContribution = vi.fn();
  const ctx = {
    data: {
      expenses: [],
      categories: ['Hrana'],
      budget: funds
        ? { [YEAR]: { income: { plata: Array(12).fill(null), bonus: Array(12).fill(null) }, funds } }
        : {},
      trackingMaps: {},
      recurrings: [],
      monthlyNotes: {},
      savingsGoals: [],
    },
    confirmFundContribution,
    clearFundContribution,
  };
  const { container } = render(
    <AppContext.Provider value={ctx}>
      <SavingsPanel year={YEAR} month={month} />
    </AppContext.Provider>
  );
  return { container, confirmFundContribution, clearFundContribution };
}

describe('SavingsPanel — when it appears at all', () => {
  test('renders nothing when the year has no budget', () => {
    expect(renderPanel(null).container.firstChild).toBeNull();
  });

  // This is what keeps the section invisible for every user who never opts in.
  test('renders nothing when every fund is a spending fund', () => {
    const spending = { id: 'f1', name: 'Hrana', amounts: [...PLAN] };
    expect(renderPanel([spending]).container.firstChild).toBeNull();
  });

  test('renders one row per savings fund, and no spending funds', () => {
    renderPanel([
      savingsFund(),
      { id: 'f1', name: 'Hrana', amounts: [...PLAN] },
      savingsFund({ id: 'f-save2', name: 'Rezerva' }),
    ]);
    expect(screen.getByText('Putovanje')).toBeInTheDocument();
    expect(screen.getByText('Rezerva')).toBeInTheDocument();
    expect(screen.queryByText('Hrana')).not.toBeInTheDocument();
  });
});

describe('SavingsPanel — confirming a month', () => {
  test('the input is prefilled with this month\'s plan', () => {
    renderPanel([savingsFund()]);
    expect(screen.getByLabelText(/odvojeno za putovanje/i)).toHaveValue('20000');
  });

  test('Potvrdi confirms the planned amount for this month', async () => {
    const user = userEvent.setup();
    const { confirmFundContribution } = renderPanel([savingsFund()]);
    await user.click(screen.getByRole('button', { name: /potvrdi odvajanje: putovanje/i }));
    expect(confirmFundContribution).toHaveBeenCalledWith(YEAR, FUND_ID, MONTH, 20000);
  });

  // The whole point of recording an amount rather than a checkbox.
  test('a typed amount wins over the plan', async () => {
    const user = userEvent.setup();
    const { confirmFundContribution } = renderPanel([savingsFund()]);
    const input = screen.getByLabelText(/odvojeno za putovanje/i);
    await user.clear(input);
    await user.type(input, '15000');
    await user.click(screen.getByRole('button', { name: /potvrdi odvajanje: putovanje/i }));
    expect(confirmFundContribution).toHaveBeenCalledWith(YEAR, FUND_ID, MONTH, 15000);
  });

  test('Serbian number formatting is understood', async () => {
    const user = userEvent.setup();
    const { confirmFundContribution } = renderPanel([savingsFund()]);
    const input = screen.getByLabelText(/odvojeno za putovanje/i);
    await user.clear(input);
    await user.type(input, '1.500,50');
    await user.click(screen.getByRole('button', { name: /potvrdi odvajanje: putovanje/i }));
    expect(confirmFundContribution).toHaveBeenCalledWith(YEAR, FUND_ID, MONTH, 1501);
  });

  // It is a real form, so this comes for free rather than from a keydown handler.
  test('Enter in the input confirms', async () => {
    const user = userEvent.setup();
    const { confirmFundContribution } = renderPanel([savingsFund()]);
    await user.type(screen.getByLabelText(/odvojeno za putovanje/i), '{Enter}');
    expect(confirmFundContribution).toHaveBeenCalledWith(YEAR, FUND_ID, MONTH, 20000);
  });

  test('a month with no plan renders, with Potvrdi blocked until an amount is typed', async () => {
    const user = userEvent.setup();
    const { confirmFundContribution } = renderPanel([savingsFund()], { month: 6 });
    expect(screen.getByText(/nije planirano/i)).toBeInTheDocument();
    const button = screen.getByRole('button', { name: /potvrdi odvajanje: putovanje/i });
    expect(button).toBeDisabled();
    await user.type(screen.getByLabelText(/odvojeno za putovanje/i), '5000');
    expect(button).toBeEnabled();
    await user.click(button);
    expect(confirmFundContribution).toHaveBeenCalledWith(YEAR, FUND_ID, 6, 5000);
  });

  // "I set aside nothing this month" is an answer the plan cannot express.
  test('zero is a confirmable amount', async () => {
    const user = userEvent.setup();
    const { confirmFundContribution } = renderPanel([savingsFund()]);
    const input = screen.getByLabelText(/odvojeno za putovanje/i);
    await user.clear(input);
    await user.type(input, '0');
    await user.click(screen.getByRole('button', { name: /potvrdi odvajanje: putovanje/i }));
    expect(confirmFundContribution).toHaveBeenCalledWith(YEAR, FUND_ID, MONTH, 0);
  });

  test('garbage blocks the save rather than being stored', async () => {
    const user = userEvent.setup();
    renderPanel([savingsFund()]);
    const input = screen.getByLabelText(/odvojeno za putovanje/i);
    await user.clear(input);
    await user.type(input, 'abc');
    expect(screen.getByRole('button', { name: /potvrdi odvajanje: putovanje/i })).toBeDisabled();
  });
});

describe('SavingsPanel — an already-confirmed month', () => {
  test('shows the confirmed amount instead of an input', () => {
    renderPanel([withConfirmed(MONTH, 15000)]);
    expect(screen.getByText(/odvojeno: 15\.000 RSD/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/odvojeno za putovanje/i)).not.toBeInTheDocument();
  });

  test('a shortfall against the plan is spelled out', () => {
    renderPanel([withConfirmed(MONTH, 15000)]);
    expect(screen.getByText(/−5\.000 od plana/)).toBeInTheDocument();
  });

  test('overshooting the plan is spelled out too', () => {
    renderPanel([withConfirmed(MONTH, 25000)]);
    expect(screen.getByText(/\+5\.000 preko plana/)).toBeInTheDocument();
  });

  // A confirmed zero is a confirmation, not a month still waiting to be filled.
  test('a confirmed zero reads as confirmed, not pending', () => {
    renderPanel([withConfirmed(MONTH, 0)]);
    expect(screen.getByText(/odvojeno: 0 RSD/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /potvrdi odvajanje/i })).not.toBeInTheDocument();
  });

  test('a confirmation in another month leaves this one pending', () => {
    renderPanel([withConfirmed(0, 10000)]);
    expect(screen.getByLabelText(/odvojeno za putovanje/i)).toHaveValue('20000');
  });

  test('Izmeni reopens the input seeded with the confirmed amount, not the plan', async () => {
    const user = userEvent.setup();
    renderPanel([withConfirmed(MONTH, 15000)]);
    await user.click(screen.getByRole('button', { name: /izmeni odvajanje: putovanje/i }));
    expect(screen.getByLabelText(/odvojeno za putovanje/i)).toHaveValue('15000');
  });

  test('Otkaži drops the draft and restores the confirmed amount', async () => {
    const user = userEvent.setup();
    const { confirmFundContribution } = renderPanel([withConfirmed(MONTH, 15000)]);
    await user.click(screen.getByRole('button', { name: /izmeni odvajanje: putovanje/i }));
    await user.type(screen.getByLabelText(/odvojeno za putovanje/i), '9');
    await user.click(screen.getByRole('button', { name: /otkaži izmenu odvajanja: putovanje/i }));
    expect(confirmFundContribution).not.toHaveBeenCalled();
    expect(screen.getByText(/odvojeno: 15\.000 RSD/i)).toBeInTheDocument();
  });

  // One click — the undo on the toast replaces the confirm.
  test('Ukloni un-confirms on the first click', async () => {
    const user = userEvent.setup();
    const { clearFundContribution } = renderPanel([withConfirmed(MONTH, 15000)]);
    await user.click(screen.getByRole('button', { name: /ukloni potvrdu odvajanja: putovanje/i }));
    expect(clearFundContribution).toHaveBeenCalledWith(YEAR, FUND_ID, MONTH);
    expect(clearFundContribution).toHaveBeenCalledTimes(1);
  });
});

describe('SavingsPanel — month summary', () => {
  test('totals what was set aside against what was planned', () => {
    renderPanel([withConfirmed(MONTH, 15000), savingsFund({ id: 'f2', name: 'Rezerva' })]);
    expect(screen.getByText(/Odvojeno: 15\.000 od planiranih 40\.000 RSD/)).toBeInTheDocument();
  });
});
