# Codex Review — Planning Persistence E2E

Date: 2026-06-15
Slice: B from `docs/GROK_COMPOSER_2_5_HARDENING_BATCH_2026-06-15.md`

## What Shipped

New Playwright spec `e2e/planning-persistence.spec.ts` proving budgets and expected income
survive `.billu.json` round-trip.

### Scenario

1. Import agency sample and apply mapping
2. Add one budget (`Payroll`, March 2026) and one expected income event
3. Save project file
4. Reload page and **clear IndexedDB** (isolates file round-trip from durable store)
5. Re-import sample — planning lists empty
6. Open saved project file — planning rows restored

### Why IndexedDB is cleared

Reload persistence alone would not distinguish project-file restore from IndexedDB
write-through. Clearing browser databases before re-import makes the open-project step the
only restore path for planning data.

## Files Changed

| File | Change |
|------|--------|
| `e2e/planning-persistence.spec.ts` | **NEW** — project file planning round-trip |

## Suggested Commit

`test(e2e): planning persistence via project file`