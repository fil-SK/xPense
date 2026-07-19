# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # start dev server at localhost:5173
npm run build    # production build → dist/
```

`start.bat` in the project root opens a cmd window running `npm run dev` and launches Chrome automatically.

There are no tests and no linter configured.

## Architecture

Single-page React app with no router — navigation is purely state-based (`view` string in `App.jsx`).

### State and data flow

All global state lives in `App.jsx` via React Context (`AppContext`). Every component reads state and calls actions through the `useApp()` hook. There is no external state library.

The full data object shape:
```js
{
  expenses: [{ id, date, amount, category, name, note }],
  categories: [string],
  budget: {
    [year]: {
      income: { plata: [12 values], bonus: [12 values] },
      funds: [{ id, name, amounts: [12 values] }]
    }
  },
  trackingMaps: { [year]: { [fundId]: [categoryName] } }
}
```

`null` in a budget amount array means "not set" (renders as `—`); `0` means explicitly zero.

### Persistence

Two layers, both managed in `App.jsx`:
- **localStorage** (`expense-tracker-v1`) — always written on every `data` state change via `useEffect`
- **File autosave** (`storage/xpense-data.json`) — written on every `data` change when active; uses the File System Access API with the handle stored in IndexedDB (`xpense-fs` DB). On startup, the file is only read when localStorage is missing (recovery mode). Theme preference is stored separately under `expense-tracker-theme` and is never included in data exports.

`src/utils/storage.js` handles localStorage read/write and JSON import/export.  
`src/utils/fileStorage.js` handles IndexedDB handle storage and File System Access API read/write.

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

### Key component notes

- **`BudgetView.jsx`** — year is local state (‹/› nav buttons); `currentMonth` highlight is only applied when viewing the actual current year (set to `-1` otherwise).
- **`BudgetPanel.jsx`** — rendered inside `MonthView` above the expense list; shows live fund vs. actual spend status (green/orange/red) using `trackingMaps` to link funds to categories.
- **`Charts.jsx`** — rendered above the expense list when toggled; pie chart for category breakdown, bar chart for month comparison.
- **`TrackingSetup.jsx`** — maps budget fund IDs to expense category names; auto-saves on every pill toggle.

### Styling

All styles are in `src/index.css` — one flat file, BEM-ish class names per component (`.budget__*`, `.bg__*`, `.cat-*`, `.bp-*`, etc.). Dark mode uses `html.dark` class toggled on `document.documentElement`; CSS variables are overridden in the `html.dark {}` block at the bottom of the file. Always use `var(--text)`, `var(--bg-card)`, etc. on new inputs/elements so they respect the theme automatically.

### Serbian language and locale

All UI text is in Serbian. Amounts are in RSD. Number formatting uses `sr-RS` locale (`toLocaleString('sr-RS')`). Budget cell input parsing strips `.` (thousands separator) and replaces `,` with `.` before parsing as float.
