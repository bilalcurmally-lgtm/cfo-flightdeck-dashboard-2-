# Codex Review — Detail-Role Metric Contracts

Date: 2026-06-15
Slice: A from `docs/GROK_COMPOSER_2_5_BACKLOG_BATCH_2026-06-15.md`

## What Changed

Extended the metric registry with detail-role contracts for reporting surfaces. Scalar cockpit KPIs remain unchanged.

### New metric ids (all `role: "detail"`)

| Id | Label |
|----|-------|
| `topHeads` | Top Heads |
| `topSubcategories` | Top Subcategories |
| `transactionPreview` | Transaction Preview |
| `rawRow` | Raw Row |
| `importQuality` | Import Quality |
| `accountBalances` | Account Balances |

### Export wiring

- **Dashboard Manifest:** `kpis` = scalar contracts only (9). New `detailContracts` section carries contract metadata plus `contextValue` (row counts, import-quality ratio, selection flags).
- **Accountant Workbook:** KPI Audit sheet unchanged — scalar contracts only to avoid blank-value rows for accountants.

### Helpers

- `getScalarMetricContracts()` — cockpit + scalar exports
- `getDetailMetricContracts()` — reporting/detail surfaces

## Files Changed

| File | Change |
|------|--------|
| `src/finance/metric-registry.ts` | 6 detail contracts + helpers |
| `src/finance/metric-registry.test.ts` | Detail role + scalar/detail split tests |
| `src/export/dashboard-manifest.ts` | `detailContracts` section |
| `src/export/dashboard-manifest.test.ts` | Detail contract assertions |
| `src/export/accountant-workbook.ts` | Scalar-only KPI audit |

## Tests Run

```bash
npx vitest run src/finance/metric-registry.test.ts src/export/dashboard-manifest.test.ts src/export/accountant-workbook.test.ts
# 37 passed
```

## Top Review Points

1. Detail metrics are semantic-layer only — not added to cockpit KPI cards.
2. Manifest `contextValue` is metadata (counts/ratios), not full row dumps.
3. Core metric ids (`netCash`, `runwayMonths`, etc.) are unchanged.
4. Accountant workbook intentionally excludes detail contracts from KPI Audit.

## Open Questions

- Should lineage drawers for Top Heads / Transaction Preview surface contract decision questions? Deferred — low risk to land registry first.