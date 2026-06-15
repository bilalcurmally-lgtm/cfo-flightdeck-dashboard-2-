# Accountant Workbook Export V1 — Implementation Plan

Date: 2026-06-15
Author: Grok Composer 2.5 (plan artifact for Codex review)
Source brief: `docs/GROK_COMPOSER_2_5_ACCOUNTANT_WORKBOOK_BRIEF.md`
Repo state: diagnostics family, metric contracts, readiness, and saved-rules foundation are on `main`.

## Executive Summary

Add an **additive** multi-sheet `.xlsx` export — the **Accountant Workbook** — that packages everything an accountant needs to reconcile cockpit KPIs against ledger rows, review decisions, import quality, and local diagnostics. Reuse the existing `makeWorkbookBlob` helper (`src/export/xlsx-workbook.ts`). Keep all current exports unchanged.

V1 is deliberately scoped: pure export-model code first, unit tests with `parseExcelWorkbook`, then a single new export button wired through the existing `dashboard-export-payloads.ts` → `dashboard-export-actions.ts` path.

---

## 1. Current Export Surface

### Existing exports

| Export | Builder | Output | Records scope |
|--------|---------|--------|---------------|
| Transactions CSV | `buildTransactionsCsvExport` | `.csv` | Full ledger with in-session classification overrides (`getFullExportRecords`) |
| Transactions Excel | `buildTransactionsWorkbookExport` | single-sheet `.xlsx` (`Transactions`) | Same as CSV |
| Filtered CSV | `buildFilteredTransactionsCsvExport` | `.csv` | `visibleRecords` (current KPI-visible rows) |
| Reviewer JSON | `buildReviewerExportReport` | `.json` | Summarized audit state + forecast; uses reviewed import result when exclusions active |
| Trend CSV/SVG/PNG | `buildTrendCsvExport`, `buildTrendSvgExport` | chart artifacts | Visible summary only |
| Print Report | browser `print()` | HTML | Rendered dashboard |

### Key infrastructure

- **`src/export/xlsx-workbook.ts`** — lightweight OOXML zip builder. Supports multiple sheets, numeric cells (`t="n"`), and XML escaping. No styling, no formulas. Sufficient for V1.
- **`src/export/transactions-workbook.ts`** — single-sheet pattern: header row + `transactionWorkbookRow(record)` mapper. **Reuse this row shape** for Normalized Ledger and Exclusions sheets.
- **`src/export/dashboard-export-payloads.ts`** — pure payload builders returning `{ filename, blob/contents, mediaType }`. Accountant workbook adds `buildAccountantWorkbookExport` here.
- **`src/ui/dashboard-export-actions.ts`** — binds `#export-*` buttons. Pattern: read state via getters, call payload builder, `downloadBlob`.
- **`src/ui/dashboard-sections.ts`** — `renderExportPanel()` renders export buttons. Add `#export-accountant-workbook`.
- **`src/export/transactions-workbook.test.ts`** — uses `parseExcelWorkbook` from `src/import/excel` to assert sheet names and cell values. **Copy this pattern** for accountant workbook tests.

### Proposed new files and functions

| File | Purpose |
|------|---------|
| `src/export/accountant-workbook.ts` | Sheet row builders + `buildAccountantWorkbook(input)` → `Blob` |
| `src/export/accountant-workbook.test.ts` | Unit tests per sheet + edge cases |
| `src/export/ledger-workbook-row.ts` *(optional)* | Shared `ledgerWorkbookRow(record)` extracted from `transactions-workbook.ts` if duplication becomes noisy |

| Function | Location | Role |
|----------|----------|------|
| `buildAccountantWorkbook(input)` | `accountant-workbook.ts` | Assembles all sheets → `makeWorkbookBlob` |
| `buildAccountantWorkbookExport(...)` | `dashboard-export-payloads.ts` | Wraps builder + filename |
| `accountantWorkbookFilename(sourceName, generatedAt)` | `accountant-workbook.ts` | `{stem}-accountant-workbook-{date}.xlsx` |
| `buildAccountantWorkbookInput(...)` | `accountant-workbook.ts` or `dashboard-export-payloads.ts` | Maps live app state → typed input *(optional convenience)* |

