import { CHART_THEME } from '../components/Charts.jsx';

// Recharts paints into SVG attributes and can't read CSS variables, so both
// themes are spelled out by hand. A key present in one but not the other means
// recharts silently falls back to its own default for that theme.
describe('CHART_THEME', () => {
  test('light and dark define exactly the same keys', () => {
    expect(Object.keys(CHART_THEME.dark).sort()).toEqual(Object.keys(CHART_THEME.light).sort());
  });

  test.each(['light', 'dark'])('%s defines a usable color for every key', (variant) => {
    const entries = Object.entries(CHART_THEME[variant]);
    expect(entries.length).toBeGreaterThan(0);
    entries.forEach(([key, value]) => {
      expect(typeof value, key).toBe('string');
      expect(value, key).toMatch(/^(#[0-9a-f]{3,8}|rgba?\()/i);
    });
  });

  test('the two themes actually differ', () => {
    expect(CHART_THEME.light).not.toEqual(CHART_THEME.dark);
  });
});
