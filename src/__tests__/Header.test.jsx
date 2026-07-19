import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppContext } from '../App.jsx';
import Header from '../components/Header.jsx';

function renderHeader(ctxOverrides = {}) {
  const navigateTo = vi.fn();
  const ctx = {
    view: 'home',
    navigateTo,
    darkMode: false,
    toggleDarkMode: vi.fn(),
    autosaveStatus: 'none',
    setupAutosave: vi.fn(),
    activateAutosave: vi.fn(),
    ...ctxOverrides,
  };
  render(
    <AppContext.Provider value={ctx}>
      <Header />
    </AppContext.Provider>
  );
  return { navigateTo };
}

describe('Header — Prethodne button', () => {
  test('renders Prethodne button', () => {
    renderHeader();
    expect(screen.getByRole('button', { name: /prethodne/i })).toBeInTheDocument();
  });

  test('clicking Prethodne calls navigateTo("previous")', async () => {
    const user = userEvent.setup();
    const { navigateTo } = renderHeader();
    await user.click(screen.getByRole('button', { name: /prethodne/i }));
    expect(navigateTo).toHaveBeenCalledWith('previous');
  });

  test('Prethodne is active when view is "previous"', () => {
    renderHeader({ view: 'previous' });
    expect(screen.getByRole('button', { name: /prethodne/i })).toHaveClass('header__btn--active');
  });

  test('Prethodne is active when view is "month"', () => {
    renderHeader({ view: 'month' });
    expect(screen.getByRole('button', { name: /prethodne/i })).toHaveClass('header__btn--active');
  });

  test('Početna is active only on home view', () => {
    renderHeader({ view: 'home' });
    expect(screen.getByRole('button', { name: /^početna$/i })).toHaveClass('header__btn--active');
    expect(screen.getByRole('button', { name: /prethodne/i })).not.toHaveClass('header__btn--active');
  });
});

describe('Header — theme toggle', () => {
  test('renders theme toggle button in light mode', () => {
    renderHeader({ darkMode: false });
    expect(screen.getByTitle(/tamna tema/i)).toBeInTheDocument();
  });

  test('renders theme toggle button in dark mode', () => {
    renderHeader({ darkMode: true });
    expect(screen.getByTitle(/svetla tema/i)).toBeInTheDocument();
  });

  test('clicking theme toggle calls toggleDarkMode', async () => {
    const user = userEvent.setup();
    const toggleDarkMode = vi.fn();
    renderHeader({ toggleDarkMode });
    await user.click(screen.getByTitle(/tamna tema/i));
    expect(toggleDarkMode).toHaveBeenCalled();
  });
});