### UI wiring

- New button: `#export-accountant-workbook` labeled **Accountant Workbook** in `renderExportPanel()`.
- `bindDashboardExportActions` needs additional getters (see §4). `main.ts` already has `viewState`, `classificationOverrides`, `reviewExcludedItemIds`, and `buildDashboardView` output — thread these through at bind time.

---

## 2. Data Inventory

Legend: **A** = available now, **D** = derivable now, **S** = small model addition, **X** = defer from V1.

### Sheet 1 — Summary

| Field | Source | Status |
|-------|--------|--------|
| Generated timestamp (ISO) | `generatedAt` param | A |
| Source filename | `sourceName` | A |
| Currency | `settings.currency` via export binding | A |
| Cash on hand | `getCashOnHand()` | A |
| Review preset label | `reviewPresetLabel(reviewPreset)` | A |
| Active dashboard filters | `DashboardFilters` serialized | A |
| Trend grain | `viewState.trendGrain` | A |
| Raw import row count | `result.rawRows.length` | A |
| Accepted row count | `result.records.length` | A |
| Rejected row count | `result.rejectedRows.length` | A |
| Visible KPI row count | `view.filteredRecords.length` | A |
| Excluded-from-KPI row count | D: `overriddenRecords.length - visible` + non-operating + review exclusions | D |
| Non-operating row count | `view.nonOperating.rows.length` | A |
| Readiness status | `assessReadiness(...).status` | D (same inputs as `dashboard-results.ts`) |
| Readiness headline | `assessReadiness(...).headline` | D |
| Readiness signals (id, severity, label, detail) | `assessReadiness(...).signals` | D |
| Import date format | `result.dateFormat` | A |
| Column mapping summary | `result.mapping` keys → column names | A |
| Privacy note | static string (match reviewer JSON) | A |
| Saved rules applied (row/rule counts) | `appliedRuleFeedback` from render input | A *(if wired)* |
| Prior import comparison available | `hasImportHistory` flag | A |

### Sheet 2 — KPI Audit

| Field | Source | Status |
|-------|--------|--------|
| Metric id, label, role, decision question, formula, format, required inputs, caveats, readiness | `metricContracts` in `metric-registry.ts` | A |
| Live value | `deriveAuditedCockpit({ summary, records, rejectedRows })` + `cockpit.review` for guardrails | A |
| Plain English explanation | `summary.lineage.*.plainEnglish` + `cashHealth.lineage.*.plainEnglish` | A |
| Direct row count | `lineage.direct.length` | A |
| Excluded row count | `lineage.excluded.length` | A |
| Assumptions (label, value, source) | `lineage.assumptions` flattened | A |
| Derived calc tree summary | `lineage.derived` label + value only (not full tree) | D |
| Guardrail counts (rejected, duplicates, transfers) | `cockpit.review` | A |
| Revenue concentration ratio | `summary.cashHealth.revenueConcentration` | A |

**Mapping contract id → live value:**

| Contract id | Value source |
|-------------|--------------|
| `netCash` | `cockpit.netCash` + `summary.lineage.netCash` |
| `runwayMonths` | `cockpit.runwayMonths` + `cashHealth.lineage.runwayMonths` |
| `revenue` | `cockpit.revenue` + `summary.lineage.revenue` |
| `outflow` | `cockpit.outflow` + `summary.lineage.outflow` |
| `averageMonthlyOutflow` | `cockpit.averageMonthlyOutflow` + `cashHealth.lineage.averageMonthlyOutflow` |
| `revenueConcentration` | `summary.cashHealth.revenueConcentration` |
| `rejectedRows` | `cockpit.review.rejected` |
| `duplicates` | `cockpit.review.duplicates` |
| `transfers` | `cockpit.review.transfers` |

