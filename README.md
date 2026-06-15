# Billu.Works Finance Dashboard V2

A local-first cash cockpit for freelancers, consultants, solo founders, and small operators.
Import a ledger, trust the numbers, re-import every week, and hand an accountant a traceable
package — without uploading transaction data to a server.

## What It Does Today

- **Auditable cash truth** — Cockpit KPIs show lineage: every number explains how it was computed and which rows fed it.
- **Repeat re-import workflow** — Import history, welcome-back deltas, and signature-based review carry-forward survive reloads and re-imports.
- **Local-first privacy** — CSV/Excel parsing, classification, KPI math, and exports run in the browser by default. No account required.
- **Readiness / Trust Center** — A compact readiness widget folds rejected rows, duplicates, transfers, category review, and concentration into one answer: can I trust this dashboard right now?
- **Saved classification rules** — Recategorize once, remember for future imports, and auto-apply rules on the next ledger upload.
- **Accountant Workbook export** — Six-sheet `.xlsx` with summary, KPI audit, normalized ledger, exclusions, rejected rows, and diagnostics.
- **Dashboard Manifest export** — Structured `.json` describing KPIs, chart specs, table specs, readiness, and diagnostic summaries for testing and future reporting.
- **Local metric diagnostics** — Deterministic explainers for net-cash contributors, burn drivers, revenue concentration, largest-transaction influence, and filter/exclusion impact.

AI is not the hero workflow. The product leads with formulas, review decisions, and exports you can inspect.

## Core Workflow

1. Import CSV or Excel locally and map columns.
2. Review duplicates, transfers, non-operating rows, and category suggestions.
3. Set cash on hand and scan cockpit KPIs with lineage drawers.
4. Check readiness and runway confidence before making decisions.
5. Export a workbook or manifest for accountant handoff or regression testing.
6. Re-import next week — saved rules and confirmed review decisions carry forward.

## Tech Notes

- TypeScript + Vite, Vitest unit tests, Playwright e2e.
- Workspace persistence via IndexedDB and optional `.billu.json` project files.
- See `docs/TODOS.md` for the live backlog and `docs/BILLU_WORKS_V2_ROADMAP.md` for phase history.

## Relationship To V1

V1 lives in `cfo-flightdeck-dashboard` and remains the stable deployment path. V2 borrows proven parsing, runway, forecast, and export patterns from V1 while building the auditable cockpit, trust workflow, and portable exports described above.

## Development

```bash
npm install
npm run dev
npx vitest run
npx playwright test --workers=1
npm run build
```