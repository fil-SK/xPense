import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../utils/fileStorage.js', () => ({
  getStoredHandle: vi.fn().mockResolvedValue(null),
  checkPermission: vi.fn(),
  grantPermission: vi.fn(),
  readFromFile: vi.fn(),
  writeToFile: vi.fn(),
  pickFile: vi.fn(),
}));

import App from '../App.jsx';

const KEY = 'expense-tracker-v1';

// Home only lists the current month, so the fixtures have to follow the clock.
const NOW = new Date();
const YEAR = NOW.getFullYear();
const MONTH = String(NOW.getMonth() + 1).padStart(2, '0');
const dayIn = (d) => `${YEAR}-${MONTH}-${String(d).padStart(2, '0')}`;

const STORED = {
  expenses: [
    { id: 'e1', title: 'Kafa', date: dayIn(2), amount: 350, category: 'Hrana', note: '' },
    { id: 'e2', title: 'Bus', date: dayIn(3), amount: 100, category: 'Transport', note: '' },
  ],
  categories: ['Hrana', 'Transport', 'Ostalo'],
  categoryGroups: [],
  budget: {},
  trackingMaps: {},
  recurrings: [],
  monthlyNotes: {},
  savingsGoals: [{ id: 'g1', name: 'Peni fond', target: 50000, fundId: null, year: null }],
};

const stored = () => JSON.parse(localStorage.getItem(KEY));

beforeEach(() => {
  localStorage.setItem(KEY, JSON.stringify(STORED));
});

const undoButton = () => screen.findByRole('button', { name: /poništi/i });

// Deleting used to cost two clicks and still be final. It now costs one, and
// the toast is the way back — so the toast is load-bearing, not decoration.
describe('App — undoing a deleted expense', () => {
  test('one click deletes it and offers an undo', async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => expect(localStorage.getItem(KEY)).not.toBeNull());

    await user.click(screen.getByRole('button', { name: /obriši trošak: kafa/i }));

    await waitFor(() => expect(stored().expenses).toHaveLength(1));
    expect(await undoButton()).toBeInTheDocument();
  });

  test('the undo puts the expense back', async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => expect(localStorage.getItem(KEY)).not.toBeNull());

    await user.click(screen.getByRole('button', { name: /obriši trošak: kafa/i }));
    await waitFor(() => expect(stored().expenses).toHaveLength(1));

    await user.click(await undoButton());

    await waitFor(() => expect(stored().expenses).toHaveLength(2));
    expect(stored().expenses.map((e) => e.id)).toEqual(['e1', 'e2']);
    expect(await screen.findByText(/trošak vraćen/i)).toBeInTheDocument();
  });

  test('the undo button goes away once used', async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => expect(localStorage.getItem(KEY)).not.toBeNull());

    await user.click(screen.getByRole('button', { name: /obriši trošak: kafa/i }));
    await user.click(await undoButton());

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /poništi/i })).not.toBeInTheDocument();
    });
  });

  // The reason undo is a per-field restore and not a wholesale data/replace:
  // whatever the user did in the seconds the toast was up has to survive it.
  test('an unrelated change made while the toast is up survives the undo', async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => expect(localStorage.getItem(KEY)).not.toBeNull());

    await user.click(screen.getByRole('button', { name: /obriši trošak: kafa/i }));
    await waitFor(() => expect(stored().expenses).toHaveLength(1));

    // Adding a group raises no toast of its own, so the undo stays reachable.
    await user.click(screen.getByRole('button', { name: /kategorije/i }));
    await user.click(screen.getByRole('button', { name: /^grupe$/i }));
    await user.type(screen.getByPlaceholderText(/ime nove grupe/i), 'Režije');
    await user.click(screen.getByRole('button', { name: /\+ dodaj grupu/i }));
    await waitFor(() => expect(stored().categoryGroups).toHaveLength(1));

    await user.click(await undoButton());

    await waitFor(() => expect(stored().expenses).toHaveLength(2));
    expect(stored().categoryGroups.map((g) => g.name)).toEqual(['Režije']);
  });
});

describe('App — undoing other deletes', () => {
  test('a savings goal comes back', async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => expect(localStorage.getItem(KEY)).not.toBeNull());

    await user.click(screen.getByRole('button', { name: /obriši cilj: peni fond/i }));
    await waitFor(() => expect(stored().savingsGoals).toHaveLength(0));

    await user.click(await undoButton());

    await waitFor(() => expect(stored().savingsGoals).toHaveLength(1));
    expect(stored().savingsGoals[0].name).toBe('Peni fond');
  });

  test('a category comes back with the expenses it was reassigned from', async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => expect(localStorage.getItem(KEY)).not.toBeNull());

    await user.click(screen.getByRole('button', { name: /kategorije/i }));
    const row = screen.getByText('Hrana').closest('.cat-item');
    await user.click(within(row).getByTitle(/ukloni kategoriju/i));
    await user.click(within(row).getByRole('button', { name: /obriši/i }));

    await waitFor(() => expect(stored().categories).not.toContain('Hrana'));
    expect(stored().expenses.find((e) => e.id === 'e1').category).toBe('Ostalo');

    await user.click(await undoButton());

    await waitFor(() => expect(stored().categories).toContain('Hrana'));
    expect(stored().expenses.find((e) => e.id === 'e1').category).toBe('Hrana');
  });
});