No new metrics in V1. Detail-role contracts (Top Heads, Transaction Preview, etc.) remain deferred per `docs/TODOS.md`.

### Sheet 3 — Normalized Ledger

| Field | Source | Status |
|-------|--------|--------|
| Date, source sheet, flow, account, head, parent, subcategory, description, counterparty, amount, signed net, running balance | `view.filteredRecords` (KPI-visible rows) | A |
| Classification override applied | Compare `overrides.get(id)` vs original `result.records` | D |
| Operating vs non-operating | `isOperating(record)` | D |

**Scope decision:** Ledger sheet rows = `view.filteredRecords` (matches active review preset and filters, same scope as cockpit KPIs). Document this explicitly on the Summary sheet.

### Sheet 4 — Exclusions And Review

| Field | Source | Status |
|-------|--------|--------|
| Full transaction context (ledger columns) | Same as Normalized Ledger | A |
| Exclusion reason (primary) | Derived by priority rules (§3) | D |
| Exclusion confidence | `ExclusionRef.confidence` where from lineage | A |
| Review drawer item id/kind | `buildReviewDrawerItems` + `excludedReviewItemIds` | A |
| Category review reasons | `categoryReview.items[].reasons` | A |
| Category review acted flag | `categoryReview.items[].acted` | A |
| Non-operating signed total context | `view.nonOperating` | A |
| Duplicate group key | `diagnostics.duplicateGroups` | A |
| Transfer candidate detail | `diagnostics.transferCandidates` | A |
| Unassigned head/counterparty flags | field value checks | D |

**Universe for exclusion rows:** `applyClassificationOverrides(result.records, overrides)` minus `view.filteredRecords`, **plus** category-review items with `acted === false` that remain in `filteredRecords` (flagged as `needs-review`, not removed from ledger sheet).

**Reason priority** (first match wins when building exclusion rows):

1. `dashboard filter` — record not in `filterTransactions(overridden, filters)`
2. `non-operating` — `!isOperating(record)` (parent Internal/Financing)
3. `review exclusion` — id in `view.excludedTransactionIds` (duplicate/transfer drawer exclusions)
4. `review preset` — in `baseFilteredRecords` but removed by `applyReviewPreset` for active preset
5. `needs category review` — in `categoryReview.items` with `acted === false`

### Sheet 5 — Rejected Rows

| Field | Source | Status |
|-------|--------|--------|
| Row number | `ImportIssue.rowNumber` | A |
| Rejection reason | `ImportIssue.reason` | A |
| Raw import columns | `ImportIssue.row` (arbitrary `ImportedRow` keys) | A |

**V1 approach:** Fixed leading columns (`Row Number`, `Reason`) followed by dynamic columns from the union of keys present across rejected rows (sorted alphabetically). Matches how `ImportedRow` is stored without inventing a fixed schema. Empty sheet with headers only when `rejectedRows.length === 0`.

### Sheet 6 — Diagnostics

| Section | Source function | Status |
|---------|----------------|--------|
| Net cash contributors (positives) | `topNetCashContributors(filteredRecords)` | A |
| Net cash contributors (negatives) | same | A |
| Burn contributors (heads) | `topBurnContributors(filteredRecords)` | A |
| Burn contributors (subcategories) | same | A |
| Revenue concentration (heads) | `revenueConcentration(filteredRecords)` | A |
| Revenue concentration (counterparties) | same | A |
| Largest transaction influence | `largestTransactionInfluence(filteredRecords)` | A |
| Filter/exclusion impact | `filterExclusionImpact(view.reviewSummary, view.summary)` | A |
| Runway change explanation | `explainRunwayChange(prev, curr, formatters)` | X — requires prior import snapshot wiring not currently passed to export bindings |

