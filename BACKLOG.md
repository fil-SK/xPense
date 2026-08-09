# Backlog

Known gaps that were consciously deferred, with enough context to pick them up cold.
Newest first. Remove an entry when it ships.

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
