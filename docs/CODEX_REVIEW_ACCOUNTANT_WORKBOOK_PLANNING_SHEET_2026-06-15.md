# Codex Review — Accountant Workbook Planning Sheet

Date: 2026-06-15
Slice: A from `docs/GROK_COMPOSER_2_5_HARDENING_BATCH_2026-06-15.md`

## What Shipped

Seventh workbook sheet **`Planning`** with workspace planning context.

### Budget vs Actual section

Exported when workspace has budget rows:

| Column | Source |
|--------|--------|
| Month, Scope, Key, Flow | `BudgetEntry` |
| Budgeted, Actual, Variance, Variance Percent, Status, Note | `compareBudgetToActual()` |

### Expected income section

Exported when workspace has structured events:

| Column | Notes |
|--------|-------|
| Due Date, Amount, Label, Status | `ExpectedIncomeEvent` |
| Included In Forecast | `yes` unless status is `received` |

Empty workspace shows a single placeholder row on the Planning sheet.

## Wiring

- `AccountantWorkbookInput` extended with `budgets` and `expectedIncomeEvents`
- Export binding passes workspace getters (same as manifest)
- Summary runway confidence now includes tentative expected-income input

## Files Changed

| File | Change |
|------|--------|
| `src/export/accountant-workbook.ts` | Planning sheet builder |
| `src/export/accountant-workbook.test.ts` | 7-sheet assertion + planning content test |
| `src/ui/dashboard-export-actions.ts` | Thread budgets/events into workbook export |

## Limitations

- Planning compares budgets against **KPI-visible** records (same as dashboard panel)
- No recurring budget expansion or invoice metadata
- Sheet title uses workbook convention `Budget Vs Actual` (capital Vs)

## Suggested Commit

`feat(export): accountant workbook planning sheet`