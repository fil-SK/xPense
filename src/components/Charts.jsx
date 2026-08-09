import { useState, useMemo } from 'react';
import {
  PieChart, Pie, Cell, Tooltip as RTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as BTooltip, Legend,
} from 'recharts';
import {
  getByCategory, formatAmount, categoryColor,
  getExpensesForMonth, getTotalAmount, MONTHS_SR_SHORT,
} from '../utils/helpers.js';
import { useApp } from '../App.jsx';

// Recharts draws into SVG attributes, which can't read CSS variables, so the
// theme has to be handed to it explicitly. These mirror the `:root` and
// `html.dark` blocks in index.css — keep them in step if those change.
export const CHART_THEME = {
  light: {
    grid: '#e2e8f0',                    // --border
    tick: '#64748b',                    // --text-muted
    bar: '#6366f1',                     // --primary
    barMuted: '#a5b4fc',
    cursor: 'rgba(15, 23, 42, .05)',
  },
  dark: {
    grid: '#2b352e',
    tick: '#95a29b',
    bar: '#2bd47c',
    barMuted: 'rgba(43, 212, 124, .42)',
    cursor: 'rgba(255, 255, 255, .06)',
  },
};

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: 'var(--text)' }}>
      <div style={{ fontWeight: 700 }}>{payload[0].name}</div>
      <div style={{ color: 'var(--primary)' }}>{formatAmount(payload[0].value)}</div>
    </div>
  );
}

function PieSection({ expenses }) {
  const { data } = useApp();
  const byCategory = getByCategory(expenses);
  // Slices are ordered by value, but colored by category so they match the
  // dots and badges in the expense list below.
  const chartData = Object.entries(byCategory)
    .map(([name, value]) => ({ name, value, color: categoryColor(name, data.categories) }))
    .sort((a, b) => b.value - a.value);

  if (!chartData.length) {
    return <div className="chart-card__empty">Nema podataka za ovaj mesec.</div>;
  }

  const total = getTotalAmount(expenses);

  return (
    <>
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
          >
            {chartData.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <RTooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="legend-list">
        {chartData.map((entry) => (
          <div key={entry.name} className="legend-item">
            <span className="legend-dot" style={{ background: entry.color }} />
            <span>{entry.name}</span>
            <span style={{ fontWeight: 600, color: 'var(--text)' }}>
              {((entry.value / total) * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

function CompareSection({ currentYear, currentMonth }) {
  const { data, darkMode } = useApp();
  const theme = darkMode ? CHART_THEME.dark : CHART_THEME.light;
  const [selected, setSelected] = useState([]);

  const availableMonths = useMemo(() => {
    const months = [];
    const now = new Date(currentYear, currentMonth, 1);
    for (let i = 1; i <= 11; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      const exps = getExpensesForMonth(data.expenses, y, m);
      if (exps.length > 0) {
        months.push({ year: y, month: m, label: `${MONTHS_SR_SHORT[m]} ${y}` });
      }
    }
    return months;
  }, [data.expenses, currentYear, currentMonth]);

  function toggleMonth(key) {
    setSelected((s) => s.includes(key) ? s.filter((k) => k !== key) : [...s, key]);
  }

  const chartData = useMemo(() => {
    const currentExp = getExpensesForMonth(data.expenses, currentYear, currentMonth);
    const rows = [
      { month: `${MONTHS_SR_SHORT[currentMonth]} ${currentYear}`, total: getTotalAmount(currentExp), isCurrent: true },
    ];
    availableMonths
      .filter((m) => selected.includes(`${m.year}-${m.month}`))
      .forEach((m) => {
        const exps = getExpensesForMonth(data.expenses, m.year, m.month);
        rows.push({ month: m.label, total: getTotalAmount(exps) });
      });
    return rows.reverse();
  }, [data.expenses, currentYear, currentMonth, availableMonths, selected]);

  if (!availableMonths.length) {
    return (
      <div className="chart-card__empty" style={{ padding: '16px 0 0' }}>
        Nema prethodnih meseci za poređenje.
      </div>
    );
  }

  return (
    <div>
      <div className="compare-month-picker">
        {availableMonths.map((m) => {
          const key = `${m.year}-${m.month}`;
          return (
            <button
              key={key}
              className={`compare-chip ${selected.includes(key) ? 'compare-chip--active' : ''}`}
              onClick={() => toggleMonth(key)}
            >
              {m.label}
            </button>
          );
        })}
      </div>
      {chartData.length > 1 && (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData} margin={{ top: 4, right: 12, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.grid} />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: theme.tick }} stroke={theme.grid} />
            <YAxis
              tickFormatter={(v) => (v / 1000).toFixed(0) + 'k'}
              tick={{ fontSize: 12, fill: theme.tick }}
              stroke={theme.grid}
              width={44}
            />
            <BTooltip formatter={(v) => formatAmount(v)} cursor={{ fill: theme.cursor }} />
            <Bar dataKey="total" name="Ukupno (RSD)" radius={[6, 6, 0, 0]}>
              {chartData.map((entry) => (
                <Cell key={entry.month} fill={entry.isCurrent ? theme.bar : theme.barMuted} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default function Charts({ expenses, year, month }) {
  const [activeTab, setActiveTab] = useState('pie');

  return (
    <div className="charts-section">
      <div className="chart-card">
        <div className="chart-card__header">
          <span className="chart-card__title">Analiza troškova</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className={`compare-chip ${activeTab === 'pie' ? 'compare-chip--active' : ''}`}
              onClick={() => setActiveTab('pie')}
            >
              Po kategoriji
            </button>
            <button
              className={`compare-chip ${activeTab === 'compare' ? 'compare-chip--active' : ''}`}
              onClick={() => setActiveTab('compare')}
            >
              Poređenje meseci
            </button>
          </div>
        </div>

        {activeTab === 'pie' && <PieSection expenses={expenses} />}
        {activeTab === 'compare' && <CompareSection currentYear={year} currentMonth={month} />}
      </div>
    </div>
  );
}