Diagnostics sheet uses **section headers** (text rows) separating tables, all on one worksheet named `Diagnostics`. Skip sections that return null/empty (e.g. `filterExclusionImpact` when no delta).

### Fields intentionally deferred from V1

| Field | Reason |
|-------|--------|
| Full calc tree XML / nested lineage nodes | Too wide for Excel; plain-English + row counts suffice |
| Saved rule definitions (full rule bodies) | S — small addition; mention counts on Summary only |
| Dashboard manifest / chart specs | Separate P2 item |
| Forecast / 13-week projection rows | Already in Reviewer JSON; avoid workbook scope creep |
| Per-row audit trail IDs linking to calc nodes | No stable cross-sheet ID model yet |
| Runway change diagnostics | Needs import-history snapshot in export input |

---

## 3. Workbook Sheet Schemas

Excel sheet names (≤31 chars): `Summary`, `KPI Audit`, `Normalized Ledger`, `Exclusions And Review`, `Rejected Rows`, `Diagnostics`.

### 3.1 Summary

Two-column key/value layout.

| Column | Type | Source | Fallback |
|--------|------|--------|----------|
| Field | string | label | — |
| Value | string \| number | computed | `""` |

**Rows (in order):**

1. `Generated At` — ISO-8601 string
2. `Source File` — `sourceName`
3. `Currency` — e.g. `USD`
4. `Cash On Hand` — number (0 if unset)
5. `Review Preset` — `reviewPresetLabel(preset)`
6. `Trend Grain` — `daily` / `weekly` / `monthly`
7. `Filter: Flow` — value or `all`
8. `Filter: Account` — value or `all`
9. `Filter: Head` — value or `all`
10. `Filter: Subcategory` — value or `all`
11. `Filter: Counterparty` — value or `all`
12. `Filter: Date From` — ISO date or blank
13. `Filter: Date To` — ISO date or blank
14. `Raw Import Rows` — number
15. `Accepted Rows` — number
16. `Rejected Rows` — number
17. `Visible KPI Rows` — number
18. `Excluded From KPI Rows` — number
19. `Non-Operating Rows` — number
20. `Readiness Status` — `ready` / `partial` / `needs-review` / `empty`
21. `Readiness Headline` — string
22. *(blank row)*
23. `Readiness Signal` header row: `Signal Id`, `Severity`, `Label`, `Detail`
24. One row per readiness signal (0–N)
25. *(blank row)*
26. `Privacy` — static local-generation note

### 3.2 KPI Audit

| Column | Type | Source | Fallback |
|--------|------|--------|----------|
| Metric Id | string | `contract.id` | — |
| Label | string | `contract.label` | — |
| Role | string | `contract.role` | — |
| Value | number \| string | mapped live value; `runwayMonths` null → `""` | `""` |
| Format | string | `contract.format` | — |
| Decision Question | string | `contract.decisionQuestion` | — |
| Formula | string | `contract.formula` | — |
| Required Inputs | string | `contract.requiredInputs.join(", ")` | — |
| Caveats | string | `contract.caveats.join(" ")` | — |
| Readiness Expectation | string | `contract.readiness` | — |
| Plain English | string | lineage `plainEnglish` when available | `""` |
| Direct Row Count | number | `lineage.direct.length` | `0` |
| Excluded Row Count | number | `lineage.excluded.length` | `0` |
| Assumptions | string | `assumptions.map(a => \`${a.label}=${a.value} (${a.source})\`).join("; ")` | `""` |

One row per entry in `metricContracts` (10 rows today). Values reflect **visible KPI state** (post preset, filters, exclusions).

### 3.3 Normalized Ledger

