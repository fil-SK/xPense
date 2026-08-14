# Backlog

Known gaps that were consciously deferred, with enough context to pick them up cold.
Newest first. Remove an entry when it ships.

## Live pregled: there is no forecast, only plan and actual

**Deferred:** 2026-08-14, while building the live overview.

There are really three numbers per row, and the app now has two of them:

| | Food 2026 |
|---|---|
| Budget — what I planned in January | 6.000 |
| Actual — what has happened Jan–Aug | 4.700 |
| **Forecast — where I now think I'll land** | **6.900** |

They answer different questions, and the missing third one is what the tester was
reaching for when they edited *future* budget months after a pay raise. They weren't
trying to rewrite history — they were trying to say "from here on, income is 2.300".
The app had nowhere to put that, so it went into the plan and destroyed the baseline.
The overview fixes the past half of this; the future half is still unaddressed.

**Proposed fix:** a third line per cell (or a `Projekcija` column) computed as actual
through the elapsed months plus a projection for the rest — plan-based by default, with
a run-rate alternative for rows where the plan has already proven wrong. It needs no new
stored data if the projection stays derived; it needs a `forecast` override field if the
user should be able to say "from June, income is 2.300" without touching the budget.
Decide that first — it is the difference between a display change and a fourth data layer.

**Effort:** medium. Left out deliberately: actuals were the piece that was actually
missing, and shipping a third number per cell at the same time would have doubled the
grid's design surface before anyone had used the second one.

**Note:** the "under plan isn't automatically good" rule applies here too, and harder —
a forecast that lands under a spending plan is good news, while one that lands under a
savings plan is a warning. Reuse `varianceStatus`, don't hand-roll a comparison.

---

## Savings: nothing stops you confirming a month that hasn't happened

**Deferred:** 2026-08-14, while adding savings funds and confirmed contributions.

`SavingsPanel` renders the same controls for every month, including future ones.
`PreviousSpendings` disables future month cards, but `MonthView` for a future month is
still reachable through search and through `selectedMonth`, and the panel will happily
accept a confirmation there. `goalProgress` counts it toward `saved` on purpose — a
confirmation ahead of the calendar is a real thing when someone funds a whole quarter
at once — so this is only a problem for the accidental case.

**Proposed fix:** compare `year`/`month` against the clock in `SavingsPanel` and render
the confirmed/pending state read-only for a month that hasn't started, leaving the row
visible so the plan is still legible. One guard around the form branch, two tests.

**Effort:** small. Left out to keep the panel's behaviour uniform across months.

---

## Savings: re-importing a budget discards that year's confirmations

**Deferred:** 2026-08-14, same session.

`budget/import` replaces `budget[year]` wholesale, and confirmations live on the fund
objects inside it. That is exactly what makes them self-consistent — fund ids and their
confirmations always travel together, so a re-import can never orphan one or attach it to
the wrong fund, which is the bug a parallel top-level map would have had. The cost is
that "re-import last year's budget" silently drops that year's confirmation record.

**Proposed fix:** have `ImportConfirmModal` count confirmations in the incoming file
against the current data for the affected years and warn when the number shrinks, the
same way it already flags shrinking expense counts. No data-shape change.

**Effort:** small. A count and a line of copy in a modal that already does this for
other fields.

---

## Recurring expenses: the start date still can't be edited

**Deferred:** 2026-08-09, while adding edit for recurring templates.

`ExpenseModal` in recurring-edit mode shows `startDate` as read-only text. Everything
else about a template is now editable, so a typo'd start date is the one field left
needing delete-and-recreate.

The reason it was left out: `generateRecurringExpenses` counts months from `startDate`,
so moving it *earlier* back-fills every month in between on the next pass, and moving it
*later* orphans the rows already generated before it — they stay in the list with a
`recurringId` pointing at a template that no longer claims that month. Neither is wrong
exactly, but both are surprising, and there is no UI that explains what just happened.

**Proposed fix:** make the field editable and resolve the consequences explicitly at save
time — show a confirm naming the counts ("3 meseca će biti dodata" / "2 postojeća unosa
ostaju"), then either let the generator back-fill or delete the orphans. The counts are
cheap to compute: both are a filter over `expenses` by `recurringId` and month prefix.

**Effort:** medium. Mostly UI copy and a confirm dialog; the data work is a filter each way.

---

## Recurring expenses: no way to un-skip a month

**Deferred:** 2026-08-09, while fixing "deleted recurring expenses come back after reload".

Deleting an auto-generated expense appends its `'YYYY-MM'` to the parent template's
`skippedMonths` (`applyExpenseDeletion` in `src/utils/dataTransforms.js`), and
`generateRecurringExpenses` skips those months forever after. That is correct for a
deliberate delete, but a misclick is permanent — the only way back is re-adding the
expense by hand, and nothing in the UI shows that a month is being skipped at all.

**Proposed fix:** on the recurring item in `Home.jsx`, show the skipped count when
non-zero ("3 meseca preskočena") with a "poništi" action that clears `skippedMonths`.
The next generation pass then refills those months on its own — no other change needed.
An App-level `clearSkippedMonths(recurringId)` action is all the plumbing this requires.

**Effort:** small. One action in `App.jsx`, a few lines in `Home.jsx`, one test.

---

## Recurring expenses: moving a generated expense across months duplicates it

**Deferred:** 2026-08-09, same session. Documented as a known edge in `CLAUDE.md`.

`generateRecurringExpenses` decides a month is "done" by looking for an existing expense
whose `recurringId` matches and whose `date` starts with that month. Edit a generated
expense's date from March to April and March looks empty again, so the next pass — which
runs on every startup — recreates it. April now holds two entries and it reads as a
duplicate bug to the user.

**Proposed fix:** pin generated expenses to the month they were created for, e.g. an
`originMonth: 'YYYY-MM'` field set at generation time and used for the existence check
instead of the date prefix. The date then becomes freely editable without confusing the
generator. Needs a backfill for existing generated expenses (derive `originMonth` from
the current `date`), which is a good fit for `withDefaults` in `src/utils/storage.js`.

**Effort:** medium. Touches the data shape, so it needs the backfill and a migration test.

**Note:** low real-world frequency — it only triggers if you edit the *date* of a 🔄
expense. Not worth doing before the un-skip work above.
