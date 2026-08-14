import { useApp } from '../App.jsx';
import { getMonthName } from '../utils/helpers.js';

function IconHome() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h14V9.5" />
    </svg>
  );
}
function IconCalendar() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 9.5h17M8 3v4M16 3v4" />
    </svg>
  );
}
function IconHistory() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" /><path d="M3.5 4v4h4" /><path d="M12 8v4l3 2" />
    </svg>
  );
}
function IconWallet() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2.5" /><path d="M3 9h18M9 4v16M15 4v16" />
    </svg>
  );
}
function IconPulse() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12h4l2.5-6 4 13L16 12h5" />
    </svg>
  );
}
function IconTag() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h7l9 9-7 7-9-9V4z" /><circle cx="8.5" cy="8.5" r="1.3" />
    </svg>
  );
}
function IconSearch() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" />
    </svg>
  );
}

export default function Header() {
  const { view, navigateTo, darkMode, toggleDarkMode, autosaveStatus, setupAutosave, activateAutosave } = useApp();
  const now = new Date();

  return (
    <aside className="sidebar">
      <button className="sidebar__logo" onClick={() => navigateTo('home')}>
        <span className="sidebar__logo-mark">x</span>
        <span className="sidebar__logo-text">xPense</span>
      </button>

      <div className="sidebar__search" onClick={() => navigateTo('search')} title="Pretraži sve troškove">
        <IconSearch />
        <input placeholder="Pretraži…" readOnly />
      </div>

      <nav className="sidebar__nav">
        <button
          className={`header__btn ${view === 'home' ? 'header__btn--active' : ''}`}
          onClick={() => navigateTo('home')}
        >
          <IconHome />
          <span>Početna</span>
        </button>
        <button
          className={`header__btn ${view === 'current' ? 'header__btn--active' : ''}`}
          onClick={() => navigateTo('current')}
        >
          <IconCalendar />
          <span>{getMonthName(now.getMonth())} {now.getFullYear()}</span>
        </button>
        <button
          className={`header__btn ${view === 'previous' || view === 'month' ? 'header__btn--active' : ''}`}
          onClick={() => navigateTo('previous')}
        >
          <IconHistory />
          <span>Prethodne</span>
        </button>

        <div className="header__sep" />

        <button
          className={`header__btn ${view === 'budget' ? 'header__btn--active' : ''}`}
          onClick={() => navigateTo('budget')}
        >
          <IconWallet />
          <span>Budžet</span>
        </button>
        <button
          className={`header__btn ${view === 'overview' ? 'header__btn--active' : ''}`}
          onClick={() => navigateTo('overview')}
          title="Plan iz budžeta naspram stvarnog stanja"
        >
          <IconPulse />
          <span>Live pregled</span>
        </button>
        <button
          className={`header__btn ${view === 'categories' ? 'header__btn--active' : ''}`}
          onClick={() => navigateTo('categories')}
        >
          <IconTag />
          <span>Kategorije</span>
        </button>
      </nav>

      <div className="sidebar__footer">
        {autosaveStatus === 'none' && (
          <button
            className="header__btn header__autosave header__autosave--none"
            onClick={setupAutosave}
            title="Podesi automatsko čuvanje podataka u fajl na disku"
          >
            💾 <span>Podesi autosave</span>
          </button>
        )}
        {autosaveStatus === 'prompt' && (
          <button
            className="header__btn header__autosave header__autosave--prompt"
            onClick={activateAutosave}
            title="Klikni da dozvoliš pristup fajlu za automatsko čuvanje"
          >
            💾 <span>Aktiviraj autosave</span>
          </button>
        )}
        {autosaveStatus === 'active' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '12.5px', color: 'var(--text3)', padding: '0 8px' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)' }} />
            Sve promene sačuvane
          </div>
        )}
        {autosaveStatus === 'error' && (
          <button
            className="header__btn header__autosave header__autosave--error"
            onClick={setupAutosave}
            title="Greška pri čuvanju — klikni da ponovo podesiš"
          >
            💾 <span>Greška — ponovi</span>
          </button>
        )}

        <div className="sidebar__tools">
          <button
            className="sidebar__tool-btn header__theme-btn"
            onClick={toggleDarkMode}
            title={darkMode ? 'Svetla tema' : 'Tamna tema'}
          >
            {darkMode ? '☀️' : '🌙'} Tema
          </button>
        </div>
      </div>
    </aside>
  );
}
