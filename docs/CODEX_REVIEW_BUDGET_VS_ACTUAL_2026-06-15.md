# Codex Review — Budget Vs Actual V1

Date: 2026-06-15
Slice: A from `docs/GROK_COMPOSER_2_5_P3_BATCH_2026-06-15.md`

## Model Shape

`BudgetEntry` (workspace-local manual plan row):

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Stable row id |
| `month` | string | `YYYY-MM` |
| `scope` | `head` \| `subcategory` | Match key against actuals |
| `key` | string | Head name or `head / subcategory` |
| `flow` | `revenue` \| `outflow` | Compared against matching flow only |
| `amount` | number | Non-negative budget |
| `note` | string? | Optional operator note |

`compareBudgetToActual()` returns `BudgetVarianceRow` with `budgeted`, `actual`, `variance`, `variancePercent`, and `status`:

- `under` — actual below budget (outflow) or above budget (revenue)
- `on-track` — within 5% tolerance
- `over` — opposite of under
- `no-budget` — actual in a budgeted month with no matching plan row

## Persistence Strategy

- `WORKSPACE_SNAPSHOT_VERSION` bumped to **4**
- Arrays on `WorkspaceSnapshot`: `budgets`, `expectedIncomeEvents` (income slice uses the second field)
- Stored in IndexedDB workspace and `.billu.json` project files
- v3 files migrate on load with `budgets: []` and `expectedIncomeEvents: []`; parsed version becomes 4

## UI Surface

- **Local Settings** — compact add/remove form (`#budget-add`, `[data-budget-delete]`)
- **Dashboard** — `renderBudgetVsActualPanel` after the summary grid
- **Actions** — `bindBudgetActions` in `main.ts` re-renders on change (same pattern as saved rules)

## Manifest / Export

- `context.planning.budgetCount` and `budgetVariance` status counts
- New manifest table spec `budgetVsActual` (metadata only, no row dump)
- Caveat line when budgets exist

## Test Coverage

| Area | File |
|------|------|
| Pure comparison logic | `src/finance/budget.test.ts` |
| Workspace round-trip | `src/workspace/workspace-store.test.ts` |
| v3 → v4 migration | `src/workspace/project-file.test.ts` |
| Manifest planning metadata | `src/export/dashboard-manifest.test.ts` |

## Intentionally Not Handled

- Recurring budgets, month ranges, or multi-month plans
- Bank / accounting-package integrations
- Accountant workbook sheet (deferred — not straightforward without new sheet plumbing)
- Server-side or multi-user storage
- Auto-suggested budgets from history

## Files Changed

| File | Change |
|------|--------|
| `src/finance/budget.ts` | Model + comparison |
| `src/finance/budget.test.ts` | Unit tests |
| `src/workspace/workspace-store.ts` | v4 snapshot + getters/setters |
| `src/workspace/project-file.ts` | Validation + migration |
| `src/workspace/indexeddb-workspace-store.ts` | Empty snapshot defaults |
| `src/ui/budget-actions.ts` | Add/delete handlers |
| `src/ui/dashboard-sections.ts` | Settings form + variance table |
| `src/ui/dashboard-results.ts` | Panel render |
| `src/main.ts` | Wiring + persistence callbacks |
| `src/export/dashboard-manifest.ts` | Planning metadata + table spec |

## Suggested Commit

`feat(budget): budget vs actual V1 with workspace persistence`

## Codex Review Notes

- Tightened `no-budget` row generation so it only emits rows for scopes the operator has
  actually budgeted. A head-level budget no longer creates duplicate subcategory-level
  no-budget rows.
- Tightened project-file validation so imported budget entries must satisfy the same
  semantic validator as UI-created entries.
