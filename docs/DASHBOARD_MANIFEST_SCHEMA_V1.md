# Dashboard Manifest Schema V1

Version: `1`
Source of truth: `src/export/dashboard-manifest.ts` (`FinanceDashboardManifest`)

The Dashboard Manifest is a local JSON export describing the analytical surface of the
finance dashboard at export time. It is metadata-first: chart/table specs and KPI contracts,
not full ledger row dumps.

## Top-Level Shape

```json
{
  "version": 1,
  "generatedAt": "2026-06-15T12:00:00.000Z",
  "source": { },
  "context": { },
  "readiness": { },
  "kpis": [],
  "detailContracts": [],
  "charts": [],
  "tables": [],
  "diagnostics": [],
  "sources": [],
  "caveats": []
}
```

| Field | Type | Purpose |
|-------|------|---------|
| `version` | `1` | Manifest schema version (integer literal) |
| `generatedAt` | ISO-8601 string | Export timestamp |
| `source` | object | Import file identity and row counts |
| `context` | object | Cockpit scope, filters, confidence, planning summary |
| `readiness` | object | Trust Center status for the visible scope |
| `kpis` | array | Scalar cockpit KPI contracts with live values |
| `detailContracts` | array | Non-scalar/detail analytical contracts |
| `charts` | array | Chart spec metadata (no embedded series data) |
| `tables` | array | Table spec metadata (no embedded row dumps) |
| `diagnostics` | array | Compact diagnostic summaries |
| `sources` | array | Dataset/source references with row counts |
| `caveats` | string[] | Privacy and scope warnings |

## `source`

| Field | Type | Notes |
|-------|------|-------|
| `name` | string | Active import filename |
| `rawRows` | number | Raw import row count |
| `acceptedRows` | number | Normalized ledger rows |
| `rejectedRows` | number | Validation failures |

## `context`

| Field | Type | Notes |
|-------|------|-------|
| `currency` | string | Display currency code |
| `cashOnHand` | number | User-entered cash balance |
| `trendGrain` | string | `daily` \| `weekly` \| `monthly` |
| `reviewPreset` | string | Active review preset id |
| `reviewPresetLabel` | string | Human label |
| `filters` | object | Dashboard filter state |
| `hasImportHistory` | boolean | Prior import exists in workspace |
| `visibleKpiRowCount` | number | Rows in KPI-visible scope |
| `nonOperatingRowCount` | number | Non-operating rows in view |
| `runwayConfidence` | object | `level`, `score`, `headline` |
| `planning` | object | Budget and expected-income summary |

### `context.planning`

| Field | Type | Notes |
|-------|------|-------|
| `budgetCount` | number | Workspace budget rows |
| `budgetVariance` | object | Counts by status: `under`, `onTrack`, `over`, `noBudget` |
| `expectedIncomeCount` | number | Structured expected-income events |
| `expectedIncomeTentativeCount` | number | Events tagged tentative |
| `expectedIncomeReceivedCount` | number | Events tagged received (excluded from forecast) |

## KPI vs `detailContracts`

Both arrays use metric contract metadata from `src/finance/metric-registry.ts`, but they
serve different roles:

| Array | Role | `value` field | Typical use |
|-------|------|---------------|-------------|
| `kpis` | `primary`, `secondary`, `review` | Live scalar cockpit value (currency, count, months, ratio) | Headline tiles |
| `detailContracts` | `detail` | `contextValue` — structural count or ratio for the detail surface | Tables, previews, quality panels |

Scalar KPI ids include `netCash`, `runwayMonths`, `revenue`, `outflow`, `averageMonthlyOutflow`,
`revenueConcentration`, `rejectedRows`, `duplicates`, `transfers`.

Detail contract ids include `topHeads`, `topSubcategories`, `transactionPreview`, `rawRow`,
`importQuality`, `accountBalances`.

A consumer should not assume every contract id appears in both arrays.

## `readiness`

| Field | Type |
|-------|------|
| `status` | `ready` \| `partial` \| `needs-review` |
| `headline` | string |
| `signals` | `{ id, severity, label, detail }[]` |

## Chart Spec Fields

Each `charts[]` entry:

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Stable chart id |
| `title` | string | Display title |
| `analyticalQuestion` | string | What the chart answers |
| `chartType` | string | e.g. `grouped-bar`, `line`, `horizontal-bar`, `bar` |
| `datasetId` | string | Logical dataset reference |
| `encoding` | object | Axis/series field names (`x`, `y`, `category`, `value`, `series`) |
| `unit` | string | Usually display currency |
| `emptyState` | string | Message when no data |
| `caveats` | string[] | Scope assumptions |
| `rowCount` | number | Rows available in the referenced dataset |

V1 chart ids: `cashTrend`, `forecast13Week`, `topHeads`, `topSubcategories`, `accountBalances`.

## Table Spec Fields

Each `tables[]` entry:

| Field | Type |
|-------|------|
| `id` | string |
| `title` | string |
| `analyticalQuestion` | string |
| `datasetId` | string |
| `columns` | string[] |
| `rowCount` | number |
| `emptyState` | string |
| `caveats` | string[] |

V1 table ids: `visibleTransactions`, `exclusionsAndReview`, `rejectedRows`, `kpiAudit`,
`budgetVsActual`.

## Diagnostics

Each `diagnostics[]` entry:

| Field | Type |
|-------|------|
| `id` | string |
| `title` | string |
| `datasetId` | string |
| `summary` | string |
| `topItems` | `{ label, direction?, amount?, share? }[]` |
| `available` | boolean |

Includes metric diagnostics plus `runwayConfidence`.

## `sources`

Dataset references for consumers that need to join specs to export payloads:

| Field | Type |
|-------|------|
| `id` | string |
| `label` | string |
| `kind` | string | e.g. `csvImport`, `transactionRecords`, `aggregates`, `forecast` |
| `rowCount` | number |

## Compatibility And Versioning

- **`version: 1`** is the only supported manifest version today.
- New fields may be added in backward-compatible ways within V1 (consumers should ignore unknown keys).
- Breaking changes require incrementing `version` and a new schema doc.
- Manifest reflects the **visible KPI scope** (filters, review preset, exclusions), not the full import.
- Values are computed at export time in the browser; there is no server reconciliation.

## Intentionally Not Included

- Full normalized ledger row dumps (use Transactions CSV/Excel or Accountant Workbook)
- Raw import row payloads
- Workspace internal ids beyond contract/dataset ids
- IndexedDB paths, browser storage keys, or private file paths
- Server-side user ids or multi-tenant identifiers
- Embedded chart series arrays (use `sources` + separate exports for data)
- Classification override maps or saved-rule bodies (caveats may mention counts only)

## Privacy

The first `caveats` entry states that the file is generated locally and transaction data is
not uploaded by default.