| Column | Type | Source | Fallback |
|--------|------|--------|----------|
| Date | string | `dateISO` | — |
| Source Sheet | string | `sourceSheet` | `""` |
| Flow | string | `flow` | — |
| Account | string | `account` | — |
| Head | string | `head` | — |
| Parent | string | `parent` | — |
| Subcategory | string | `subcategory` | — |
| Description | string | `description` | — |
| Counterparty | string | `counterparty` | — |
| Amount | number | `amount` | — |
| Signed Net | number | `signedNet` | — |
| Running Balance | number \| string | `runningBalance` | `""` |
| Override Applied | string | `yes` / `no` | `no` |
| Operating | string | `yes` / `no` | `yes` |

Sorted by `dateISO`, then `id` for stable output.

### 3.4 Exclusions And Review

All Normalized Ledger columns **plus**:

| Column | Type | Source | Fallback |
|--------|------|--------|----------|
| Exclusion Reason | string | priority rules (§2) | — |
| Review Item Id | string | matching drawer item id | `""` |
| Review Item Kind | string | `duplicate` / `transfer` / `rejected` / `category` | `""` |
| Category Review Reasons | string | `reasons.join(", ")` | `""` |
| Confidence | string | `high` / `medium` / `low` | `medium` |

Include rows from the exclusion universe (§2). Sort by reason, then date.

### 3.5 Rejected Rows

| Column | Type | Source | Fallback |
|--------|------|--------|----------|
| Row Number | number | `ImportIssue.rowNumber` | — |
| Reason | string | `ImportIssue.reason` | — |
| `{RawColumn}` * | string | `ImportIssue.row[column]` per dynamic column | `""` |

\*Dynamic columns: sorted union of all keys in rejected `ImportedRow` objects.

### 3.6 Diagnostics

Single sheet with labeled sections. Each section starts with a **section title row** (column A only), then a header row, then data rows.

**Section: Net Cash Contributors**

| Column | Type | Source |
|--------|------|--------|
| Direction | string | `positive` / `negative` |
| Label | string | contributor label |
| Flow | string | `revenue` / `outflow` |
| Amount | number | contributor amount |

**Section: Burn Contributors**

| Column | Type | Source |
|--------|------|--------|
| Group Type | string | `head` / `subcategory` |
| Label | string | |
| Amount | number | |
| Share | number | 0–1 ratio |

**Section: Revenue Concentration**

| Column | Type | Source |
|--------|------|--------|
| Group Type | string | `head` / `counterparty` |
| Label | string | |
| Amount | number | |
| Share | number | |

**Section: Largest Transaction**

| Column | Type | Source |
|--------|------|--------|
| Field | string | label |
| Value | string \| number | |

Fields: `Id`, `Label`, `Date`, `Head`, `Counterparty`, `Flow`, `Amount`, `Signed Impact`, `Share Of Activity`, `Net Cash`.

**Section: Filter Exclusion Impact** *(omit section when null)*

| Column | Type | Source |
|--------|------|--------|
| Metric | string | `revenue` / `outflow` / `netCash` |
| Before | number | |
| After | number | |
| Delta | number | |
| Hidden Records | number | single value row below header |

---

## 4. Export API Proposal

### Input interface

```typescript
// src/export/accountant-workbook.ts

import type { DashboardViewData } from "../finance/dashboard-view";
import type { DashboardFilters } from "../finance/filters";
import type { ClassificationOverride } from "../finance/classification-overrides";
import type { ReadinessReport } from "../finance/readiness";
import type { ReviewPreset } from "../finance/review-presets";
import type { CsvImportResult, PeriodGrain } from "../finance/types";

export interface AccountantWorkbookInput {
  sourceName: string;
  generatedAt?: Date;
  currency: string;
  cashOnHand: number;
  trendGrain: PeriodGrain;
  reviewPreset: ReviewPreset;
  filters: DashboardFilters;
  result: CsvImportResult;
  view: DashboardViewData;
  readiness: ReadinessReport;
  overrides: Map<string, ClassificationOverride>;
  excludedReviewItemIds: ReadonlySet<string>;
  /** Optional: saved-rule apply feedback for Summary sheet. */
  appliedRuleFeedback?: { rowCount: number; ruleCount: number } | null;
}

export function buildAccountantWorkbook(input: AccountantWorkbookInput): Blob;

export function accountantWorkbookFilename(
  sourceName: string,
  generatedAt?: Date
): string;
```

