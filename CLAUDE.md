# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # start dev server at localhost:5173
npm run build    # production build → dist/
npm test         # run all tests once (vitest run)
npm run test:watch      # watch mode
npm run test:coverage   # with coverage report
```

`start.bat` in the project root opens a cmd window running `npm run dev` and launches Chrome automatically.

There is no linter configured.

## Testing

**Stack:** Vitest + @testing-library/react + @testing-library/user-event + @testing-library/jest-dom + jsdom.

Test files live in `src/__tests__/`. Setup file is `src/test/setup.js` (clears localStorage before each test, extends jest-dom matchers). Globals (`describe`, `test`, `expect`, `vi`) are available without imports.

**Test workflow:** For every new feature or edit, write tests in the relevant file(s) before reporting done, then run `npm test` to confirm nothing is broken. If a new pure utility is added, test it in the helpers or dataTransforms suite. If a new component is added, add a `.test.jsx` file for it.

**Current test files (369 tests, 20 files):**
- `helpers.test.js` — all pure functions in `utils/helpers.js`, incl. `lastDayOfMonth` / `isoDate` / `clampISODate` / `monthKey` day-clamping and padding, `categoryColor` stability, and the string-prefix month matching in `getExpensesForMonth` / `getAvailableMonths` (padding, rolled-over dates, missing dates)
- `storage.test.js` — `loadData`, `saveData`, `importJSON` (now resolves `{ data, skipped }`), `importBudget`, `buildCSVString`, `hasStoredData`, `withDefaults` (expense-date repair, amount coercion on expenses and recurrings, absent-field passthrough), `validateImportData` sanitising
- `dataTransforms.test.js` — `generateRecurringExpenses` (incl. `skippedMonths`, day clamping, and the `recurringId|YYYY-MM` existence index: per-template isolation, month padding, hand-entered rows, dateless rows), `applyBudgetCopy`, `isEmptyData`, `applyExpenseDeletion` (incl. the delete→regenerate round trip)
- `App.boot.test.jsx` — startup recovery from the backup file (fileStorage mocked): restore when localStorage is empty, skip when it isn't, never write the file on a failed or invalid read, wait for permission
- `GlobalSearch.test.jsx` — rendering, search filtering, navigation callbacks
- `ExpenseModal.test.jsx` — add/edit/recurring flows, validation; submit disabled until category selected; group card picker (auto-expand, pill select, flat-pill fallback); scrollable `.modal__body` contains the form but not header/footer
- `MonthView.test.jsx` — back navigation via prevView, monthly note textarea, Analiza toggle uses `.btn--toggled` with no inline colors
- `Charts.test.jsx` — `CHART_THEME` light/dark key parity and color-format sanity (no rendering; recharts needs a layout engine)
- `SavingsGoals.test.jsx` — empty state, add form, progress calculation, two-click delete
- `Header.test.jsx` — Praćenje absent, Prethodne button render/active states, theme toggle
- `Home.test.jsx` — quick-add circle button, modal open/close, removed Prethodne card, JSON import (confirm dialog appears instead of importing, confirm/cancel paths, malformed file)
- `ImportConfirmModal.test.jsx` — replace warning, current-vs-incoming counts, loss highlighting, skipped wording, confirm/cancel/Escape
- `App.import.test.jsx` — full import round trip through App: confirm replaces stored data, toast offers undo, undo restores every replaced expense
- `dataReducer.test.js` — every slice handler, routing, unknown-action throw, no duplicate action types across slices, immutability of inputs
- `App.actions.test.jsx` — scans `App.jsx` for every `type: '…'` it dispatches and asserts each is handled by a slice (component tests mock the context, so a typo would otherwise only surface at runtime), plus real add-expense and add-category flows through the live provider
- `BudgetPanel.test.jsx` — null render, fund rows, amounts, remaining, "nije postavljeno"
- `PreviousSpendings.test.jsx` — 12-card grid, note snippet, truncation, empty state
- `BudgetView.test.jsx` — category chip render/count, inline panel expand/collapse, one-at-a-time, pill add/remove calls
- `CategoryManager.test.jsx` — archive vs delete two-choice confirm, usage count, rename, add, duplicate guard; Grupe tab (add/delete group, expand + checkboxes, membership toggle, rename, cross-group hint)
- `styles.test.js` — scans `index.css` and `src/styles/`: index.css declares no rules, every style file is imported exactly once, and the three order-critical positions hold (`tokens.css` first, `responsive.css` after what it narrows, `dark.css` last). Also checks `dark.css` defines no variable missing from the light palette. Nothing renders CSS in tests, so an unimported file or a bad load order would otherwise only show up in the browser.

**Context wrapper for component tests:** Import `AppContext` from `App.jsx` and wrap with `<AppContext.Provider value={mockCtx}>`. The mock context needs `data`, `navigateTo`, and whichever action callbacks the component uses — see existing test files for the pattern.

## Architecture

Single-page React app with no router — navigation is purely state-based (`view` string in `App.jsx`).

### State and data flow

All global state lives in `App.jsx` via React Context (`AppContext`). Every component reads state and calls actions through the `useApp()` hook. There is no external state library.

**`data` is a `useReducer`, not `useState`.** The reducer lives in `src/state/` and is split by domain:

| File | Owns | Action prefixes |
|---|---|---|
| `expensesSlice.js` | expenses, recurrings, monthlyNotes | `expense/`, `recurring/`, `note/` |
| `categoriesSlice.js` | categories, categoryGroups | `category/`, `group/` |
| `budgetSlice.js` | budget, trackingMaps, savingsGoals | `budget/`, `tracking/`, `goal/` |
| `dataReducer.js` | routing + `data/replace` | — |

Each slice exports a `{ [type]: (data, payload) => data }` map; `dataReducer` merges them and throws on an unknown type (a silent no-op is much harder to spot than a thrown error). Slices are merged with object spread, so **two slices must never define the same action type** — `dataReducer.test.js` asserts this.

**Handlers must stay pure.** Ids are minted by the action creators in `App.jsx` (`newId()`) and arrive in the payload, never generated inside a handler — that is what makes the slices testable without React and safe under StrictMode's double-invoke. The recurring-generation effect follows the same rule: it computes the entries, assigns ids, then dispatches `expense/addGenerated`.

The actions object in `App.jsx` is a `useMemo` over `[showToast]` (both `dispatch` and `showToast` are stable), so it is built once. The context value is also memoized — without it, every toast appearing or disappearing re-rendered every consumer. Adding a data action means adding one handler to a slice and one thin wrapper in the actions object; the wrapper's only jobs are minting ids and raising toasts.

The full data object shape:
```js
{
  expenses: [{ id, date, amount, category, title, note, recurringId? }],
  categories: [string],
  categoryGroups: [{ id, name, categories: [string] }],
  budget: {
    [year]: {
      income: { plata: [12 values], bonus: [12 values] },
      funds: [{ id, name, amounts: [12 values] }]
    }
  },
  trackingMaps: { [year]: { [fundId]: [categoryName] } },
  recurrings: [{ id, title, amount, category, note, startDate, frequency, skippedMonths?: ['YYYY-MM'] }],
  monthlyNotes: { [year]: { [month]: string } },
  savingsGoals: [{ id, name, target, fundId, year }]
}
```

`null` in a budget amount array means "not set" (renders as `—`); `0` means explicitly zero.
`recurringId` on an expense links it back to its `recurrings` template (auto-generated expenses only).
`skippedMonths` is optional and holds `'YYYY-MM'` strings for months the user deleted by hand — see the recurring section below.
`monthlyNotes` keys use numeric year and numeric month (0-indexed). `savingsGoals.fundId` and `savingsGoals.year` are nullable (unlinked goal shows 0 progress).

### Persistence

Two layers, both managed in `App.jsx`:
- **localStorage** (`expense-tracker-v1`) — written on every `data` state change via `useEffect`, once `bootState === 'ready'`
- **File autosave** (`storage/xpense-data.json`) — written on every `data` change when active; uses the File System Access API with the handle stored in IndexedDB (`xpense-fs` DB). On startup, the file is only read when localStorage is missing (recovery mode). Theme preference is stored separately under `expense-tracker-theme` and is never included in data exports.

**Boot sequence (`bootState` + `recoveryPendingRef`).** "Was localStorage empty at startup?" must be answered during the *initial render* via `hasStoredData()` — the save effect writes a record almost immediately, after which the question is unanswerable. That answer seeds `bootState` (`'recovering'` | `'ready'`) and `recoveryPendingRef`. While `bootState === 'recovering'` **both** persistence effects are blocked, so nothing can overwrite localStorage or the backup file before recovery resolves.

Recovery rules, all of which exist to protect the backup file:
- `recoverFromFile` throws when the file is unreadable or isn't a valid export. On that path autosave is set to `'error'` and **never** `'active'` — an active autosave would immediately write empty data over the backup.
- Recovery refuses to replace state that is no longer empty (`isEmptyData` in `dataTransforms.js`), so it can't discard work entered while the read was in flight.
- If permission isn't granted at startup, `recoveryPendingRef` stays true and `activateAutosave` retries the recovery after the user grants access.
- `setupAutosave` (user picks a new file) clears `recoveryPendingRef` — current state intentionally wins over that file's contents.

`App.boot.test.jsx` covers these paths with `src/utils/fileStorage.js` mocked; three of its cases fail against the pre-fix boot order.

`src/utils/storage.js` handles localStorage read/write, JSON import/export, and CSV export (`buildCSVString` + `exportCSV`). The BOM prefix in `exportCSV` ensures Excel opens the file with correct UTF-8 encoding.

**Import is guarded in three stages**, because it replaces every record and the export button is labelled "za Claude" — hand-edited files are an expected input, not an exotic one:
1. `importJSON` rejects anything that isn't recognisably an xPense export (`expenses`/`categories` must be arrays).
2. `validateImportData` sanitises each expense and returns `{ data, skipped }`. Only an unusable date or a non-numeric amount drops a row; a missing title becomes `'Bez naziva'`, a missing category `'Ostalo'`, missing ids are generated, and duplicate ids are re-issued so React keys stay unique. Out-of-range days are repaired rather than rejected. `withDefaults` type-checks each top-level field, so a wrong-typed `budget` can no longer reach the UI.

   **It reads rows from `parsed`, not from `withDefaults(parsed)`.** Import and load deliberately disagree about a broken amount: load salvages it as `0` (the record is already in the app, so dropping it would lose data the user can still see and fix), while import rejects the row and reports it (the user still has the file). Iterating the already-normalised `base.expenses` would let the salvage run first and silently turn every rejection into a `0` — a regression the `skipped`-count tests catch.
3. `ImportConfirmModal` shows current-vs-incoming counts (shrinking numbers flagged in `--danger`) plus any skipped count, and nothing is applied until the user confirms.

After applying, `importData` puts the pre-import snapshot behind a **"Poništi" action on the toast**. `showToast(msg, type, { action, duration })` renders a button inside the toast and extends its lifetime to 9s (the CSS fade-out is delayed via `.toast:has(.toast__action)`). Note the dismiss handler clears the toast only when the action didn't raise one of its own — otherwise the follow-up toast is wiped instantly.
`src/utils/fileStorage.js` handles IndexedDB handle storage and File System Access API read/write.

**Amounts are numbers by the time they leave `withDefaults`.** `repairExpenses` and `repairRecurrings` coerce `amount` on every expense and recurring template, so readers don't each have to. This matters because `+` on a string concatenates rather than failing — `'800' + '200'` is `'800200'` — which is exactly what `BudgetPanel`'s per-fund spend used to do. A non-numeric value becomes `0`, never `NaN`, since `NaN` spreads into every total it touches and renders as "NaN RSD". Recurring templates are covered too, because `generateRecurringExpenses` copies `r.amount` verbatim into the expenses it mints and those go straight into state without passing back through `withDefaults`. An **absent** `amount` is left absent — these objects come from `JSON.parse`, so a missing field is an incomplete record, and inventing a `0` would reshape it and mask the problem. Sum expense amounts with `getTotalAmount`, don't hand-roll a `reduce`.

When adding a new top-level field to the data shape, add it to **`emptyData()` and `withDefaults()` in `storage.js` only**. Every entry point — `loadData()` (all three returns), `importJSON`, and the file-recovery path in `App.jsx` — routes through those two functions. Consider whether `isEmptyData()` in `dataTransforms.js` should treat the field as content.

### Navigation and prevView

`App.jsx` tracks navigation with two pieces of state: `view` (current view string) and `prevView` (the view before the last `navigateTo` call). `prevView` is stored in both a ref (`prevViewRef`) and state so components can read it from context. The ref is updated synchronously inside `navigateTo` before `setView` fires, ensuring the captured value is always the view the user navigated *from*.

`MonthView` uses `prevView` for its back button: `navigateTo(prevView || (isCurrent ? 'home' : 'previous'))`. This means back from a month opened via Search returns to Search, not PreviousSpendings.

### Views

| `view` value | Component |
|---|---|
| `home` | `Home.jsx` |
| `current` | `MonthView` (current month) |
| `previous` | `PreviousSpendings.jsx` |
| `month` | `MonthView` (selectedYear/selectedMonth) |
| `categories` | `CategoryManager.jsx` |
| `budget` | `BudgetView.jsx` |
| `search` | `GlobalSearch.jsx` |

### Key component notes

- **`Header.jsx`** — nav is split into two groups by thin `.header__sep` dividers: primary (Početna, Prethodne, 🔍) and tools (Budžet, Kategorije), followed by autosave status and theme toggle. "Prethodne" is active for both `view === 'previous'` and `view === 'month'`. There is no separate Praćenje nav item — tracking is inline in BudgetView.
- **`Home.jsx`** — hero row has the greeting text centered and a circular `+` button (`home__add-btn`) positioned `absolute; right: 0` so it doesn't shift the centered text. Clicking opens `ExpenseModal` with today's date via local `adding` state — the modal is managed in Home, not App. The "Pogledaj prethodne potrošnje" action card was removed (superseded by the Prethodne nav button). Renders `SavingsGoals` at the bottom.
- **`BudgetPanel.jsx`** — renders inside `MonthView` above the expense list; shows live fund vs. actual spend as compact single-column rows (`bp-row`): dot indicator | fund name | progress bar | spent/allocated | remaining. Returns null if no funds have tracking categories mapped.
- **`BudgetView.jsx`** — year is local state (‹/› nav buttons); `currentMonth` highlight only applies for the actual current year. "📋 Kopiraj u {year+1}" copies fund structure + plata income + tracking category links to the next year (double-click confirmation if target already has data). `copyBudgetToYear` in App.jsx assigns new fund IDs and remaps `trackingMaps`. Each fund row has a **📂 chip** (shows mapped-category count) that expands an inline tracking panel directly below the row; only one panel can be open at a time; panel hides during drag. The chip and panel are rendered inside `SortableFundRow` as a React Fragment — the `setNodeRef` (DnD target) attaches to the first `<tr>`, the panel is a second sibling `<tr>`. Flex containers inside `<td>` require explicit `width: 100%` and `flex: 1; min-width: 0` on inner flex children to wrap correctly in table layout.
- **`CategoryManager.jsx`** — two-tab interface: **Kategorije** (flat list with archive/delete/rename/add, same as before) and **Grupe** (group management). In the Kategorije tab, the 🗑️ button expands into two choices: **Arhiviraj** (removes name from `data.categories` only, expenses unchanged) and **Obriši** (removes and reassigns all matching expenses to "Ostalo"), wired to `archiveCategory` and `deleteCategory`. In the Grupe tab, each group row has a header (click to expand) that reveals checkboxes for all categories — checked = in this group. Checking a category auto-removes it from any other group it was in. `data-testid="group-{id}"` is on each group row for test scoping with `within()`. Group actions: `addCategoryGroup`, `renameCategoryGroup`, `deleteCategoryGroup`, `updateCategoryGroupMembers`. All category mutation actions (`deleteCategory`, `archiveCategory`, `updateCategory`) sync `categoryGroups` automatically.
- **`ExpenseModal.jsx`** — form starts with `category: ''`; the submit button is `disabled={!form.category}` so the user must pick a category before saving. Category picker renders as expandable group cards (`CategoryGroupPicker` inline component) when `data.categoryGroups` is non-empty: cards expand/collapse independently, the group containing the current category is auto-expanded on open, selecting a pill keeps the card open. Falls back to flat pills when no groups are configured. The recurring 🔁 toggle button uses `aria-label="Ponavljajući trošak"` (queryable in tests). The dialog is a flex column capped at `calc(100dvh - 32px)`: header and footer are fixed (`flex-shrink: 0`), all form fields sit in a scrolling `.modal__body` (`flex: 1; min-height: 0; overflow-y: auto`) that uses negative side margins matching the modal padding so the scrollbar sits at the modal edge — if the modal padding changes, update those margins in both media queries too.
- **`Charts.jsx`** — rendered above the expense list when toggled; pie chart for category breakdown, bar chart for month comparison. Pie slices are *ordered* by value but *colored* by category via `categoryColor`, so they match the dots and badges in the list below. Recharts paints into SVG attributes, which cannot read CSS variables — the grid, axis ticks, bars and hover cursor therefore come from the exported `CHART_THEME` table, picked with `darkMode` from context. `CHART_THEME.light` mirrors `:root` and `.dark` mirrors `html.dark`; update both together when those blocks change. The default recharts tooltip is themed from CSS instead (`html.dark .recharts-default-tooltip`).
- **`GlobalSearch.jsx`** — searches across all expenses (title, category, note), sorted by date desc; clicking a result navigates to that month's MonthView.
- **`SavingsGoals.jsx`** — savings goal list with progress bars; progress = sum of all non-null amounts in the linked budget fund for the linked year. Goal year select defaults to the most recent budget year that exists. Delete requires two clicks.
- **`MonthView.jsx`** — includes a monthly-note textarea between the stats row and BudgetPanel; saves on blur only when text has changed.
- **`PreviousSpendings.jsx`** — shows a note snippet (≤55 chars) at the bottom of each month card when a `monthlyNotes` entry exists. Important: when adding fields to the `monthsData` useMemo result objects, always destructure them in the `.map()` callback or they will be silently undefined in JSX.

### Recurring expenses

`ExpenseModal` (add mode only) has a 🔁 toggle button (`aria-label="Ponavljajući trošak"`) with a muted label below it. When active, submit calls `addRecurring` instead of `addExpense` — the template is stored in `data.recurrings`. A `useEffect` in `App.jsx` (dependency: `data.recurrings`) auto-generates expense entries via `setData` functional update for every month from `startDate` up to the current month, skipping any month where a matching `recurringId` entry already exists. Recurring expenses show a 🔄 badge in `ExpenseItem`.

**Dates are clamped, never rolled over.** A template starting on the 29th–31st must not emit `'2026-02-31'` — JS parses that as March 3, so the expense lands in the wrong month and the intended month looks empty. `generateRecurringExpenses` builds dates with `isoDate(year, month, day)` from `helpers.js`, which clamps the day to `lastDayOfMonth`. Records written before this fix are repaired on load by `repairExpenses` inside `withDefaults` (`storage.js`), using `clampISODate`; it returns the original object when nothing needed fixing, so it is a no-op for healthy data. Use `isoDate` for any new date construction rather than string concatenation, and `monthKey(year, month)` for the `'YYYY-MM'` form (`isoDate` and `generateRecurringExpenses`' `skippedMonths` both build on it).

**Month filtering is a string prefix, not a `Date` comparison.** `getExpensesForMonth` and `getAvailableMonths` read the year and month straight off the `'YYYY-MM-DD'` string. This is a hot path — Home calls the former twice per render, PreviousSpendings 24 times in its memo — and constructing a `Date` per expense per call measured ~28× slower at 5,000 expenses. It is also the more correct comparison: a stale `'2026-02-31'` parses to March 3, so the `Date` version filed it under March, while the prefix match keeps it in the month it names. Don't reintroduce `new Date(e.date + 'T00:00:00')` in a filter.

**"Does this month already exist?" is an index lookup, not a scan.** `generateRecurringExpenses` builds one `Set` of `'recurringId|YYYY-MM'` keys from the expense list up front, then tests each candidate month against it. It used to run a `.some()` over every expense from inside the template × year × month loops, so the work grew as the product of all three — ~28ms per call at 5,000 expenses and 12 templates, versus ~1ms now, and flat as the list grows. Only rows carrying a `recurringId` enter the index, so a hand-entered expense in the same month does not suppress generation.

**Deletion must be remembered.** That effect re-runs on every startup — `loadData()` returns a fresh `recurrings` array, so its identity always changes — which means a generated expense the user deleted would be recreated on the next reload. `deleteExpense` therefore routes through `applyExpenseDeletion` (`dataTransforms.js`), which appends the expense's `'YYYY-MM'` to the parent template's `skippedMonths`; `generateRecurringExpenses` skips those months. Deleting a generated expense shows a distinct toast ("neće biti ponovo kreiran") because the exclusion is permanent — there is currently no UI to un-skip a month, only re-adding the expense manually.

Known edge: editing a generated expense's date into a different month leaves the original month empty, so it gets regenerated on the next pass. Moving generated expenses across months is not really supported. This and the missing "un-skip a month" affordance are both written up in `BACKLOG.md`.

### Pure utilities extracted for testability

`src/utils/dataTransforms.js` contains `generateRecurringExpenses`, `applyBudgetCopy`, `applyExpenseDeletion`, and `isEmptyData`, extracted from App.jsx closures so they can be unit-tested without rendering. App.jsx imports and calls them; behavior is identical.

### Styling

Styles live in **`src/styles/`, one file per component or shared concern**, stitched together by `src/index.css`. `index.css` holds no rules — only a table of contents and an ordered list of `@import`s — and stays the single entry point (`main.jsx` imports it). BEM-ish class names per component (`.budget__*`, `.bg__*`, `.cat-*`, `.bp-*`, `.gsearch__*`, `.goal-*`, etc.). Always use `var(--text)`, `var(--bg-card)`, etc. on new inputs/elements so they respect the theme automatically.

**The import order in `index.css` is the cascade**, because Vite inlines `@import` in the order written. Three positions are load-bearing and `styles.test.js` asserts them:
- `tokens.css` **first** — every other file reads its custom properties.
- `responsive.css` **second-to-last** — its media queries narrow `.home__actions`, `.form-row` and `.modal` at the *same* specificity as the base rules, so it must follow `home.css` / `forms.css` / `modal.css`.
- `dark.css` **last** — several budget-grid overrides in it are `!important` and beat the light rules only on source order.

Adding a stylesheet means creating the file, appending it to the right group in `index.css`, and giving it a header comment naming the component it styles. `styles.test.js` fails on a file nobody imports, so a new file can't go silently dead.

Dark mode uses an `html.dark` class toggled on `document.documentElement`; the palette is overridden in the `html.dark {}` block in `dark.css`, which mirrors `:root` in `tokens.css`. `dark.css` may only define variables that already exist in the light palette — one defined solely under `html.dark` would resolve to nothing in light mode, so `styles.test.js` checks that direction too. (`--radius`, `--radius-sm` and `--font-display` are intentionally light-only: they aren't themed.)

Scrollbars are themed globally in `tokens.css` via `*` + `*::-webkit-scrollbar`, driven by `--scrollbar-thumb` / `--scrollbar-thumb-hover`. Chrome 121+ honours the standard `scrollbar-width`/`scrollbar-color` properties and ignores the `::-webkit-*` rules; older Chromium uses the `::-webkit-*` rules. Both are defined so either path stays on-theme — if you restyle one, restyle the other.

**Never hardcode a hex color in a component.** The dark palette is green-primary (`--primary: #2bd47c`) while light is indigo (`#6366f1`), so a literal like `#6366f1` is not merely off-shade in dark mode — it's the wrong hue entirely. Use `var(--…)` in inline styles, or a class. Toggle buttons use `.btn--toggled` (generic) or `.section-head__toggle--active`; both resolve to `var(--soft)` / `var(--primary)`. The only legitimate literals left in components are `CHART_THEME` in `Charts.jsx` (SVG can't read CSS vars) and `color: '#fff'` on pills whose background is a saturated `CHART_COLORS` value.

### Category colors

`categoryColor(category, categories)` in `utils/helpers.js` is the single source of truth — every dot, pill, badge, chart slice and legend entry goes through it. Never index `CHART_COLORS` directly in a component: the pie chart used to color slices by their sorted position, which made the same category one color in the chart and another in the list beside it.

Color is chosen by the category's position in `data.categories`, so a category keeps its color as the list grows. Names not in the list (archived, or arriving from an import) fall back to a hash of the name, so they stay distinct and stable rather than all collapsing onto the first color.

### Serbian language and locale

All UI text is in Serbian. Amounts are in RSD. Number formatting uses `sr-RS` locale (`toLocaleString('sr-RS')`). Budget cell input parsing strips `.` (thousands separator) and replaces `,` with `.` before parsing as float.
