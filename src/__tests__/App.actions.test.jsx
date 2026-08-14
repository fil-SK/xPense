import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
import { ACTION_TYPES } from '../state/dataReducer.js';

const KEY = 'expense-tracker-v1';
const stored = () => JSON.parse(localStorage.getItem(KEY));

// Components are tested against a mocked context, so a mistyped action type in
// App.jsx would never be exercised there — it would only throw once a real user
// clicked the button. This scans the source for every type it dispatches.
describe('App action wiring', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/App.jsx'), 'utf8');
  const dispatched = [...source.matchAll(/type:\s*'([^']+)'/g)].map((m) => m[1]);

  test('App dispatches a meaningful number of action types', () => {
    expect(new Set(dispatched).size).toBeGreaterThan(15);
  });

  test.each([...new Set(dispatched)])('"%s" is handled by a slice', (type) => {
    expect(ACTION_TYPES).toContain(type);
  });
});

describe('App actions through the real context', () => {
  test('adding an expense persists it with a generated id', async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => expect(localStorage.getItem(KEY)).not.toBeNull());

    await user.click(screen.getByRole('button', { name: /dodaj trošak/i }));
    await user.type(screen.getByPlaceholderText(/npr/i), 'Testni trošak');
    await user.type(screen.getByRole('spinbutton'), '1234');
    await user.click(screen.getByRole('button', { name: 'Transport' }));

    const footer = document.querySelector('.modal__footer');
    await user.click(within(footer).getByRole('button', { name: /dodaj trošak/i }));

    await waitFor(() => expect(stored().expenses).toHaveLength(1));
    expect(stored().expenses[0]).toMatchObject({
      title: 'Testni trošak',
      amount: 1234,
      category: 'Transport',
    });
    expect(typeof stored().expenses[0].id).toBe('string');
    expect(stored().expenses[0].id.length).toBeGreaterThan(0);
  });

  test('adding an expense confirms with a toast', async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => expect(localStorage.getItem(KEY)).not.toBeNull());

    await user.click(screen.getByRole('button', { name: /dodaj trošak/i }));
    await user.type(screen.getByPlaceholderText(/npr/i), 'Kafa');
    await user.type(screen.getByRole('spinbutton'), '300');
    await user.click(screen.getByRole('button', { name: 'Transport' }));
    const footer = document.querySelector('.modal__footer');
    await user.click(within(footer).getByRole('button', { name: /dodaj trošak/i }));

    expect(await screen.findByText(/trošak dodat/i)).toBeInTheDocument();
  });

  test('adding a category from the Kategorije view persists it', async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => expect(localStorage.getItem(KEY)).not.toBeNull());

    await user.click(screen.getByRole('button', { name: /kategorije/i }));
    await user.type(screen.getByPlaceholderText(/ime nove kategorije/i), 'Putovanja');
    await user.click(screen.getByRole('button', { name: /^\+ Dodaj$/ }));

    await waitFor(() => expect(stored().categories).toContain('Putovanja'));
  });

  // The 💰 flag and the confirmations live inside `budget`, so this also pins
  // that they survive the trip through localStorage.
  test('flagging a fund as savings and confirming a month persists both', async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => expect(localStorage.getItem(KEY)).not.toBeNull());
    const year = new Date().getFullYear();

    await user.click(screen.getByRole('button', { name: /budžet/i }));
    await user.type(screen.getByPlaceholderText(/dodaj fond ili kategoriju/i), 'Putovanje{Enter}');
    await waitFor(() => expect(stored().budget[year].funds).toHaveLength(1));

    await user.click(screen.getByRole('button', { name: 'Fond štednje: Putovanje' }));
    await waitFor(() => expect(stored().budget[year].funds[0].kind).toBe('savings'));

    // Back to the month, where confirmations are actually made.
    await user.click(screen.getByRole('button', { name: /početna/i }));
    await user.click(screen.getByRole('button', { name: /prethodne/i }));
    const monthCard = screen.getAllByRole('button', { name: /januar/i })[0];
    await user.click(monthCard);

    const input = screen.getByLabelText(/odvojeno za putovanje/i);
    await user.type(input, '12000');
    await user.click(screen.getByRole('button', { name: /potvrdi odvajanje: putovanje/i }));

    await waitFor(() =>
      expect(stored().budget[year].funds[0].contributions[0]).toBe(12000)
    );
  });
});
