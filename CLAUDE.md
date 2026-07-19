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

**Current test files (169 tests, 13 files):**
- `helpers.test.js` — all pure functions in `utils/helpers.js`
- `storage.test.js` — `loadData`, `saveData`, `importJSON`, `importBudget`, `buildCSVString`
- `dataTransforms.test.js` — `generateRecurringExpenses`, `applyBudgetCopy`
- `GlobalSearch.test.jsx` — rendering, search filtering, navigation callbacks
- `ExpenseModal.test.jsx` — add/edit/recurring flows, validation; submit disabled until category selected; group card picker (auto-expand, pill select, flat-pill fallback)
- `MonthView.test.jsx` — back navigation via prevView, monthly note textarea
- `SavingsGoals.test.jsx` — empty state, add form, progress calculation, two-click delete
- `Header.test.jsx` — Praćenje absent, Prethodne button render/active states, theme toggle
- `Home.test.jsx` — quick-add circle button, modal open/close, removed Prethodne card
- `BudgetPanel.test.jsx` — null render, fund rows, amounts, remaining, "nije postavljeno"
- `PreviousSpendings.test.jsx` — 12-card grid, note snippet, truncation, empty state
- `BudgetView.test.jsx` — category chip render/count, inline panel expand/collapse, one-at-a-time, pill add/remove calls
- `CategoryManager.test.jsx` — archive vs delete two-choice confirm, usage count, rename, add, duplicate guard; Grupe tab (add/delete group, expand + checkboxes, membership toggle, rename, cross-group hint)

**Context wrapper for component tests:** Import `AppContext` from `App.jsx` and wrap with `<AppContext.Provider value={mockCtx}>`. The mock context needs `data`, `navigateTo`, and whichever action callbacks the component uses — see existing test files for the pattern.

## Architecture

Single-page React app with no router — navigation is purely state-based (`view` string in `App.jsx`).

### State and data flow

All global state lives in `App.jsx` via React Context (`AppContext`). Every component reads state and calls actions through the `useApp()` hook. There is no external state library.

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
  recurrings: [{ id, title, amount, category, note, startDate, frequency }],
  monthlyNotes: { [year]: { [month]: string } },
  savingsGoals: [{ id, name, target, fundId, year }]
}
```

`null` in a budget amount array means "not set" (renders as `—`); `0` means explicitly zero.
`recurringId` on an expense links it back to its `recurrings` template (auto-generated expenses only).
`monthlyNotes` keys use numeric year and numeric month (0-indexed). `savingsGoals.fundId` and `savingsGoals.year` are nullable (unlinked goal shows 0 progress).

### Persistence

Two layers, both managed in `App.jsx`:
- **localStorage** (`expense-tracker-v1`) — always written on every `data` state change via `useEffect`
- **File autosave** (`storage/xpense-data.json`) — written on every `data` change when active; uses the File System Access API with the handle stored in IndexedDB (`xpense-fs` DB). On startup, the file is only read when localStorage is missing (recovery mode). Theme preference is stored separately under `expense-tracker-theme` and is never included in data exports.

`src/utils/storage.js` handles localStorage read/write, JSON import/export, and CSV export (`buildCSVString` + `exportCSV`). The BOM prefix in `exportCSV` ensures Excel opens the file with correct UTF-8 encoding.
`src/utils/fileStorage.js` handles IndexedDB handle storage and File System Access API read/write.

When adding new top-level fields to the data shape, backfill them in four places: the empty-localStorage return in `loadData()`, the parsed-JSON return in `loadData()`, the error-catch return in `loadData()`, and the file-recovery `setData` call in `App.jsx`. Also update `importJSON` to pass the field through. See `categoryGroups` as the reference example.

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
- **`ExpenseModal.jsx`** — form starts with `category: ''`; the submit button is `disabled={!form.category}` so the user must pick a category before saving. Category picker renders as expandable group cards (`CategoryGroupPicker` inline component) when `data.categoryGroups` is non-empty: cards expand/collapse independently, the group containing the current category is auto-expanded on open, selecting a pill keeps the card open. Falls back to flat pills when no groups are configured. The recurring 🔁 toggle button uses `aria-label="Ponavljajući trošak"` (queryable in tests).
- **`Charts.jsx`** — rendered above the expense list when toggled; pie chart for category breakdown, bar chart for month comparison.
- **`GlobalSearch.jsx`** — searches across all expenses (title, category, note), sorted by date desc; clicking a result navigates to that month's MonthView.
- **`SavingsGoals.jsx`** — savings goal list with progress bars; progress = sum of all non-null amounts in the linked budget fund for the linked year. Goal year select defaults to the most recent budget year that exists. Delete requires two clicks.
- **`MonthView.jsx`** — includes a monthly-note textarea between the stats row and BudgetPanel; saves on blur only when text has changed.
- **`PreviousSpendings.jsx`** — shows a note snippet (≤55 chars) at the bottom of each month card when a `monthlyNotes` entry exists. Important: when adding fields to the `monthsData` useMemo result objects, always destructure them in the `.map()` callback or they will be silently undefined in JSX.

### Recurring expenses

`ExpenseModal` (add mode only) has a 🔁 toggle button (`aria-label="Ponavljajući trošak"`) with a muted label below it. When active, submit calls `addRecurring` instead of `addExpense` — the template is stored in `data.recurrings`. A `useEffect` in `App.jsx` (dependency: `data.recurrings`) auto-generates expense entries via `setData` functional update for every month from `startDate` up to the current month, skipping any month where a matching `recurringId` entry already exists. Recurring expenses show a 🔄 badge in `ExpenseItem`.

### Pure utilities extracted for testability

`src/utils/dataTransforms.js` contains `generateRecurringExpenses` and `applyBudgetCopy`, extracted from App.jsx closures so they can be unit-tested without rendering. App.jsx imports and calls them; behavior is identical.

### Styling

All styles are in `src/index.css` — one flat file, BEM-ish class names per component (`.budget__*`, `.bg__*`, `.cat-*`, `.bp-*`, `.gsearch__*`, `.goal-*`, etc.). Dark mode uses `html.dark` class toggled on `document.documentElement`; CSS variables are overridden in the `html.dark {}` block at the bottom of the file. Always use `var(--text)`, `var(--bg-card)`, etc. on new inputs/elements so they respect the theme automatically.

### Serbian language and locale

All UI text is in Serbian. Amounts are in RSD. Number formatting uses `sr-RS` locale (`toLocaleString('sr-RS')`). Budget cell input parsing strips `.` (thousands separator) and replaces `,` with `.` before parsing as float.
