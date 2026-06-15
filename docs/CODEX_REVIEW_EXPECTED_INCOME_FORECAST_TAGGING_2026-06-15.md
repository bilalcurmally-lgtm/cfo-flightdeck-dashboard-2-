# Codex Review — Expected-Income Forecast Tagging V1

Date: 2026-06-15
Slice: B from `docs/GROK_COMPOSER_2_5_P3_BATCH_2026-06-15.md`

## Model Shape

`ExpectedIncomeEvent`:

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Stable event id |
| `dueDate` | string | `YYYY-MM-DD` |
| `amount` | number | Positive inflow |
| `label` | string | Operator-facing description |
| `status` | `expected` \| `tentative` \| `received` | `received` excluded from forecast |

## Forecast Integration

- `resolveForecastEvents(structuredEvents, futureEventsText)` merges:
  1. Active structured events (`status !== "received"`) via `toFutureCashEvent`
  2. Text-parser events from `parseFutureCashEvents` (deduped by date/amount/label signature)
- `buildDashboardView` uses `resolveForecastEvents` instead of text-only parsing
- Rejected text lines still surface on `forecast.rejectedEvents`

## Persistence Strategy

- Same workspace v4 snapshot as budgets: `expectedIncomeEvents[]`
- IndexedDB + `.billu.json` round-trip
- v3 project files migrate with empty array

## UI Surface

- **Forecast panel** — structured add/remove block with scope-guard copy
- **Local Settings** — shared settings area via `renderExpectedIncomeSettings`
- `bindExpectedIncomeActions` in `main.ts` triggers re-render on change

## Runway Confidence Hook

- `buildRunwayConfidenceInput` accepts `expectedIncomeEvents`
- Tentative events add caution reason `expected-income-tentative` (−4 each, cap −8)
- Rejected text lines still use existing `manual-events-rejected` reason

## Compatibility With Text Parser

- `futureEventsText` textarea unchanged
- Structured events take precedence on duplicate signatures
- No migration required for operators using text-only workflow

## Scope Guard Confirmation

- Forecast input only — no invoicing, clients, receivables ledger, or third-party storage
- In-app copy states forecast-only intent

## Test Coverage

| Area | File |
|------|------|
| Resolve + dedupe | `src/finance/expected-income.test.ts` |
| Workspace round-trip | `src/workspace/workspace-store.test.ts` |
| Tentative runway penalty | `src/finance/runway-confidence.test.ts` |
| Manifest planning counts | `src/export/dashboard-manifest.test.ts` |

## Files Changed

| File | Change |
|------|--------|
| `src/finance/expected-income.ts` | Model + resolve |
| `src/finance/expected-income.test.ts` | Unit tests |
| `src/finance/dashboard-view.ts` | Forecast merge |
| `src/ui/expected-income-actions.ts` | Add/delete handlers |
| `src/ui/dashboard-sections.ts` | Forecast settings UI |
| `src/ui/dashboard-results.ts` | Pass-through + runway input |
| `src/finance/runway-confidence.ts` | Tentative caution |
| `src/main.ts` | Wiring |
| `src/export/dashboard-manifest.ts` | Planning metadata |

## Suggested Commit

`feat(forecast): expected income tagging V1`

## Codex Review Notes

- Tightened text-event dedupe so a structured expected-income event also suppresses a
  matching legacy text event when the operator-entered label omits the generated status
  suffix.
- Tightened project-file validation so imported expected-income entries must satisfy the
  same semantic validator as UI-created entries.
