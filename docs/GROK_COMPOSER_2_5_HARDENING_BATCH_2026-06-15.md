# Grok Composer 2.5 Brief - Hardening Batch After P3

Use this brief as the next prompt for Grok Composer 2.5 after Codex lands Budget vs Actual,
Expected-Income Forecast Tagging, and the rule-applied drilldown decision.

## Current State

Repository: `cfo-flightdeck-dashboard-2-`

By this point the planned backlog is mostly shipped:

- Import history and repeat re-import workflow.
- Saved classification rules and persisted review decisions.
- Metric contracts, readiness/trust center, diagnostics.
- Accountant Workbook Export V1.
- Dashboard Manifest Export V1 with chart specs.
- Detail metric contracts.
- Runway confidence.
- Budget vs Actual V1.
- Expected-Income Forecast Tagging V1.

Known local noise to leave alone:

- `.claude/`
- `mcps/`
- `src/finance/__snapshots__/audit-derive.test.ts.snap` line-ending mark

## Goal

Move from backlog execution to hardening. Prefer small, reviewable improvements that make
the shipped product more reliable, testable, and accountant/operator friendly.

Do not start a new product lane unless it is explicitly listed below.

## Slice A - Accountant Workbook Planning Sheet

Priority: highest.

Goal: add planning context to the accountant workbook now that budgets and expected income
exist.

Suggested sheet:

`Planning`

Include sections for:

- Budget vs Actual rows:
  - month
  - scope
  - key
  - flow
  - budgeted
  - actual
  - variance
  - variance percent
  - status
  - note
- Expected income events:
  - due date
  - amount
  - label
  - status
  - whether included in forecast

Constraints:

- Keep workbook styling plain, consistent with existing workbook exports.
- Preserve existing sheets and filenames.
- Do not dump unrelated workspace internals.

Suggested files:

- `src/export/accountant-workbook.ts`
- `src/export/accountant-workbook.test.ts`
- maybe `docs/TODOS.md`

Review doc:

`docs/CODEX_REVIEW_ACCOUNTANT_WORKBOOK_PLANNING_SHEET_2026-06-15.md`

## Slice B - E2E Coverage For Planning Persistence

Priority: high.

Goal: add one Playwright workflow proving budgets and expected income survive project
save/open or reload, whichever is cleaner with existing e2e patterns.

Suggested scenario:

1. Import sample and apply mapping.
2. Add one budget.
3. Add one expected income event.
4. Save `.billu.json` project.
5. Clear/reset.
6. Open project.
7. Confirm budget row and expected income row are restored.

If project-file e2e is too brittle, use reload persistence via IndexedDB and document why.

Suggested files:

- `e2e/project-file.spec.ts` or new `e2e/planning-persistence.spec.ts`

Review doc:

`docs/CODEX_REVIEW_PLANNING_PERSISTENCE_E2E_2026-06-15.md`

## Slice C - Manifest Schema Version Note

Priority: medium, docs/spec only unless implementation needs a tiny tweak.

Goal: document the manifest schema now that external-ish consumers could appear.

Create:

`docs/DASHBOARD_MANIFEST_SCHEMA_V1.md`

Include:

- top-level fields
- kpi vs detailContracts split
- chart spec fields
- planning metadata
- diagnostics
- compatibility/versioning notes
- what is intentionally not included (full row dumps, server ids, private storage paths)

Review doc:

`docs/CODEX_REVIEW_MANIFEST_SCHEMA_DOC_2026-06-15.md`

## Slice D - UI Microcopy Audit

Priority: optional.

Goal: scan current in-app labels introduced recently and make copy consistent:

- Budget Vs Actual
- Expected Income
- Runway confidence
- Dashboard Manifest
- Accountant Workbook
- Remember for future imports

Constraints:

- Copy-only unless a tiny test update is needed.
- No layout redesign.
- Keep wording practical and operator-facing.

Review doc:

`docs/CODEX_REVIEW_MICROCOPY_AUDIT_2026-06-15.md`

## Verification

For code slices:

- `npx tsc --noEmit`
- targeted `npx vitest run ...`
- `npx vitest run`
- `npm run build`
- `git diff --check`

Run Playwright if UI/persistence changed:

- `npx playwright test --workers=1`

## Final Handoff To Codex

Provide:

- completed slices
- files changed per slice
- verification results
- known limitations
- suggested commit split
- what remains in `docs/TODOS.md`
