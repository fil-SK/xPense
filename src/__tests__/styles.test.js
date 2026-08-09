import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// The stylesheet is split across src/styles/ and stitched together by
// src/index.css. Nothing renders these files in a test, so the split's two
// failure modes are invisible: a style file nobody imports (silently dead), and
// a load order that puts an override before the rule it overrides. Both are
// checked here against the source text.

const read = (p) => readFileSync(resolve(process.cwd(), p), 'utf8');

const manifest = read('src/index.css');
const imports = [...manifest.matchAll(/^@import\s+'\.\/styles\/([^']+)';$/gm)].map((m) => m[1]);
const files = readdirSync(resolve(process.cwd(), 'src/styles')).filter((f) => f.endsWith('.css'));

describe('stylesheet manifest', () => {
  test('index.css declares no rules of its own', () => {
    const withoutComments = manifest.replace(/\/\*[\s\S]*?\*\//g, '');
    const stray = withoutComments
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('@import'));
    expect(stray).toEqual([]);
  });

  test('imports every file in src/styles/, exactly once', () => {
    expect([...imports].sort()).toEqual([...files].sort());
    expect(new Set(imports).size).toBe(imports.length);
  });

  test('every import resolves to a real file', () => {
    for (const f of imports) {
      expect(existsSync(resolve(process.cwd(), 'src/styles', f))).toBe(true);
    }
  });
});

describe('stylesheet load order', () => {
  // Vite inlines @import in written order, so this list is the cascade.
  test('tokens.css loads first — everything else reads its custom properties', () => {
    expect(imports[0]).toBe('tokens.css');
  });

  test('dark.css loads last — its budget-grid overrides win only on source order', () => {
    expect(imports.at(-1)).toBe('dark.css');
  });

  test('responsive.css loads after the files its media queries narrow', () => {
    const at = (f) => imports.indexOf(f);
    for (const narrowed of ['home.css', 'forms.css', 'modal.css']) {
      expect(at('responsive.css')).toBeGreaterThan(at(narrowed));
    }
  });
});

describe('dark theme', () => {
  const varsIn = (text, block) => {
    const body = text.slice(text.indexOf(block) + block.length);
    return new Set([...body.slice(0, body.indexOf('}')).matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
  };

  test('every variable dark.css sets is also defined in the light palette', () => {
    const light = varsIn(read('src/styles/tokens.css'), ':root {');
    const dark = varsIn(read('src/styles/dark.css'), 'html.dark {');

    expect(dark.size).toBeGreaterThan(20);
    // A variable defined only under html.dark would resolve to nothing in the
    // light theme, so the two blocks can drift apart in one direction only.
    expect([...dark].filter((v) => !light.has(v))).toEqual([]);
  });
});