### Payload wrapper

```typescript
// src/export/dashboard-export-payloads.ts

export function buildAccountantWorkbookExport(
  input: AccountantWorkbookInput
): BlobExportDescriptor;
```

### UI binding extensions

Extend `DashboardExportActionBindings`:

```typescript
getDashboardView: () => DashboardViewData | null;
getOverrides: () => Map<string, ClassificationOverride>;
getExcludedReviewItemIds: () => ReadonlySet<string>;
getActiveFilters: () => DashboardFilters;
buildReadinessReport?: () => ReadinessReport; // or inline assessReadiness in click handler
```

Click handler sketch:

1. Guard: `getActiveImport()` and `getDashboardView()` must be non-null.
2. Build `ReadinessReport` using the **same** `assessReadiness` inputs as `dashboard-results.ts` (extract shared helper `buildReadinessInput(view, result, cashOnHand, hasImportHistory)` to avoid drift — **S** small addition in `readiness.ts` or `dashboard-results.ts`).
3. Call `buildAccountantWorkbookExport({ ... })`.
4. `downloads.blob(filename, blob)`.

`main.ts` already computes `DashboardViewData` during render; store the latest view on `viewState` (or pass through existing render path) so the export binding can read it.

### Filename convention

```
{safeExportStem(sourceName)}-accountant-workbook-{YYYY-MM-DD}.xlsx
```

Example: `sample-finance-accountant-workbook-2026-06-15.xlsx`

---

## 5. Test Plan

### Unit tests — `src/export/accountant-workbook.test.ts`

Use `parseExcelWorkbook` (same as `transactions-workbook.test.ts`). `beforeAll` DOMParser shim required.

| Test case | Assert |
|-----------|--------|
| Happy path — minimal import | 6 sheets with expected names; Summary contains source + readiness; KPI Audit has 10 rows; ledger row matches filtered record |
| Empty filtered ledger | Headers present, zero data rows on Normalized Ledger |
| Rejected rows present | Rejected Rows sheet has row number + reason + raw columns |
| Rejected rows absent | Rejected Rows sheet has headers only (Row Number, Reason) |
| Non-operating exclusion | Exclusions sheet contains row with reason `non-operating` |
| Review drawer exclusion | Exclusions sheet contains `review exclusion` for excluded duplicate/transfer ids |
| Dashboard filter exclusion | Record outside filter appears in Exclusions with `dashboard filter` |
| Review preset narrowing | With preset `revenue`, outflow rows appear in Exclusions with `review preset` |
| Category review pending | Row appears in Exclusions with `needs category review` even if in ledger |
| Classification override | Normalized Ledger `Override Applied` = `yes` |
| Diagnostics — filter impact null | Diagnostics sheet omits Filter Exclusion Impact section |
| Diagnostics — filter impact present | Section appears with delta rows |
| Numeric cells | Amount / Signed Net / Share columns parse as numbers in workbook XML |
| Special characters | Description with `<`, `&`, `"` survives `escapeXml` |
| Filename | `accountantWorkbookFilename` matches stem + date pattern |

### Shared test helper

Create `accountantWorkbookFixture()` building a minimal `AccountantWorkbookInput` from existing test records (`audit-fixtures`, `dashboard-view.test` patterns).

### UI binding test — `dashboard-export-actions.test.ts`

| Test case | Assert |
|-----------|--------|
| Accountant button wired | Click `#export-accountant-workbook` → one blob download with `-accountant-workbook-` filename |
| No active import | Click does nothing |

### Playwright

**Not required for V1.** Existing export e2e coverage is thin (exports are unit-tested). Optional follow-up: one e2e click test if button wiring regresses often. Vitest coverage on builder + binding is sufficient for acceptance.

