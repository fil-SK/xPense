import { useApp } from '../App.jsx';

export default function Header() {
  const { view, navigateTo, darkMode, toggleDarkMode, autosaveStatus, setupAutosave, activateAutosave } = useApp();

  return (
    <header className="header">
      <div className="header__inner">
        <div className="header__logo" onClick={() => navigateTo('home')}>
          💸 <span>Tracker Troškova</span>
        </div>
        <nav className="header__nav">
          <button
            className={`header__btn ${view === 'home' ? 'header__btn--active' : ''}`}
            onClick={() => navigateTo('home')}
          >
            Početna
          </button>
          <button
            className={`header__btn ${view === 'previous' || view === 'month' ? 'header__btn--active' : ''}`}
            onClick={() => navigateTo('previous')}
          >
            Prethodne
          </button>
          <button
            className={`header__btn ${view === 'search' ? 'header__btn--active' : ''}`}
            onClick={() => navigateTo('search')}
            title="Pretraži sve troškove"
          >
            🔍
          </button>

          <div className="header__sep" />

          <button
            className={`header__btn ${view === 'budget' ? 'header__btn--active' : ''}`}
            onClick={() => navigateTo('budget')}
          >
            Budžet
          </button>
          <button
            className={`header__btn ${view === 'tracking' ? 'header__btn--active' : ''}`}
            onClick={() => navigateTo('tracking')}
          >
            Praćenje
          </button>
          <button
            className={`header__btn ${view === 'categories' ? 'header__btn--active' : ''}`}
            onClick={() => navigateTo('categories')}
          >
            Kategorije
          </button>

          <div className="header__sep" />

          {autosaveStatus === 'none' && (
            <button
              className="header__btn header__autosave header__autosave--none"
              onClick={setupAutosave}
              title="Podesi automatsko čuvanje podataka u fajl na disku"
            >
              💾 Podesi
            </button>
          )}
          {autosaveStatus === 'prompt' && (
            <button
              className="header__btn header__autosave header__autosave--prompt"
              onClick={activateAutosave}
              title="Klikni da dozvoliš pristup fajlu za automatsko čuvanje"
            >
              💾 Aktiviraj
            </button>
          )}
          {autosaveStatus === 'active' && (
            <span
              className="header__autosave header__autosave--active"
              title="Autosave aktivan — podaci se automatski čuvaju u fajl"
            >
              💾
            </span>
          )}
          {autosaveStatus === 'error' && (
            <button
              className="header__btn header__autosave header__autosave--error"
              onClick={setupAutosave}
              title="Greška pri čuvanju — klikni da ponovo podesiš"
            >
              💾 !
            </button>
          )}
          <button
            className="header__btn header__theme-btn"
            onClick={toggleDarkMode}
            title={darkMode ? 'Svetla tema' : 'Tamna tema'}
          >
            {darkMode ? '☀️' : '🌙'}
          </button>
        </nav>
      </div>
    </header>
  );
}
