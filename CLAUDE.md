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

**Current test files (577 tests, 23 files):**
- `helpers.test.js` — all pure functions in `utils/helpers.js`, incl. `lastDayOfMonth` / `isoDate` / `clampISODate` / `monthKey` day-clamping and padding, `categoryColor` stability, the string-prefix month matching in `getExpensesForMonth` / `getAvailableMonths` (padding, rolled-over dates, missing dates), `filterByCategories` (empty selection is a pass-through, multi-select is a union, Set or array), and `parseAmountInput` (Serbian thousands/decimal separators, and the three-way empty ⇒ `null` / garbage ⇒ `undefined` / `0` ⇒ `0` distinction both callers rely on)
- `storage.test.js` — `loadData`, `saveData`, `importJSON` (now resolves `{ data, skipped }`), `importBudget`, `buildCSVString`, `hasStoredData`, `withDefaults` (expense-date repair, amount coercion on expenses and recurrings, absent-field passthrough, a fund keeping its `kind` and `contributions`), `validateImportData` sanitising
- `dataTransforms.test.js` — `elapsedMonths` / `isSavingsFund` (only `'savings'` counts; absent means spending) / `goalProgress` (`saved` is the confirmed sum and ignores the plan, a filled-in plan with nothing confirmed reads as zero, `expected` reproduces the old elapsed-plan number, a confirmed future month still counts, a confirmed `0` is a confirmation while an unconfirmed month is not, `null` months add to no total, cap at 100%, zero target isn't Infinity, `NO_PROGRESS` carries every returned key), `generateRecurringExpenses` (incl. `skippedMonths`, day clamping, and the `recurringId|YYYY-MM` existence index: per-template isolation, month padding, hand-entered rows, dateless rows), `applyBudgetCopy` (incl. custom income rows: absent list copies to `[]`, names carry over with fresh ids and empty amounts; a savings fund keeps its `kind` but not last year's `contributions`; a spending fund gains no `kind` key), `isEmptyData`, `applyExpenseDeletion` (incl. the delete→regenerate round trip)
- `App.boot.test.jsx` — startup recovery from the backup file (fileStorage mocked): restore when localStorage is empty, skip when it isn't, never write the file on a failed or invalid read, wait for permission
- `GlobalSearch.test.jsx` — rendering, search filtering, navigation callbacks, results are real `<button>`s (tab lands on one, Enter navigates)
- `ExpenseItem.test.jsx` — the row as a `role="button"`: named after the expense, in the tab order, Enter/Space and click all open the edit modal; Enter/Space on the nested ✏️/🗑️ buttons does *not* also open it (the `e.target` guard); delete fires on the *first* click and the first Enter, and the 🗑️ button is named after the expense
- `ExpenseModal.test.jsx` — add/edit/recurring flows, validation; submit disabled until category selected; group card picker (auto-expand, pill select, flat-pill fallback); scrollable `.modal__body` contains the form but not header/footer; discard guard (pristine closes straight away, every exit route asks when dirty, cancel keeps the typed values, save is never blocked); dialog semantics (accessible name, label↔input association, `role="group"` category picker, error tied to its input, focus starts inside, Tab wraps, focus returns to the opener on unmount, collapsed-card pills untabbable); Enter submits from the title and amount fields, inserts a newline in the note, and no non-submit button saves; inline category creation (add + auto-select enables submit, Enter adds the category rather than submitting the expense, duplicate and empty names rejected with the error tied to the input, Escape peels off the adder before the modal, focus returns to the toggle, half-typed name counts as dirty); recurring-template edit mode (own heading, no date input, start date rendered read-only, no make-recurring toggle, `updateRecurring` called without `date`/`startDate`)
- `MonthView.test.jsx` — back navigation via prevView, monthly note textarea, Analiza toggle uses `.btn--toggled` with no inline colors; the Odvajanja section (absent without a savings fund, and between the note and the toolbar with one); category filter (button hidden when the month is empty, pills limited to categories spent this month, counts rendered but kept out of the accessible name, select/deselect, union of two categories, group chip bulk-selects and bulk-clears, half-selected chip fills in the rest and reads unpressed, chip appears pressed when its categories are picked by hand, groups with nothing this month get no chip, absent `categoryGroups` tolerated, summary count/total, month stats stay unfiltered, "Poništi filter" clears, summary survives collapsing the panel, toolbar count badge, filter ∩ search)
- `Charts.test.jsx` — `CHART_THEME` light/dark key parity and color-format sanity (no rendering; recharts needs a layout engine)
- `SavingsGoals.test.jsx` — empty state, add form, progress calculation (confirmed months only: the saved line is the confirmed sum, a fully planned year with nothing confirmed reads as zero, "Očekivano do sada" carries the elapsed plan and disappears once confirmations match it, a past year drops the plan line, `role="progressbar"` reports the confirmed amount, both zero-explain variants, an unlinked goal explains its 0%), single-click delete, every field reachable by label, Enter submits, edit flow (pre-fill, `updateSavingsGoal` not `addSavingsGoal`, unlinking the fund clears the year, cancelling leaves no values behind)
- `Header.test.jsx` — Praćenje absent, Prethodne button render/active states, theme toggle
- `Home.test.jsx` — quick-add circle button, modal open/close, removed Prethodne card, JSON import (confirm dialog appears instead of importing, confirm/cancel paths, malformed file), recurring templates (edit/delete actions named after the template, edit opens the modal on it)
- `ImportConfirmModal.test.jsx` — replace warning, current-vs-incoming counts, loss highlighting, skipped wording, confirm/cancel/Escape
- `App.import.test.jsx` — full import round trip through App: confirm replaces stored data, toast offers undo, undo restores every replaced expense
- `App.undo.test.jsx` — delete-with-undo through the live provider: one click deletes and raises an undo toast, undo restores the record and the button then disappears, a group added while the toast was up survives the undo (the per-field restore), plus goal delete and category delete (which also puts back the expenses that were reassigned to "Ostalo")
- `dataReducer.test.js` — every slice handler, routing, unknown-action throw, no duplicate action types across slices, immutability of inputs; `budget/setFundKind` marks one fund only, removes the key when switched back, and leaves amounts/contributions intact; `budget/setFundContribution` mints the twelve slots on a fund that never had them, un-confirms one month on `null`, and stores a confirmed `0` as `0`; `recurring/update` patches the template and leaves already-generated expenses alone; `data/restore` restores only the named keys, leaves the rest at their current value, and lifts `skippedMonths` when `recurrings` is in the key list
- `App.actions.test.jsx` — scans `App.jsx` for every `type: '…'` it dispatches and asserts each is handled by a slice (component tests mock the context, so a typo would otherwise only surface at runtime), plus real add-expense, add-category and flag-a-fund-then-confirm-a-month flows through the live provider
- `BudgetPanel.test.jsx` — null render, fund rows, amounts, remaining, "nije postavljeno"; savings funds excluded even when they still carry mapped categories (panel nulls out when one is the only fund; a mixed year shows only the spending fund)
- `SavingsPanel.test.jsx` — null render (no budget, and no savings fund among spending ones); one row per savings fund; input prefilled with *this* month's plan; `Potvrdi` confirms the planned amount; a typed amount wins; `1.500,50` parses; Enter submits (it is a real form); a month with no plan renders with `Potvrdi` disabled until typed; `0` is confirmable and garbage is not; a confirmed row shows the amount instead of an input, spells out a shortfall or an overshoot, and reads as confirmed at `0`; a confirmation in another month leaves this one pending; `Izmeni` seeds from the confirmed amount rather than the plan; `Otkaži` drops the draft; `Ukloni` fires on the first click; the month summary totals confirmed against planned
- `PreviousSpendings.test.jsx` — 12-card grid, note snippet, truncation, empty state, month cards are `<button>`s (spelled-out accessible name, Enter navigates, future months disabled)
- `BudgetView.test.jsx` — category chip render/count, inline panel expand/collapse, one-at-a-time, pill add/remove calls; the 💰 chip (one per row, named after its fund, `aria-pressed` tracking `kind`, toggling on with `'savings'` and back off with `null`, no 📂 chip or panel on a savings row while a mixed year keeps it on the spending one); the grid ✓ (only confirmed months, a confirmed `0` counts, never on a spending fund, and the plan cell underneath is still editable); custom income rows (a budget with no `income.extra` still renders, one row per source, add via Enter clears the field, a blank name adds nothing, delete button named after its row, double-click rename, a month cell saves against its row id, the amounts reach the income subtotal)
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
| `dataReducer.js` | routing + `data/replace`, `data/restore` | — |

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
      income: { plata: [12 values], bonus: [12 values], extra: [{ id, name, amounts: [12 values] }] },
      funds: [{ id, name, amounts: [12 values], kind?: 'savings', contributions?: [12 values] }]
    }
  },
  trackingMaps: { [year]: { [fundId]: [categoryName] } },
  recurrings: [{ id, title, amount, category, note, startDate, frequency, skippedMonths?: ['YYYY-MM'] }],
  monthlyNotes: { [year]: { [month]: string } },
  savingsGoals: [{ id, name, target, fundId, year }]
}
```

`null` in a budget amount array means "not set" (renders as `—`); `0` means explicitly zero.
A fund is a **spending fund** unless `kind === 'savings'` — absent means spending, so every fund written before the flag existed keeps behaving exactly as it did. `contributions` is what the user confirmed actually setting aside, month by month, as opposed to what `amounts` planned; it is absent until the first confirmation, `null` in a slot means "never confirmed", and `0` means "confirmed that nothing was set aside". See the savings-funds section below.
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

### Undo for deletes

**Every delete is one click, and the way back is the toast — not a second click.** Two-click confirms used to guard expenses, savings goals and budget fund rows. They taxed every delete, including the overwhelming majority the user meant, and still lost the record once the second click landed. They are gone; `deleteWithUndo` in `App.jsx` replaces them.

```js
deleteWithUndo(keys, run, msg, undoMsg, type = 'danger')
```

It snapshots `dataRef.current`, runs the dispatch, and raises a `'Poništi'` toast that dispatches `data/restore`. It is a `useCallback` on `[showToast]`, so it is stable and the actions memo stays built-once.

**`keys` names the top-level data fields the delete wrote, and undo restores only those.** That is the whole reason `data/restore` exists next to `data/replace`: a wholesale replace would also roll back anything the user changed elsewhere in the ~9s the toast is up. Get the list wrong in either direction and it breaks:

| Action | `keys` | Why |
|---|---|---|
| `deleteExpense` (hand-entered) | `expenses` | touches nothing else |
| `deleteExpense` (generated 🔄) | `expenses`, `recurrings` | the delete appends to the template's `skippedMonths`; restoring the row without lifting that puts it back only for the next generation pass to skip it out again |
| `deleteRecurring` | `recurrings` | |
| `deleteCategory` | `categories`, `categoryGroups`, `expenses` | every expense that used the name was rewritten to "Ostalo" |
| `archiveCategory` | `categories`, `categoryGroups` | expenses keep the name, so they must not be restored |
| `deleteCategoryGroup` | `categoryGroups` | |
| `removeBudgetFund` | `budget`, `trackingMaps` | the fund's twelve amounts plus its mapped categories |
| `removeBudgetIncomeRow` | `budget` | an income row is twelve amounts and nothing else references it |
| `clearFundContribution` | `budget` | a confirmation is one number inside the fund; nothing else references it |
| `deleteSavingsGoal` | `savingsGoals` | |

`importData` is deliberately **not** routed through it: import replaces every field, including ones the incoming file never mentions, so its undo has to stay a wholesale `data/replace`.

Two things constrain the window in practice. The toast lives 9s, and `showToast` replaces whatever toast is up — so any *other* action that raises a toast also takes the undo away. That is why the undo-survives-an-edit test in `App.undo.test.jsx` uses `addCategoryGroup`, one of the few actions that stays silent.

The one confirm that stayed is **CategoryManager's 🗑️**, which expands into Arhiviraj / Obriši. That is not a repeated question, it is a choice between two different operations — and both outcomes are undoable from the toast.

Because the toast is now the only feedback a delete gives *and* the only route back from one, it carries `role="status"` so a screen reader announces it. The 🗑️/× buttons carry an `aria-label` naming their record ("Obriši trošak: Kafa") — an emoji alone was the whole accessible name before, which is thin for a control that now deletes on the first press. `.bg__del-btn` in `budget-view.css` is `opacity: 0` until row hover, so it also needed a `:focus-visible` rule (same trap as `.expense-item__actions`).

### Savings funds and confirmed contributions

A fund's twelve `amounts` are a **plan**, and two different things used to share that one shape. A **spending fund** is mapped to expense categories through `trackingMaps` and measured against real expenses by `BudgetPanel` — that works, because spending is recorded to the day. A **savings fund** (200 €/month into an envelope or a side account) is money that is deliberately *not* spent, so it never becomes an expense and nothing recorded that it had happened. `goalProgress` simply counted every elapsed month as saved, which reported intent as fact.

**The flag is explicit, never inferred.** `kind: 'savings'` is set from a 💰 chip on the fund row in `BudgetView`. Inferring it from "no mapped categories" was rejected: a spending fund the user simply hasn't mapped yet would start demanding confirmations. Toggling **off deletes the key** rather than writing `null`, so a spending fund stays byte-identical to one that was never touched and "absent means spending" holds literally, including in export files.

Flipping the flag is **lossless in both directions** — `budget/setFundKind` touches nothing else, so the amounts, any confirmations and the `trackingMaps` entry all survive and come back if it is flipped again. A savings fund's mapping is inert rather than deleted; `BudgetPanel` excludes savings funds outright, so a stale mapping can't measure a savings fund against spending it has nothing to do with.

**Confirmation records an amount, not a checkbox.** Planned 20.000, actually set aside 15.000 → the record says 15.000. `budget/setFundContribution` mints the twelve-slot array on first use and takes `value: null` as the un-confirm, mirroring how clearing a budget cell writes `null` to `amounts`. A confirmed `0` is a real answer — the one thing the plan cannot express — so it must stay distinct from an unconfirmed month; that is what `confirmedMonths` in `goalProgress` exists for, since `saved === 0` alone can't tell them apart.

**Confirming happens in the month, not in the grid.** `SavingsPanel` sits in `MonthView`; the year grid only *shows* a ✓ on confirmed cells, as an adornment beside a still-editable plan cell. Un-confirming is the one operation routed through `deleteWithUndo`, because it throws away a hand-typed number that re-confirming would not bring back (re-confirming offers the *planned* figure).

**`goalProgress` measures what was confirmed.** `saved` is the sum of non-null `contributions` — all of them, not just the elapsed ones, since a confirmation exists because the user asserted the money is set aside. The plan is relabelled rather than dropped: `expected` is the elapsed part of the plan (the number `saved` used to be) and `planned` the whole year. A goal whose fund has nothing confirmed reads 0% and says which switch to flip — deliberately, since the old number was the assumption the feature exists to stop making.

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

**Row-shaped things are controls, not decorated `<div>`s.** Expense rows, month cards and search results are all clickable, so all three carry a role, a tab stop and Enter/Space. Which mechanism depends on what the row wraps:

- A row with **no nested controls** is a real `<button type="button">` — `.month-card` in `PreviousSpendings.jsx`, the result rows in `GlobalSearch.jsx`. The UA button chrome (centered text, system font, `buttonface`, shrink-to-fit width) has to be undone in CSS: `width: 100%; font: inherit; color: inherit; text-align: left` on `.month-card`, and a `button.expense-item` rule in `expenses.css` for the search rows. Note `button.expense-item` is specificity (0,1,1), which loses to `.expense-item:first-child` (0,2,0) and `:hover` — that's deliberate, so the first row keeps its missing top border and hover still paints.
- A row that **wraps other buttons** can't be one (a `<button>` may not nest interactive content), so `ExpenseItem` uses `role="button" tabIndex={0}` plus a keydown handler. That handler **must bail on `e.target !== e.currentTarget`**: the nested ✏️/🗑️ fire their own Enter/Space, which bubbles, so without the guard pressing Enter on 🗑️ arms the delete *and* opens the edit modal over it. Space is `preventDefault`ed so it doesn't scroll the page.
- **A hover-revealed control needs a `:focus-within` twin.** `.expense-item__actions` sits at `opacity: 0` until hover; a keyboard user never hovers, so the ✏️/🗑️ buttons were focusable but invisible until `.expense-item:focus-within` was added alongside the `:hover` rule.
- **Give these rows an explicit `aria-label`.** Computed from contents, a month card reads "Januar 3 transakcija 12.400 RSD" — loose fragments — and an expense row would splice in its own nested button names. Focus rings are `outline: 2px solid var(--primary)`, inset (`outline-offset: -2px`) on expense rows because `.expense-list` clips its children.

- **`Header.jsx`** — nav is split into two groups by thin `.header__sep` dividers: primary (Početna, Prethodne, 🔍) and tools (Budžet, Kategorije), followed by autosave status and theme toggle. "Prethodne" is active for both `view === 'previous'` and `view === 'month'`. There is no separate Praćenje nav item — tracking is inline in BudgetView.
- **`Home.jsx`** — hero row has the greeting text centered and a circular `+` button (`home__add-btn`) positioned `absolute; right: 0` so it doesn't shift the centered text. Clicking opens `ExpenseModal` with today's date via local `adding` state — the modal is managed in Home, not App. The "Pogledaj prethodne potrošnje" action card was removed (superseded by the Prethodne nav button). Renders `SavingsGoals` at the bottom. Each row in the "Ponavljajući troškovi" list carries ✏️ and 🗑️ (both `aria-label`led with the template's title, since an icon alone says nothing); ✏️ opens `ExpenseModal` on that template via local `editingRecurring` state.
- **`BudgetPanel.jsx`** — renders inside `MonthView` above the expense list; shows live fund vs. actual spend as compact single-column rows (`bp-row`): dot indicator | fund name | progress bar | spent/allocated | remaining. Returns null if no funds have tracking categories mapped. **Savings funds are filtered out** (`!isSavingsFund(f)`) — their money is set aside rather than spent, and the toggle deliberately leaves any old mapping in place, so without the filter a savings fund would be measured against spending unrelated to it.
- **`SavingsPanel.jsx`** — the other half of the month's plan-vs-reality picture, rendered directly below `BudgetPanel`; `.sp-*` mirrors `.bp-*`. One row per savings fund, showing the month's plan and either a confirm form or the confirmed amount. Returns null when the year has no savings fund, which is what keeps the section invisible for anyone who hasn't opted in — and why no existing `MonthView` test fixture needed touching. Each row is a real `<form onSubmit>` so Enter confirms; the amount input is prefilled with the plan and parsed by `parseAmountInput`, so `1.500,50` means the same thing here as in the budget grid. `0` is confirmable (submit is blocked only on empty or unusable input). **Row keys carry `year`/`month`** — `MonthView` is not unmounted when the user changes months, so a row keyed only by `fund.id` would drag a half-typed draft into the next month, the same trap `filterCats` needs its `useEffect` reset for. Every control is `aria-label`led with its fund ("Potvrdi odvajanje: Putovanje"), and the input's `<label>` is visually hidden rather than absent, since one visible "Iznos" per row would name nothing.
- **`BudgetView.jsx`** — year is local state (‹/› nav buttons); `currentMonth` highlight only applies for the actual current year. Deleting a fund row (`×`) is one click plus the undo toast. "📋 Kopiraj u {year+1}" copies fund structure + plata income + tracking category links to the next year — it **keeps** its double-click confirmation when the target year already has data, because it is an overwrite rather than a delete and has no undo behind it. `copyBudgetToYear` in App.jsx assigns new fund IDs and remaps `trackingMaps`. Each fund row has a **💰 chip** (`aria-pressed`, marks the fund as a savings fund) and a **📂 chip** (shows mapped-category count) that expands an inline tracking panel directly below the row; only one panel can be open at a time; panel hides during drag. **A savings fund gets no 📂 chip and no panel** — mapping spend categories to it would be a lie — and the toggle handler also clears `expandedFundId`, since flipping 💰 with the panel open would otherwise strand it on a fund whose chip is gone, leaving no way to close it. A confirmed month on a savings row renders a `.bg__confirm-mark` ✓ **beside** the cell, never in place of it: the plan stays click-to-edit, and the mark carries `role="img"` + an `aria-label` naming the amount (a bare `<span aria-label>` is ignored by most ATs, and a CSS `::after` would be invisible to both screen readers and jsdom). It is absolutely positioned because `.bgc` is a full-width block in a right-aligned cell, with `pointer-events: none` so it can't eat the click that opens the editor. The chip and panel are rendered inside `SortableFundRow` as a React Fragment — the `setNodeRef` (DnD target) attaches to the first `<tr>`, the panel is a second sibling `<tr>`. Flex containers inside `<td>` require explicit `width: 100%` and `flex: 1; min-width: 0` on inner flex children to wrap correctly in table layout.
- **`CategoryManager.jsx`** — two-tab interface: **Kategorije** (flat list with archive/delete/rename/add, same as before) and **Grupe** (group management). In the Kategorije tab, the 🗑️ button expands into two choices: **Arhiviraj** (removes name from `data.categories` only, expenses unchanged) and **Obriši** (removes and reassigns all matching expenses to "Ostalo"), wired to `archiveCategory` and `deleteCategory`. This is the one place a second click survived the move to undo-on-toast — it asks *which* operation, not *are you sure* (see the undo section). Both outcomes are undoable. In the Grupe tab, each group row has a header (click to expand) that reveals checkboxes for all categories — checked = in this group. Checking a category auto-removes it from any other group it was in. `data-testid="group-{id}"` is on each group row for test scoping with `within()`. Group actions: `addCategoryGroup`, `renameCategoryGroup`, `deleteCategoryGroup`, `updateCategoryGroupMembers`. All category mutation actions (`deleteCategory`, `archiveCategory`, `updateCategory`) sync `categoryGroups` automatically.
- **`ExpenseModal.jsx`** — one modal with three jobs, selected by which prop it gets: no prop = add an expense, `expense` = edit one, `recurring` = edit a recurring template (`source = expense ?? recurring` is what most of the conditionals read). In recurring-edit mode the heading changes, the make-recurring toggle is gone, submit calls `updateRecurring`, and **the start date is rendered as read-only text (`.form-static`), not an input** — moving it would back-fill months before the new date or orphan the ones after it, so changing a start date is still delete-and-recreate. The payload drops `date` on that path.
  A **`+ Nova kategorija`** button sits under the category picker in every mode. It swaps itself for a labelled input; `Dodaj`/Enter calls `addCategory` and selects the new name in the same click, so the user never leaves the form. Enter there is `preventDefault`ed — the input lives inside the expense `<form>`, so it would otherwise submit the expense. Empty and already-existing names are rejected inline (error tied to the input via `aria-describedby`); nothing is auto-selected on a duplicate. **Its open/closed state lives in `ExpenseModal`, not in the picker**, because the Escape handler has to peel off one layer at a time — confirm, then the adder, then the modal — and closing it returns focus to the button that opened it. A half-typed category name counts toward `dirty`, so it triggers the discard guard. The category itself is saved globally the moment it's added; discarding the expense afterwards does not remove it (same as CategoryManager).
  **the fields are a real `<form onSubmit>`**, so Enter in any text/number field saves (the note textarea still takes a newline). It carries `noValidate` because the inputs have native constraints (`type="date"`, `min="0"`) whose browser bubbles would preempt the messages rendered under each field. Every button that isn't the save button needs an explicit `type="button"` — inside a form the default is `submit`, so ✕/Otkaži/pills/🔁 would otherwise save the expense. The `<form>` sits between `.modal` and `.modal__body` and must therefore re-declare the column layout (`.modal__form` in `modal.css`) or the body stops scrolling. Note Enter does nothing until a category is picked, since implicit submission is inert while the default button is disabled. The form starts with `category: ''`; the submit button is `disabled={!form.category}` so the user must pick a category before saving.
  Accessibility: the dialog is `role="dialog" aria-modal="true"` labelled by its heading, with `useFocusTrap` keeping Tab inside it and returning focus to the opener (usually Home's `+`) on unmount; every input is tied to its visible label via `useId` (`htmlFor`/`id`) and to its error via `aria-describedby`; the category picker is a `role="group"` labelled "Kategorija" (its label is a `<span>`, not a `<label>` — it labels no single control); pills and the 🔁 toggle expose `aria-pressed`, group headers `aria-expanded`, and pills inside a collapsed card get `tabIndex={-1}` since the card is clipped to zero height but stays in the DOM. Category picker renders as expandable group cards (`CategoryGroupPicker` inline component) when `data.categoryGroups` is non-empty: cards expand/collapse independently, the group containing the current category is auto-expanded on open, selecting a pill keeps the card open. Falls back to flat pills when no groups are configured. The recurring 🔁 toggle button uses `aria-label="Ponavljajući trošak"` (queryable in tests). **Closing is guarded when the form is dirty.** All four exit routes (overlay click, ✕, Otkaži, Escape) call `requestClose`, which compares `form` against a `pristine` ref — plus the recurring toggle — and raises the `DiscardConfirm` alertdialog instead of closing when anything differs; only `onDiscard` calls `onClose`. The confirm is a second `.modal-overlay--stacked` layer rendered *beside* `.modal`, not inside it, so the form stays mounted behind it and cancelling restores focus to the field the user left (`returnFocus` ref). While it is open Escape dismisses the confirm rather than the modal. The ✕ button carries `aria-label="Zatvori"` — query it by that name, not by `'✕'`. The dialog is a flex column capped at `calc(100dvh - 32px)`: header and footer are fixed (`flex-shrink: 0`), all form fields sit in a scrolling `.modal__body` (`flex: 1; min-height: 0; overflow-y: auto`) that uses negative side margins matching the modal padding so the scrollbar sits at the modal edge — if the modal padding changes, update those margins in both media queries too.
- **`Charts.jsx`** — rendered above the expense list when toggled; pie chart for category breakdown, bar chart for month comparison. Pie slices are *ordered* by value but *colored* by category via `categoryColor`, so they match the dots and badges in the list below. Recharts paints into SVG attributes, which cannot read CSS variables — the grid, axis ticks, bars and hover cursor therefore come from the exported `CHART_THEME` table, picked with `darkMode` from context. `CHART_THEME.light` mirrors `:root` and `.dark` mirrors `html.dark`; update both together when those blocks change. The default recharts tooltip is themed from CSS instead (`html.dark .recharts-default-tooltip`).
- **`GlobalSearch.jsx`** — searches across all expenses (title, category, note), sorted by date desc; activating a result navigates to that month's MonthView. Rows reuse `.expense-item` but render as `<button>` (see the row-controls note above).
- **`SavingsGoals.jsx`** — savings goal list with progress bars. **Progress is what the user confirmed setting aside, not what the year plans to set aside** — `goalProgress` (`dataTransforms.js`) sums the linked fund's `contributions`. The plan is relabelled rather than hidden: **"Očekivano do sada"** is the elapsed part of the plan (the number the bar itself used to show, conditional on `expected !== saved`), **"Po planu do kraja 2026"** is the whole year (conditional on `planned > expected`, so a fully-elapsed past year doesn't print the same number twice), and the `.goal-bar__plan` ghost segment sits behind the fill. A goal with no fund says so; a goal whose fund has **no confirmations** gets one of two explain lines depending on whether that fund is flagged 💰 — a 0% bar on a funded goal looks like a bug unless it names the next step, and the next step differs. `NO_PROGRESS` is imported from `dataTransforms.js` rather than hand-mirrored here, because a key missing from the local copy rendered as `NaN` instead of failing loudly. The bar carries `role="progressbar"` with `aria-valuenow`/`aria-valuetext` — it was a bare `<div>`, so the percentage existed only as color. Goal year select defaults to the most recent budget year that exists. Delete is one click plus the undo toast. **Add and edit share one `<form onSubmit>`** — `editingId` is the only difference between them (null = adding), which is why `closeForm` resets it along with the fields: leftovers from an edit would otherwise seed the next add. Every field has a real `<label htmlFor>` (`useId`) rather than a placeholder standing in for one, and Enter submits because it is a form and not a pile of `onKeyDown` handlers. Clearing the fund also clears the year — an unlinked goal must not keep a dangling `year`.
- **`MonthView.jsx`** — includes a monthly-note textarea between the stats row and BudgetPanel; saves on blur only when text has changed. `SavingsPanel` sits directly after `BudgetPanel` and before the toolbar — the two are the same kind of panel (this month's plan against what actually happened) and belong together.
  **Category / group filter.** A `🏷️ Filter` toolbar toggle (with the selected count in its label) opens the inline `CategoryFilter` panel: a row of group chips over a row of category pills, multi-select, ANDed with the free-text search. Selection lives in `filterCats` (an array of category names) and is applied by `filterByCategories` in `helpers.js` — an **empty selection means "no filter", not "match nothing"**, or opening the panel would blank the month.
  Three rules keep the panel honest, all covered by tests:
  - **Only categories actually spent this month get a pill**, and groups are narrowed to those categories before rendering — a chip's bulk toggle must never touch a category the user can't see under it, and a group with nothing spent in it doesn't take a row. Pills are ordered by position in `data.categories` so their reading order and colors match the modal picker; archived/imported names (`indexOf` → -1) sort to the end alphabetically rather than to the front.
  - **A group chip is `aria-pressed` only when every one of its categories is selected**, so it doubles as an indicator when they're picked by hand. Clicking a fully-selected chip clears its categories; clicking a partly-selected one fills in the rest rather than wiping the selection.
  - **The results summary lives outside the collapsible panel.** A filter left on is invisible once the panel is shut, and its "Poništi filter" button is the only way back off it. The summary (`Prikazano: n od m · total`) is also where "koliko sam potrošio na Režije" gets answered — **the stats row and Charts stay the month's full picture**, deliberately, so the four stat cards mean the same thing whatever is selected.
  `filterCats` is reset by a `useEffect` on `[year, month]`; without it a selection carried over from the previous month silently hides rows. Counts on the pills/chips are `aria-hidden` with an explicit `aria-label={category}` on the button, so a pill's accessible name is just "Hrana" and not "Hrana 2".
- **`PreviousSpendings.jsx`** — shows a note snippet (≤55 chars) at the bottom of each month card when a `monthlyNotes` entry exists. Each card is a `<button>`; future months are `disabled` rather than a separate non-clickable branch, which also keeps them out of the tab order, so `.month-card:hover` is qualified with `:not(:disabled)`. Important: when adding fields to the `monthsData` useMemo result objects, always destructure them in the `.map()` callback or they will be silently undefined in JSX.

### Recurring expenses

`ExpenseModal` (add mode only) has a 🔁 toggle button (`aria-label="Ponavljajući trošak"`) with a muted label below it. When active, submit calls `addRecurring` instead of `addExpense` — the template is stored in `data.recurrings`. A `useEffect` in `App.jsx` (dependency: `data.recurrings`) auto-generates expense entries via `setData` functional update for every month from `startDate` up to the current month, skipping any month where a matching `recurringId` entry already exists. Recurring expenses show a 🔄 badge in `ExpenseItem`.

**Editing a template only changes what it mints from here on.** `recurring/update` patches `data.recurrings` and nothing else — months already generated keep the amount, title and category they were minted with, because those rows record money that was actually spent. So a price change takes effect on the next generation pass, which the toast says out loud ("važi od sledećeg meseca"). `startDate` is deliberately not editable; see the `ExpenseModal` note above.

**Dates are clamped, never rolled over.** A template starting on the 29th–31st must not emit `'2026-02-31'` — JS parses that as March 3, so the expense lands in the wrong month and the intended month looks empty. `generateRecurringExpenses` builds dates with `isoDate(year, month, day)` from `helpers.js`, which clamps the day to `lastDayOfMonth`. Records written before this fix are repaired on load by `repairExpenses` inside `withDefaults` (`storage.js`), using `clampISODate`; it returns the original object when nothing needed fixing, so it is a no-op for healthy data. Use `isoDate` for any new date construction rather than string concatenation, and `monthKey(year, month)` for the `'YYYY-MM'` form (`isoDate` and `generateRecurringExpenses`' `skippedMonths` both build on it).

**Month filtering is a string prefix, not a `Date` comparison.** `getExpensesForMonth` and `getAvailableMonths` read the year and month straight off the `'YYYY-MM-DD'` string. This is a hot path — Home calls the former twice per render, PreviousSpendings 24 times in its memo — and constructing a `Date` per expense per call measured ~28× slower at 5,000 expenses. It is also the more correct comparison: a stale `'2026-02-31'` parses to March 3, so the `Date` version filed it under March, while the prefix match keeps it in the month it names. Don't reintroduce `new Date(e.date + 'T00:00:00')` in a filter.

**"Does this month already exist?" is an index lookup, not a scan.** `generateRecurringExpenses` builds one `Set` of `'recurringId|YYYY-MM'` keys from the expense list up front, then tests each candidate month against it. It used to run a `.some()` over every expense from inside the template × year × month loops, so the work grew as the product of all three — ~28ms per call at 5,000 expenses and 12 templates, versus ~1ms now, and flat as the list grows. Only rows carrying a `recurringId` enter the index, so a hand-entered expense in the same month does not suppress generation.

**Deletion must be remembered.** That effect re-runs on every startup — `loadData()` returns a fresh `recurrings` array, so its identity always changes — which means a generated expense the user deleted would be recreated on the next reload. `deleteExpense` therefore routes through `applyExpenseDeletion` (`dataTransforms.js`), which appends the expense's `'YYYY-MM'` to the parent template's `skippedMonths`; `generateRecurringExpenses` skips those months. Deleting a generated expense shows a distinct toast ("neće biti ponovo kreiran") because the exclusion is permanent — there is currently no UI to un-skip a month, only re-adding the expense manually.

Known edge: editing a generated expense's date into a different month leaves the original month empty, so it gets regenerated on the next pass. Moving generated expenses across months is not really supported. This and the missing "un-skip a month" affordance are both written up in `BACKLOG.md`.

### Hooks

`src/hooks/useFocusTrap.js` — dialog focus behaviour for any element ref: Tab/Shift+Tab wrap inside it, focus moves in on open (skipped when something inside already claimed it, e.g. `autoFocus`), and focus returns to the opener on unmount. The two options exist for stacked dialogs: `active: false` suspends only the trap so a child dialog can take over without the parent yanking focus back, and `restoreFocus: false` opts a child out of the restore when its parent already handles it. The restore target is captured during *render*, not in the effect — by effect time `autoFocus` has already moved `document.activeElement` into the dialog.

### Pure utilities extracted for testability

`src/utils/dataTransforms.js` contains `generateRecurringExpenses`, `applyBudgetCopy`, `applyExpenseDeletion`, `isEmptyData`, `isSavingsFund`, `NO_PROGRESS`, and `elapsedMonths` / `goalProgress`, extracted from App.jsx closures (and, for the last two, from `SavingsGoals`) so they can be unit-tested without rendering. App.jsx imports and calls them; behavior is identical.

`parseAmountInput` in `helpers.js` is the one parser for a hand-typed amount in Serbian formatting (`.` thousands, `,` decimal). It was private to `BudgetView`'s cell until `SavingsPanel` needed the same rules, and two copies would drift into the same keystrokes meaning different numbers in different places. It returns **three distinguishable outcomes** and callers depend on all three: `null` for a deliberately emptied field (clear the value), `undefined` for unusable input (abandon the edit rather than save), and a number otherwise — including `0`.

**`applyBudgetCopy` builds each new fund from a hard-coded field list, not a spread.** That is deliberate: structure crosses into the next year (`name`, `kind`), recorded values do not (`amounts` are blanked, `contributions` dropped). It also means a new fund field is silently dropped unless it is added there — check that line when adding one.

### Styling

Styles live in **`src/styles/`, one file per component or shared concern**, stitched together by `src/index.css`. `index.css` holds no rules — only a table of contents and an ordered list of `@import`s — and stays the single entry point (`main.jsx` imports it). BEM-ish class names per component (`.budget__*`, `.bg__*`, `.cat-*`, `.bp-*`, `.sp-*`, `.gsearch__*`, `.goal-*`, etc.). Always use `var(--text)`, `var(--bg-card)`, etc. on new inputs/elements so they respect the theme automatically.

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
