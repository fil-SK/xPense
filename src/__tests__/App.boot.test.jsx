import { render, screen, waitFor } from '@testing-library/react';

vi.mock('../utils/fileStorage.js', () => ({
  getStoredHandle: vi.fn(),
  checkPermission: vi.fn(),
  grantPermission: vi.fn(),
  readFromFile: vi.fn(),
  writeToFile: vi.fn(),
  pickFile: vi.fn(),
}));

import App from '../App.jsx';
import {
  getStoredHandle, checkPermission, readFromFile, writeToFile,
} from '../utils/fileStorage.js';

const KEY = 'expense-tracker-v1';
const HANDLE = { name: 'xpense-data.json' };

const BACKUP = {
  expenses: [
    { id: 'e1', title: 'Backup trošak', date: '2026-03-04', amount: 1200, category: 'Hrana i piće', note: '' },
  ],
  categories: ['Hrana i piće', 'Transport'],
  budget: { 2026: { income: { plata: Array(12).fill(null), bonus: Array(12).fill(null) }, funds: [] } },
  trackingMaps: {},
  recurrings: [],
  monthlyNotes: {},
  savingsGoals: [],
  categoryGroups: [],
};

function storedData() {
  const raw = localStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : null;
}

beforeEach(() => {
  vi.clearAllMocks();
  getStoredHandle.mockResolvedValue(null);
  checkPermission.mockResolvedValue('granted');
  readFromFile.mockResolvedValue(BACKUP);
  writeToFile.mockResolvedValue(undefined);
});

describe('App boot — backup file recovery', () => {
  test('restores the backup file when localStorage is empty', async () => {
    getStoredHandle.mockResolvedValue(HANDLE);

    render(<App />);

    expect(await screen.findByText(/vraćeni iz backup/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(storedData()?.expenses).toHaveLength(1);
    });
    expect(storedData().expenses[0].title).toBe('Backup trošak');
  });

  test('does not read the file when localStorage already holds data', async () => {
    localStorage.setItem(KEY, JSON.stringify({ ...BACKUP, expenses: [] }));
    getStoredHandle.mockResolvedValue(HANDLE);

    render(<App />);

    await waitFor(() => expect(checkPermission).toHaveBeenCalled());
    expect(readFromFile).not.toHaveBeenCalled();
    // localStorage stays the source of truth — the empty list is not replaced
    await waitFor(() => expect(writeToFile).toHaveBeenCalled());
    expect(storedData().expenses).toEqual([]);
  });

  test('never overwrites the backup when it cannot be read', async () => {
    getStoredHandle.mockResolvedValue(HANDLE);
    readFromFile.mockRejectedValue(new Error('permission lost'));

    render(<App />);

    expect(await screen.findByText(/ne može pročitati/i)).toBeInTheDocument();
    expect(writeToFile).not.toHaveBeenCalled();
  });

  test('never overwrites the backup when it holds an invalid export', async () => {
    getStoredHandle.mockResolvedValue(HANDLE);
    readFromFile.mockResolvedValue({ nonsense: true });

    render(<App />);

    expect(await screen.findByText(/ne može pročitati/i)).toBeInTheDocument();
    expect(writeToFile).not.toHaveBeenCalled();
  });

  test('boots normally with no stored handle', async () => {
    render(<App />);

    await waitFor(() => expect(storedData()).not.toBeNull());
    expect(readFromFile).not.toHaveBeenCalled();
    expect(writeToFile).not.toHaveBeenCalled();
  });

  test('waits for permission before recovering, leaving the file untouched', async () => {
    getStoredHandle.mockResolvedValue(HANDLE);
    checkPermission.mockResolvedValue('prompt');

    render(<App />);

    await waitFor(() => expect(checkPermission).toHaveBeenCalled());
    expect(readFromFile).not.toHaveBeenCalled();
    expect(writeToFile).not.toHaveBeenCalled();
  });
});
