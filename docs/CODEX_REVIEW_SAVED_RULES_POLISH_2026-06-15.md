# Codex Review — Saved Rules UX Polish

Date: 2026-06-15
Slice: D from `docs/GROK_COMPOSER_2_5_BACKLOG_BATCH_2026-06-15.md`

## What Changed

Copy-only polish for saved-rule learning in category review.

| Before | After |
|--------|-------|
| `Remember rule` | `Remember for future imports` |

No new drawer, no behavior change. `data-role="save-rule"` unchanged — e2e tests still click by role.

## Decision

- **Copy:** Adopted `Remember for future imports` — clearer intent for repeat re-import workflow.
- **Drilldown drawer for rule-applied rows:** Deferred. Compact import signal + Local Settings remain sufficient for V1.

## Files Changed

| File | Change |
|------|--------|
| `src/ui/category-review-drawer.ts` | Button label |
| `src/ui/category-review-drawer.test.ts` | Test title |
| `src/ui/dashboard-cockpit-actions.test.ts` | Fixture button text |
| `docs/TODOS.md` | Mark copy decision shipped |

## Tests Run

```bash
npx vitest run src/ui/category-review-drawer.test.ts src/ui/dashboard-cockpit-actions.test.ts
# passed
```

E2e unchanged — uses `[data-role="save-rule"]`, not button text.