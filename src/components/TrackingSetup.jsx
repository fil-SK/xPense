import { useApp } from '../App.jsx';
import { CHART_COLORS } from '../utils/helpers.js';

export default function TrackingSetup() {
  const { data, updateTrackingMap } = useApp();
  const year = new Date().getFullYear();

  const funds = data.budget?.[year]?.funds ?? [];
  const yearMaps = data.trackingMaps?.[year] ?? {};

  function toggle(fundId, category) {
    const current = yearMaps[fundId] ?? [];
    const next = current.includes(category)
      ? current.filter((c) => c !== category)
      : [...current, category];
    updateTrackingMap(year, fundId, next);
  }

  if (funds.length === 0) {
    return (
      <div className="tracking-empty">
        <div className="tracking-empty__icon">📋</div>
        <div className="tracking-empty__title">Nema fondova za {year}.</div>
        <div className="tracking-empty__sub">
          Dodaj fondove u <strong>Budžet</strong>, pa se ovde vrati da podeliš kategorije troškova po fondovima.
        </div>
      </div>
    );
  }

  return (
    <div className="tracking-setup">
      <div className="tracking-setup__head">
        <div className="tracking-setup__title">Praćenje budžeta — {year}</div>
        <div className="tracking-setup__hint">
          Za svaki fond izaberi koje kategorije troškova utiču na njega. Promene se čuvaju automatski.
        </div>
      </div>

      <div className="tracking-setup__funds">
        {funds.map((fund) => {
          const mapped = yearMaps[fund.id] ?? [];
          return (
            <div key={fund.id} className="tracking-fund-card">
              <div className="tracking-fund-card__name">{fund.name}</div>
              <div className="tracking-fund-card__count">
                {mapped.length === 0
                  ? 'Nijedna kategorija nije dodata'
                  : `${mapped.length} ${mapped.length === 1 ? 'kategorija' : mapped.length < 5 ? 'kategorije' : 'kategorija'}`}
              </div>
              <div className="tracking-fund-card__pills">
                {data.categories.map((cat, i) => {
                  const color = CHART_COLORS[i % CHART_COLORS.length];
                  const active = mapped.includes(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      className="cat-pill tracking-pill"
                      style={
                        active
                          ? { background: color, borderColor: color, color: '#fff' }
                          : { background: color + '18', borderColor: color + '70', color }
                      }
                      onClick={() => toggle(fund.id, cat)}
                    >
                      {active && <span className="tracking-pill__check">✓ </span>}
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