### Regression

Full suite must stay green:

```bash
npx tsc --noEmit
npx vitest run
npx playwright test --workers=1
npm run build
```

---

## 6. Acceptance Criteria

V1 is complete when:

1. **New export button** `Accountant Workbook` appears in the Exports panel without removing existing buttons.
2. **Download** produces a valid `.xlsx` that opens in Excel / LibreOffice with **6 sheets** named as specified.
3. **Summary** reflects active filters, review preset, cash on hand, row counts, and readiness status/headline/signals.
4. **KPI Audit** has one row per `metricContracts` entry with live values matching the visible cockpit.
5. **Normalized Ledger** matches `view.filteredRecords` (same scope as KPIs), numeric amounts preserved.
6. **Exclusions And Review** lists every out-of-scope row with a deterministic primary reason; pending category reviews are flagged.
7. **Rejected Rows** lists all `result.rejectedRows` with row number, reason, and raw values.
8. **Diagnostics** exports all five available local diagnostics (net cash, burn, revenue concentration, largest transaction, filter impact); runway change omitted unless import-history wiring is added.
9. **Existing exports** unchanged (transactions CSV/XLSX, reviewer JSON, trend exports still pass tests).
10. **Tests**: new unit tests pass; `dashboard-export-actions` binding test passes; full verification commands green.

---

## 7. Risks And Tradeoffs

| Risk | Mitigation |
|------|------------|
| **Readiness input drift** between UI and export | Extract `buildReadinessInput(...)` shared helper used by `dashboard-results.ts` and export |
| **Review preset confuses accountants** | Summary sheet documents preset explicitly; ledger matches KPI scope |
| **Large imports → big workbook** | Accept for V1; no row cap. Revisit streaming if >10k rows becomes common |
| **Duplicate row-mapping logic** | Share `ledgerWorkbookRow` with `transactions-workbook.ts` |
| **`main.ts` doesn't retain `DashboardViewData`** | Store latest view on `viewState` during render (small wiring change) |
| **Dynamic rejected-row columns wide** | Document in Summary; acceptable for accountant reconciliation |
| **Exclusion reason priority ambiguous** | Codify priority order in tests; single primary reason per row |
| **Runway change omitted** | Defer rather than half-wire import history into export |
| **No Excel styling** | Consistent with existing Transactions Excel export; styling is non-goal |

### Defer from V1

- Dashboard Manifest export
- Chart specs / trend chart sheets
- Detail-role metric contracts in KPI Audit
- Saved rule bodies sheet
- Runway change diagnostic section
- Playwright e2e for download
- Multi-currency per-row conversion (currency is metadata only)

---

## 8. Implementation Sequence

Each step is independently testable (TDD: RED → GREEN).

### Step 1 — Scaffold + filename + empty workbook

- Add `accountant-workbook.ts` + test file.
- `buildAccountantWorkbook` returns 6 named sheets with headers only.
- `accountantWorkbookFilename` test.

### Step 2 — Summary sheet

- `buildSummaryRows(input)` pure function.
- Tests: row counts, readiness signals, filter serialization.

### Step 3 — KPI Audit sheet

- `buildKpiAuditRows(input)` joining `metricContracts` + `deriveAuditedCockpit`.
- Tests: 10 rows, null runway, guardrail counts.

### Step 4 — Normalized Ledger sheet

- Reuse/extract `ledgerWorkbookRow`.
- Tests: numeric cells, override flag, sort order.

### Step 5 — Exclusions And Review sheet

- `deriveExclusionRows(input)` with reason priority.
- Tests: each reason type + category review pending.

### Step 6 — Rejected Rows sheet

- `buildRejectedRows(result.rejectedRows)` with dynamic columns.
- Tests: empty, populated, special characters.

### Step 7 — Diagnostics sheet

- `buildDiagnosticsRows(input)` with section builders.
- Tests: each section, null filter impact.

### Step 8 — Payload + UI wiring

