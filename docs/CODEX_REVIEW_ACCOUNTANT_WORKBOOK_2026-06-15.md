# Codex Review — Accountant Workbook Export V1

Date: 2026-06-15
Author: Grok Composer 2.5
Plan source: `docs/GROK_ACCOUNTANT_WORKBOOK_EXPORT_PLAN.md`
Brief source: `docs/GROK_COMPOSER_2_5_ACCOUNTANT_WORKBOOK_BRIEF.md`

Hey Codex — Accountant Workbook Export V1 is implemented on the working tree. Please review the diff against the plan, spot-check the workbook in Excel, and land when satisfied.

## What Shipped

A new **Accountant Workbook** export: a 6-sheet `.xlsx` that packages cockpit KPIs, ledger rows, exclusions, rejected import rows, and local diagnostics for accountant handoff.

### New export button

- **UI:** `Accountant Workbook` in the Exports panel (`#export-accountant-workbook`)
- **Filename:** `{stem}-accountant-workbook-{YYYY-MM-DD}.xlsx`
- **Additive:** all existing exports unchanged

### Workbook sheets

| Sheet | Contents |
|-------|----------|
| `Summary` | Source, timestamp, currency, cash on hand, filters, preset, row counts, readiness status/headline/signals |
| `KPI Audit` | One row per `metricContracts` entry with live values + lineage metadata |
| `Normalized Ledger` | `view.filteredRecords` (KPI-visible scope) + override/operating flags |
| `Exclusions And Review` | Out-of-scope rows with primary exclusion reason + review metadata |
| `Rejected Rows` | `ImportIssue` rows with dynamic raw columns |
| `Diagnostics` | Net-cash contributors, burn, revenue concentration, largest transaction, filter/exclusion impact |

### Exclusion reason priority (codified)

1. `dashboard filter`
2. `non-operating`
3. `review exclusion`
4. `review preset`
5. `needs category review` (pending items still in ledger also flagged here)
6. fallback `excluded from KPI`

### Shared helpers added

- `src/export/ledger-workbook-row.ts` — shared ledger row mapper (transactions workbook reuses it)
- `buildReadinessInput()` in `src/finance/readiness.ts` — shared readiness inputs for render + export (prevents drift)

## Files Changed

| File | Change |
|------|--------|
| `src/export/accountant-workbook.ts` | **NEW** — workbook builder |
| `src/export/accountant-workbook.test.ts` | **NEW** — 10 unit tests |
| `src/export/ledger-workbook-row.ts` | **NEW** — shared row mapper |
| `src/export/transactions-workbook.ts` | Uses shared ledger row helper |
| `src/export/dashboard-export-payloads.ts` | `buildAccountantWorkbookExport()` |
| `src/ui/dashboard-export-actions.ts` | Button binding + new getters |
| `src/ui/dashboard-sections.ts` | Export button in panel |
| `src/ui/dashboard-export-actions.test.ts` | Binding coverage |
| `src/ui/dashboard-sections.test.ts` | Button id assertion |
| `src/ui/dashboard-results.ts` | Uses `buildReadinessInput()` |
| `src/finance/readiness.ts` | `buildReadinessInput()` helper |
| `src/main.ts` | Threads view/overrides/readiness context into export bindings |
| `docs/GROK_ACCOUNTANT_WORKBOOK_EXPORT_PLAN.md` | Plan artifact (prior session) |
| `docs/CODEX_REVIEW_ACCOUNTANT_WORKBOOK_2026-06-15.md` | This review note |

## Verification (green on 2026-06-15)

```bash
npx tsc --noEmit          # 0 errors
npx vitest run            # 472 passed
npx playwright test --workers=1   # 24 passed
npm run build             # green
```

## Manual QA Checklist For Codex

1. Import a sample ledger (e.g. `public/sample-owner-next.csv`).
2. Set cash on hand, apply a filter or review preset, exclude a duplicate/transfer if present.
3. Click **Accountant Workbook** in Exports.
4. Open the `.xlsx` in Excel/LibreOffice and confirm:
   - **Summary** preset/filters match the cockpit
   - **KPI Audit** values match visible cockpit KPIs
   - **Normalized Ledger** rows match filtered cockpit records
   - **Exclusions** explains non-operating / review / preset rows
   - **Rejected Rows** present when import has rejections
   - **Diagnostics** sections populate (filter impact when exclusions active)

## Top 5 Review Points (from plan §10)

1. **KPI scope alignment** — Normalized Ledger uses `view.filteredRecords`, not full import. Summary documents active preset/filters. Confirm this matches your accountant-handoff intent.

2. **Readiness parity** — Export uses `buildReadinessInput()` shared with `dashboard-results.ts`. Verify signals match the Trust Center widget for the same session state.

3. **Exclusion reason priority** — Check `deriveExclusionRows()` ordering against real duplicate/transfer/non-operating/preset scenarios. Unit tests cover each reason type but a live workbook spot-check is valuable.

4. **No regression on existing exports** — Transactions CSV/XLSX, Reviewer JSON, trend exports should behave identically. `transactions-workbook.test.ts` still passes after ledger row extraction.

5. **View freshness at click time** — `main.ts` passes `displayView` (with visible category-review items) into export bindings. Confirm export reflects in-session overrides and review exclusions without stale state.

## Known Limitations / Deferred

- **Runway change diagnostics** not exported (needs prior-import snapshot in export bindings — deferred per plan)
- **No Excel styling** — consistent with existing Transactions Excel export
- **Summary/Diagnostics sheets** use multi-section layouts; `parseExcelWorkbook` in tests only partially round-trips them (Excel opens them correctly)
- **Detail-role metric contracts** not in KPI Audit (still P2 per `docs/TODOS.md`)
- **No Playwright e2e** for the new button (unit + binding tests only)

## Suggested Next Steps After Review

1. Land on `main` if review passes.
2. Mark P2 Accountant Workbook Export V1 complete in `docs/TODOS.md`.
3. Optional: add one Playwright export click test if you want e2e guardrails.
4. Next backlog lane per `docs/CODEX_HANDOFF_2026-06-14.md`: extend metric registry to detail-role metrics, or Dashboard Manifest export.

## Git State At Handoff

Working tree contains uncommitted Accountant Workbook implementation + docs. Prior session also had modified `docs/SESSION_HANDOFF_2026-06-14.md`, `docs/TODOS.md`, and `src/finance/__snapshots__/audit-derive.test.ts.snap`.

— Grok
