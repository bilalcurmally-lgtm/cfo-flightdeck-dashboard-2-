# Grok Composer 2.5 Brief - P3 Batch After Confidence

Use this brief as the next prompt for Grok Composer 2.5 after Codex lands the detail
contracts, runway confidence, README refresh, and saved-rules copy polish batch.

## Current State

Repository: `cfo-flightdeck-dashboard-2-`

Branch: `main`

Shipped by this point:

- Import history, saved rules, review carry-forward.
- Metric contracts, readiness/trust center, diagnostics.
- Accountant Workbook Export V1.
- Dashboard Manifest Export V1 with chart specs foundation.
- Detail-role metric contracts.
- Runway confidence mechanics.
- README positioning refresh.
- Saved-rules copy polish.

Known local noise to leave alone:

- `.claude/`
- `mcps/`
- `src/finance/__snapshots__/audit-derive.test.ts.snap` line-ending mark

## How To Work

Keep slices separate and reviewable. Do not commit. Codex will review, verify, and land.

For every slice:

- Add/update tests.
- Update `docs/TODOS.md`.
- Add a Codex review doc.
- Run targeted tests and the relevant verification gate.

## Slice A - Budget Vs Actual V1

Priority: highest remaining product slice.

Goal: let a small operator define simple monthly/category budgets locally and compare them
with imported actuals.

Scope:

- Manual budgets only.
- Local-only persistence.
- No bank integrations.
- No recurring billing/accounting package semantics.
- No multi-user/server storage.

Suggested V1 model:

- `BudgetPlan`
  - month or month range
  - category/head or subcategory key
  - amount
  - flow: revenue/outflow
  - optional note
- Pure comparison output:
  - budgeted
  - actual
  - variance
  - variancePercent
  - status: under / on-track / over / no-budget

Suggested files:

- `src/finance/budget.ts`
- `src/finance/budget.test.ts`
- workspace/project-file persistence if the repo has a clean pattern from saved rules
- a small UI surface only if it can reuse existing dashboard settings/forms patterns

Preferred first implementation:

1. Pure finance model and tests.
2. Local settings form or compact panel for adding/removing budget rows.
3. Budget vs Actual summary table in the dashboard.
4. Include budget metadata in Dashboard Manifest.
5. Include a workbook sheet only if straightforward; otherwise document as deferred.

Review doc:

`docs/CODEX_REVIEW_BUDGET_VS_ACTUAL_2026-06-15.md`

Include:

- model shape
- persistence strategy
- UI surface
- test coverage
- what is intentionally not handled

## Slice B - Expected-Income Forecast Tagging V1

Priority: high, but do after Budget Vs Actual unless Codex/user says otherwise.

Goal: make manual future income events easier and safer for freelancer Net-30 timing.

Current app already has `futureEventsText` parsing for forecast events. V1 should improve
the workflow without turning the app into invoicing.

Scope guard:

- Forecast input only.
- Not invoicing.
- Not receivables management.
- No client records.
- No invoice creation/sending.
- No third-party data storage.

Suggested V1:

- Add a structured local model for expected income events:
  - id
  - dueDate
  - amount
  - label
  - optional confidence/status: expected / tentative / received
- Feed expected events into the existing 13-week forecast path.
- Persist locally with the workspace/project file if the pattern is clear.
- Keep the text area parser working for backward compatibility.
- Surface accepted/rejected expected-income events in runway confidence if clean.

Suggested files:

- `src/finance/expected-income.ts`
- `src/finance/expected-income.test.ts`
- `src/finance/forecast.ts` only if needed
- UI/settings files that already handle future events
- workspace/project-file files if persistence is added

Review doc:

`docs/CODEX_REVIEW_EXPECTED_INCOME_FORECAST_TAGGING_2026-06-15.md`

Include:

- model shape
- forecast integration
- persistence strategy
- compatibility with existing future-event text parser
- scope guard confirmation

## Slice C - Optional Rule-Applied Drilldown Decision

Priority: optional, only if A/B are too large or complete.

Goal: decide whether rule-applied rows need more auditability beyond the compact signal and
Local Settings controls.

Preferred output:

- A short decision doc if no code is needed.
- Implement only if there is a tiny, obvious drawer pattern and it adds real value.

Review doc:

`docs/CODEX_REVIEW_RULE_APPLIED_DRILLDOWN_DECISION_2026-06-15.md`

## Verification

For code slices:

- `npx tsc --noEmit`
- targeted `npx vitest run ...`
- `npx vitest run`
- `npm run build`
- `git diff --check`

Run Playwright for UI/persistence workflow changes:

- `npx playwright test --workers=1`

## Final Handoff To Codex

Provide:

- completed slices
- files changed per slice
- verification results
- known limitations
- suggested commit split
- what remains in `docs/TODOS.md`