- `buildAccountantWorkbookExport` in `dashboard-export-payloads.ts`.
- Button in `dashboard-sections.ts`.
- Binding in `dashboard-export-actions.ts` + test.
- `main.ts` threads view/readiness/getters.

### Step 9 — Shared readiness helper (if not done earlier)

- Extract `buildReadinessInput` to eliminate duplication.

### Step 10 — Final verification

- Full test suite + manual spot-check open in Excel.

---

## 9. Data Analytics Plugin Concepts Preserved

| Workbook sheet | Plugin concept |
|----------------|----------------|
| **Summary** | `validate-data` / `analyze-data-quality` — readiness, source context, row counts |
| **KPI Audit** | `design-kpis` + `kpi-reporting` — metric contracts, formulas, caveats, actuals |
| **Normalized Ledger** | Semantic layer / source rows — local normalized facts behind KPIs |
| **Exclusions And Review** | Data quality + review workflow — caveats, exclusions, human decisions |
| **Rejected Rows** | Import quality — parse failures before semantic layer |
| **Diagnostics** | `metric-diagnostics` — deterministic movement and contributor analysis |

### Intentionally deferred plugin ideas

| Plugin idea | Status |
|-------------|--------|
| `DashboardManifest` export | P2 in `docs/TODOS.md` |
| `visualize-data` chart contracts | P2 chart specs before library |
| `build-dashboard` layout blocks | Future manifest work |
| Enterprise connectors | Out of scope |
| React/Recharts artifact app | Out of scope |
| Notebook / MCP artifact widgets | Out of scope |
| `user-context` full semantic registry | Saved rules exist; full registry deferred |

---

## 10. Reviewer Notes For Codex

Top 5 verification points before implementing or merging:

1. **KPI scope alignment** — Confirm Normalized Ledger uses `view.filteredRecords` (post preset + filters + operating exclusions), not `getFullExportRecords`. The accountant must reconcile to **cockpit numbers**, not the full raw import. Summary must state the active preset/filters so this is legible.

2. **Readiness parity** — Export must call the same readiness inputs as `renderDashboardResults` (including `revenueConcentration >= 0.75` caution and `hasCashOnHand: cashOnHand > 0`). Extract a shared helper; do not copy-paste assess inputs inline.

3. **Exclusion reason priority** — Implement and test the ordered reason assignment (§2 / §3.4). Wrong priority will mislead accountants about why a row left the KPI set.

4. **No regression on existing exports** — Accountant Workbook is additive. Do not change `buildTransactionsWorkbook` behavior or filenames. Shared row mapper extraction must be behavior-preserving.

5. **`DashboardViewData` availability at click time** — Verify `main.ts` exposes the same view used for render, not a stale or partially-built view. The export should use current `classificationOverrides`, `reviewExcludedItemIds`, and `viewState.filters`.

---

## Appendix: Reference File Index

| Area | Path |
|------|------|
| Workbook primitive | `src/export/xlsx-workbook.ts` |
| Existing single-sheet Excel | `src/export/transactions-workbook.ts` |
| Payload orchestration | `src/export/dashboard-export-payloads.ts` |
| UI bindings | `src/ui/dashboard-export-actions.ts` |
| Export panel HTML | `src/ui/dashboard-sections.ts` (`renderExportPanel`) |
| View model / exclusions | `src/finance/dashboard-view.ts` |
| Metric contracts | `src/finance/metric-registry.ts` |
| Lineage / audit | `src/finance/audit.ts`, `src/finance/audit-derive.ts` |
| Diagnostics | `src/finance/metric-diagnostics.ts` |
| Readiness | `src/finance/readiness.ts` |
| Review exclusions | `src/ui/review-queue.ts` |
| Category review | `src/ui/category-review-queue.ts` |
| Operating groups | `src/finance/operating-groups.ts` |
| Test pattern | `src/export/transactions-workbook.test.ts` |
