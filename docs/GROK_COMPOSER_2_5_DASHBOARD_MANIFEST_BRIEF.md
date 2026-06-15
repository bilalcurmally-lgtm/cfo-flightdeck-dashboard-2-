# Grok Composer 2.5 Brief - Dashboard Manifest Export V1

Use this brief as the prompt for Grok Composer 2.5. The assignment is a bounded
implementation task with a required review handoff for Codex.

## Context

Repository: `cfo-flightdeck-dashboard-2-`

Product thesis: Billu.Works Finance Dashboard V2 is a local-first cash cockpit for small
operators. It should be safe to re-import every week, trust every KPI, explain changes
between imports, persist review decisions, and hand an accountant a traceable package.

Current state as of 2026-06-15:

- Import history browser is shipped.
- Saved classification rules and review carry-forward are shipped.
- Metric contracts registry is shipped for core cockpit KPIs.
- Readiness / Trust Center is shipped.
- Local metric diagnostics are shipped.
- Accountant Workbook Export V1 is shipped and Codex-reviewed.

The next high-leverage Data Analytics plugin idea is a portable dashboard manifest: a
structured JSON description of the current analytical surface.

## Assignment

Implement **Dashboard Manifest Export V1** and produce a Codex review handoff.

Add a new export button in the Exports panel:

`Dashboard Manifest`

The button should download a JSON file:

`{stem}-dashboard-manifest-{YYYY-MM-DD}.json`

The manifest should be derived from the same local dashboard state used to render the
cockpit. It should not scrape HTML.

## Required Deliverables

1. Implementation:
   - Add a pure manifest builder.
   - Add tests beside it.
   - Wire it into the existing export payload/action flow.
   - Add/update UI binding tests.

2. Vault docs:
   - Update `docs/TODOS.md` to mark Dashboard Manifest Export V1 shipped if complete.
   - Add `docs/CODEX_REVIEW_DASHBOARD_MANIFEST_2026-06-15.md` with review notes.
   - Add or update a session handoff doc if useful.

3. Verification:
   - Run the full gate:
     - `npx tsc --noEmit`
     - `npx vitest run`
     - `npx playwright test --workers=1`
     - `npm run build`
   - If full Playwright is too slow, say so clearly and run targeted tests plus build.

## Files To Read First

Start with:

- `docs/TODOS.md`
- `docs/data-analytics-plugin-study.md`
- `docs/CODEX_HANDOFF_2026-06-14.md`
- `docs/SESSION_HANDOFF_2026-06-15.md`
- `docs/CODEX_REVIEW_ACCOUNTANT_WORKBOOK_2026-06-15.md`

Then inspect:

- `src/finance/dashboard-view.ts`
- `src/finance/summary.ts`
- `src/finance/cockpit-kpis.ts`
- `src/finance/audit-derive.ts`
- `src/finance/metric-contract.ts`
- `src/finance/metric-registry.ts`
- `src/finance/readiness.ts`
- `src/finance/metric-diagnostics.ts`
- `src/export/dashboard-export-payloads.ts`
- `src/export/accountant-workbook.ts`
- `src/ui/dashboard-export-actions.ts`
- `src/ui/dashboard-sections.ts`
- `src/main.ts`

## Proposed Implementation Shape

Prefer this shape unless repo study reveals a clearly better route:

- Add `src/export/dashboard-manifest.ts`
- Add `src/export/dashboard-manifest.test.ts`
- Add `buildDashboardManifestExport(...)` to `src/export/dashboard-export-payloads.ts`
- Add `#export-dashboard-manifest` binding to `src/ui/dashboard-export-actions.ts`
- Add `Dashboard Manifest` button in `src/ui/dashboard-sections.ts`

Keep the builder pure. UI should only gather current state and pass it in.

## Manifest Scope

Design a `FinanceDashboardManifest` JSON object with stable, explicit sections.

Suggested top-level shape:

```ts
interface FinanceDashboardManifest {
  version: 1;
  generatedAt: string;
  source: {
    name: string;
    rawRows: number;
    acceptedRows: number;
    rejectedRows: number;
  };
  context: {
    currency: string;
    cashOnHand: number;
    trendGrain: PeriodGrain;
    reviewPreset: ReviewPreset;
    filters: DashboardFilters;
    hasImportHistory: boolean;
  };
  readiness: {
    status: string;
    headline: string;
    signals: Array<{ id: string; severity: string; label: string; detail: string }>;
  };
  kpis: ManifestKpi[];
  charts: ManifestChartSpec[];
  tables: ManifestTableSpec[];
  diagnostics: ManifestDiagnostic[];
  sources: ManifestSourceRef[];
  caveats: string[];
}
```

You can adjust names and fields, but keep the JSON compact, stable, and testable.

## KPI Requirements

For each core metric contract in `metricContracts`, include:

- metric id
- label
- role
- format
- value where available
- decision question
- formula
- required inputs
- caveats
- readiness expectation

Values should match the same visible dashboard scope used by the cockpit/accountant
workbook.

## Chart Specs Foundation

This task should include chart specs, not a chart-library migration.

Create lightweight manifest specs for current/future analytical visuals:

- `cashTrend`
- `forecast13Week`
- `topHeads`
- `topSubcategories`
- `accountBalances`

Each chart spec should define:

- id
- title
- analytical question
- chart type
- dataset/source id
- x/y or category/value encodings
- unit/format
- empty state
- caveats/source notes

Do not add Recharts or another chart dependency.

## Table Specs

Include table specs for:

- visible transactions / normalized ledger
- exclusions and review
- rejected rows
- KPI audit

These are specs/metadata, not full row dumps unless the builder already has a clean small
summary. The accountant workbook is the row-heavy export; the manifest is the portable
dashboard definition.

## Diagnostics

Include summary metadata for shipped diagnostics:

- net-cash contributors
- burn contributors
- revenue concentration
- largest transaction influence
- filter/exclusion impact

Keep this compact. It is fine to include top labels/counts and point to source dataset ids
rather than dumping every row.

## Non-Goals

- No server or cloud upload.
- No LLM runtime inside the app.
- No chart-library migration.
- No styling or visual redesign.
- No enterprise analytics connectors.
- No dashboard layout editor.
- No broad refactor of `DashboardViewData`.
- Do not touch `.claude/`, `mcps/`, or the snapshot line-ending noise unless Codex/user
  explicitly asks.

## Acceptance Criteria

- Export panel contains `Dashboard Manifest`.
- Clicking it downloads a `.json` manifest with deterministic filename.
- Manifest is derived from current dashboard state and includes source, context, readiness,
  KPI contracts/values, chart specs, table specs, diagnostic summaries, and caveats.
- Existing exports still work.
- Tests cover:
  - filename
  - top-level manifest shape
  - KPI contract/value mapping
  - readiness parity using `buildReadinessInput`
  - chart spec presence and required fields
  - export button binding
  - no active import / missing view no-op behavior

## Codex Review Doc Requirements

Create:

`docs/CODEX_REVIEW_DASHBOARD_MANIFEST_2026-06-15.md`

Include:

- what changed and which files
- manifest schema summary
- top 5 review points
- manual QA steps:
  - import sample
  - apply mapping
  - click Dashboard Manifest
  - inspect JSON
- known limitations/deferred work
- verification commands and results
- suggested next steps after landing

## Quality Bar

Keep this as a clean V1. The manifest should make the dashboard portable and inspectable,
not become a second application. When in doubt, prefer stable metadata and clear caveats
over dumping huge row arrays or inventing speculative analytics.
