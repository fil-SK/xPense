import { useApp } from '../App.jsx';

export default function Header() {
  const { view, navigateTo, darkMode, toggleDarkMode } = useApp();

  return (
    <header className="header">
      <div className="header__inner">
        <div className="header__logo" onClick={() => navigateTo('home')}>
          💸 <span>Tracker Troškova</span>
        </div>
        <nav className="header__nav">
          <button
            className="header__btn header__theme-btn"
            onClick={toggleDarkMode}
            title={darkMode ? 'Svetla tema' : 'Tamna tema'}
          >
            {darkMode ? '☀️' : '🌙'}
          </button>
          <button
            className={`header__btn ${view === 'home' ? 'header__btn--active' : ''}`}
            onClick={() => navigateTo('home')}
          >
            Početna
          </button>
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
        </nav>
      </div>
    </header>
  );
}
