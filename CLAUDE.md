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

**Current test files:**
- `helpers.test.js` — all pure functions in `utils/helpers.js`
- `storage.test.js` — `loadData`, `saveData`, `importJSON`, `importBudget`, `buildCSVString`
- `dataTransforms.test.js` — `generateRecurringExpenses`, `applyBudgetCopy`
- `GlobalSearch.test.jsx` — rendering, search filtering, navigation callbacks
- `ExpenseModal.test.jsx` — add/edit/recurring flows, validation
- `MonthView.test.jsx` — monthly note textarea (pre-fill, blur-save, no-op when unchanged)
- `SavingsGoals.test.jsx` — empty state, add form, progress calculation, two-click delete

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

When adding new top-level fields to the data shape, backfill them in three places: the empty-localStorage return in `loadData()`, the parsed-JSON return in `loadData()`, and the file-recovery `setData` call in `App.jsx`.

### Views

| `view` value | Component |
|---|---|
| `home` | `Home.jsx` |
| `current` | `MonthView` (current month) |
| `previous` | `PreviousSpendings.jsx` |
| `month` | `MonthView` (selectedYear/selectedMonth) |
| `categories` | `CategoryManager.jsx` |
| `budget` | `BudgetView.jsx` |
| `tracking` | `TrackingSetup.jsx` |
| `search` | `GlobalSearch.jsx` |

### Key component notes

- **`BudgetView.jsx`** — year is local state (‹/› nav buttons); `currentMonth` highlight only applies for the actual current year. "📋 Kopiraj u {year+1}" copies fund structure + plata income + tracking category links to the next year (double-click confirmation if target already has data). `copyBudgetToYear` in App.jsx assigns new fund IDs and remaps `trackingMaps`.
- **`BudgetPanel.jsx`** — rendered inside `MonthView` above the expense list; shows live fund vs. actual spend status (green/orange/red) using `trackingMaps` to link funds to categories.
- **`Charts.jsx`** — rendered above the expense list when toggled; pie chart for category breakdown, bar chart for month comparison.
- **`TrackingSetup.jsx`** — maps budget fund IDs to expense category names; auto-saves on every pill toggle.
- **`GlobalSearch.jsx`** — searches across all expenses (title, category, note), sorted by date desc; clicking a result navigates to that month's MonthView.
- **`Home.jsx`** — shows "Ponavljajući troškovi" section when `data.recurrings` is non-empty; renders `SavingsGoals` component at the bottom; hosts JSON and CSV export buttons.
- **`SavingsGoals.jsx`** — savings goal list with progress bars; progress = sum of all non-null amounts in the linked budget fund for the linked year. Goal year select defaults to the most recent budget year that exists. Delete requires two clicks.
- **`MonthView.jsx`** — includes a monthly-note textarea between the stats row and BudgetPanel; saves on blur only when text has changed.
- **`PreviousSpendings.jsx`** — shows a note snippet (≤55 chars) at the bottom of each month card when a `monthlyNotes` entry exists.

### Recurring expenses

`ExpenseModal` (add mode only) has a "Ponavljajući trošak" checkbox. When checked, submit calls `addRecurring` instead of `addExpense` — the template is stored in `data.recurrings`. A `useEffect` in `App.jsx` (dependency: `data.recurrings`) auto-generates expense entries via `setData` functional update for every month from `startDate` up to the current month, skipping any month where a matching `recurringId` entry already exists. Recurring expenses show a 🔄 badge in `ExpenseItem`.

### Pure utilities extracted for testability

`src/utils/dataTransforms.js` contains `generateRecurringExpenses` and `applyBudgetCopy`, extracted from App.jsx closures so they can be unit-tested without rendering. App.jsx imports and calls them; behavior is identical.

### Styling

All styles are in `src/index.css` — one flat file, BEM-ish class names per component (`.budget__*`, `.bg__*`, `.cat-*`, `.bp-*`, `.gsearch__*`, `.goal-*`, etc.). Dark mode uses `html.dark` class toggled on `document.documentElement`; CSS variables are overridden in the `html.dark {}` block at the bottom of the file. Always use `var(--text)`, `var(--bg-card)`, etc. on new inputs/elements so they respect the theme automatically.

### Serbian language and locale

All UI text is in Serbian. Amounts are in RSD. Number formatting uses `sr-RS` locale (`toLocaleString('sr-RS')`). Budget cell input parsing strips `.` (thousands separator) and replaces `,` with `.` before parsing as float.
