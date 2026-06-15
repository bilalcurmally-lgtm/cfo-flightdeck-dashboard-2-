# Codex Review — Dashboard Manifest Export V1

Date: 2026-06-15
Author: Grok Composer 2.5
Brief source: `docs/GROK_COMPOSER_2_5_DASHBOARD_MANIFEST_BRIEF.md`

Hey Codex — Dashboard Manifest Export V1 is implemented on the working tree. Please review the diff against the brief, spot-check the JSON export in-browser, and land when satisfied.

## What Shipped

A new **Dashboard Manifest** export: a structured `.json` description of the current analytical surface derived from local dashboard state (not HTML scraping).

### New export button

- **UI:** `Dashboard Manifest` in the Exports panel (`#export-dashboard-manifest`)
- **Filename:** `{stem}-dashboard-manifest-{YYYY-MM-DD}.json`
- **Additive:** all existing exports unchanged

### Manifest sections

| Section | Contents |
|---------|----------|
| `source` | Import name, raw/accepted/rejected row counts |
| `context` | Currency, cash on hand, trend grain, review preset, filters, import-history flag, visible KPI row count |
| `readiness` | Trust Center status, headline, signals |
| `kpis` | One entry per `metricContracts` with live values + contract metadata |
| `charts` | Lightweight specs for cashTrend, forecast13Week, topHeads, topSubcategories, accountBalances |
| `tables` | Metadata specs for visible transactions, exclusions/review, rejected rows, KPI audit |
| `diagnostics` | Compact summaries for net-cash contributors, burn, revenue concentration, largest transaction, filter/exclusion impact |
| `sources` | Dataset/source refs with row counts |
| `caveats` | Privacy note, scope notes, saved-rule feedback when present |

### Chart specs foundation (V1)

Each chart spec defines id, title, analytical question, chart type, dataset id, encodings, unit, empty state, caveats, and row count. No Recharts or new chart dependency added.

## Files Changed

| File | Change |
|------|--------|
| `src/export/dashboard-manifest.ts` | **NEW** — pure manifest builder + types |
| `src/export/dashboard-manifest.test.ts` | **NEW** — 7 unit tests |
| `src/export/dashboard-export-payloads.ts` | `buildDashboardManifestExport()`, `JsonExportDescriptor` |
| `src/export/dashboard-export-payloads.test.ts` | Manifest export descriptor test |
| `src/ui/dashboard-export-actions.ts` | `#export-dashboard-manifest` binding |
| `src/ui/dashboard-export-actions.test.ts` | Binding + no-op coverage |
| `src/ui/dashboard-sections.ts` | Export button in panel |
| `src/ui/dashboard-sections.test.ts` | Button id assertion |
| `docs/TODOS.md` | Mark manifest + chart specs foundation shipped |
| `docs/CODEX_REVIEW_DASHBOARD_MANIFEST_2026-06-15.md` | This review note |
| `docs/SESSION_HANDOFF_2026-06-15.md` | Updated session handoff |

## Manifest Schema Summary

```ts
interface FinanceDashboardManifest {
  version: 1;
  generatedAt: string; // ISO timestamp
  source: { name, rawRows, acceptedRows, rejectedRows };
  context: { currency, cashOnHand, trendGrain, reviewPreset, reviewPresetLabel, filters, hasImportHistory, visibleKpiRowCount, nonOperatingRowCount };
  readiness: { status, headline, signals[] };
  kpis: ManifestKpi[];
  charts: ManifestChartSpec[];
  tables: ManifestTableSpec[];
  diagnostics: ManifestDiagnostic[];
  sources: ManifestSourceRef[];
  caveats: string[];
}
```

KPI values use the same visible cockpit scope as Accountant Workbook (`view.filteredRecords` + `deriveAuditedCockpit`). Readiness uses shared `buildReadinessInput()` for render/export parity.

## Verification (green on 2026-06-15)

```bash
npx tsc --noEmit          # 0 errors
npx vitest run            # 486 passed
npx playwright test --workers=1   # 24 passed
npm run build             # green
```

## Manual QA Checklist For Codex

1. Import a sample ledger (e.g. `public/sample-owner-next.csv`).
2. Set cash on hand, apply a filter or review preset if desired.
3. Click **Dashboard Manifest** in Exports.
4. Open the downloaded `.json` and confirm:
   - `source.name` matches the import filename
   - `context` filters/preset match the cockpit
   - `readiness` matches the Trust Center widget
   - `kpis` values match visible cockpit KPIs
   - `charts` lists all five spec ids with encodings
   - `tables` row counts are plausible (not full row dumps)
   - `diagnostics` top items populate when ledger has activity
   - `caveats` includes the local-generation privacy note

5. With no active import, confirm the button does nothing (no download).

## Top 5 Review Points

1. **KPI scope alignment** — Manifest KPI values mirror Accountant Workbook / visible cockpit scope (`view.filteredRecords`), not the full import. Confirm this matches the portable-definition intent.

2. **Readiness parity** — Export uses `buildReadinessInput()` shared with render paths. Verify signals match the Trust Center for the same session state.

3. **Metadata vs row dumps** — Manifest intentionally omits full ledger arrays. Accountant Workbook remains the row-heavy handoff. Check table specs and diagnostics stay compact.

4. **Chart specs completeness** — Five chart specs are metadata-only foundations. Confirm ids/encodings are stable enough for future chart migration or regression tests.

5. **No regression on existing exports** — Transactions CSV/XLSX, Reviewer JSON, Accountant Workbook, and trend exports should behave identically.

## Known Limitations / Deferred

- **No embedded dataset payloads** — Chart/table specs reference dataset ids and row counts; actual series/rows are not inlined (by design for V1).
- **Runway change diagnostics** not in manifest (needs prior-import snapshot in export bindings — same deferral as Accountant Workbook).
- **Detail-role metric contracts** (Top Heads as first-class KPIs) still pending in registry.
- **Standalone chart-spec module** not extracted; specs live inside manifest export for now.
- **No e2e click test** for manifest download (unit/binding tests cover builder + wiring).

## Suggested Next Steps After Landing

1. Detail-role metric contracts for Top Heads, Transaction Preview, Import Quality.
2. Forecast / runway confidence mechanics (Phase F).
3. Optional manifest schema versioning doc if external consumers appear.
4. Consider golden-file manifest snapshot test once schema stabilizes.