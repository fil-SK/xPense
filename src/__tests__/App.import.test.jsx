import { render, screen, waitFor } from '@testing-library/react';
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

const EXISTING = {
  expenses: [
    { id: 'old1', title: 'Stari trošak', date: '2026-08-01', amount: 500, category: 'Hrana', note: '' },
    { id: 'old2', title: 'Drugi stari', date: '2026-08-02', amount: 700, category: 'Hrana', note: '' },
  ],
  categories: ['Hrana', 'Transport'],
  budget: {},
  trackingMaps: {},
  recurrings: [],
  monthlyNotes: {},
  savingsGoals: [],
  categoryGroups: [],
};

const INCOMING = {
  expenses: [
    { id: 'new1', title: 'Uvezeni trošak', date: '2026-08-03', amount: 1200, category: 'Hrana', note: '' },
  ],
  categories: ['Hrana'],
};

function storedExpenses() {
  return JSON.parse(localStorage.getItem(KEY)).expenses;
}

async function importFile(user, payload) {
  const input = document.querySelector('input[type="file"]');
  await user.upload(input, new File([JSON.stringify(payload)], 'troskovi.json', { type: 'application/json' }));
  await screen.findByText(/zamenjuje sve trenutne podatke/i);
  await user.click(screen.getByRole('button', { name: /zameni podatke/i }));
}

beforeEach(() => {
  localStorage.setItem(KEY, JSON.stringify(EXISTING));
});

describe('App — importing and undoing', () => {
  test('confirming the dialog replaces the stored data', async () => {
    const user = userEvent.setup();
    render(<App />);

    await importFile(user, INCOMING);

    await waitFor(() => expect(storedExpenses()).toHaveLength(1));
    expect(storedExpenses()[0].title).toBe('Uvezeni trošak');
  });

  test('the success toast offers an undo', async () => {
    const user = userEvent.setup();
    render(<App />);

    await importFile(user, INCOMING);

    expect(await screen.findByRole('button', { name: /poništi/i })).toBeInTheDocument();
  });

  test('undo restores every expense that was replaced', async () => {
    const user = userEvent.setup();
    render(<App />);

    await importFile(user, INCOMING);
    await waitFor(() => expect(storedExpenses()).toHaveLength(1));

    await user.click(await screen.findByRole('button', { name: /poništi/i }));

    await waitFor(() => expect(storedExpenses()).toHaveLength(2));
    expect(storedExpenses().map((e) => e.id)).toEqual(['old1', 'old2']);
    expect(await screen.findByText(/uvoz poništen/i)).toBeInTheDocument();
  });

  test('the undo button disappears once used', async () => {
    const user = userEvent.setup();
    render(<App />);

    await importFile(user, INCOMING);
    await user.click(await screen.findByRole('button', { name: /poništi/i }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /poništi/i })).not.toBeInTheDocument();
    });
  });

  test('cancelling the dialog leaves the stored data untouched', async () => {
    const user = userEvent.setup();
    render(<App />);

    const input = document.querySelector('input[type="file"]');
    await user.upload(input, new File([JSON.stringify(INCOMING)], 'troskovi.json', { type: 'application/json' }));
    await screen.findByText(/zamenjuje sve trenutne podatke/i);
    await user.click(screen.getByRole('button', { name: /otkaži/i }));

    expect(storedExpenses()).toHaveLength(2);
  });
});
