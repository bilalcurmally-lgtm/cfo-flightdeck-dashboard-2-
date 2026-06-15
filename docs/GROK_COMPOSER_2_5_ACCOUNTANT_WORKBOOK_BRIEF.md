# Grok Composer 2.5 Brief - Accountant Workbook Export Plan

Use this brief as the prompt for Grok Composer 2.5. The assignment is intentionally
documentation-first: produce a rigorous plan that Codex can review and implement. Do not
ask Grok to make broad code changes across the dashboard unless explicitly instructed.

## Context

Repository: `cfo-flightdeck-dashboard-2-`

Product thesis: Billu.Works Finance Dashboard V2 is a local-first cash cockpit for small
operators. It should be safe to re-import every week, trust every KPI, explain changes
between imports, persist review decisions, and hand an accountant a traceable package.

Current state as of 2026-06-14:

- D2 import history browser is shipped.
- D3 saved rules and review carry-forward are shipped.
- Metric contracts registry is shipped for core cockpit metrics.
- Readiness / Trust Center is shipped.
- Local metric diagnostics are shipped:
  - runway-change explanation
  - net-cash contributors
  - burn contributors
  - revenue concentration
  - largest transaction influence
  - filter/exclusion impact
- Full verification has been green recently:
  - `npx tsc --noEmit`
  - `npx vitest run`
  - `npx playwright test --workers=1`
  - `npm run build`

The next highest-leverage task is Accountant Workbook Export V1.

## Data Analytics Plugin Lineage

This assignment should preserve the strongest ideas from the official Data Analytics
plugin study without copying its enterprise surface area.

Already absorbed into Billu.Works:

- `design-kpis` -> local metric contracts and KPI roles.
- `validate-data` / `analyze-data-quality` -> Readiness / Trust Center.
- `metric-diagnostics` -> deterministic local diagnostics for runway, net cash, burn,
  revenue concentration, largest transaction influence, and filter/exclusion impact.
- `user-context` -> local saved classification rules and persisted review decisions.

Still useful and not yet fully implemented:

- `kpi-reporting` -> accountant-ready KPI readout and operating handoff.
- `DashboardManifest` -> portable dashboard JSON export for future reports/layouts.
- `visualize-data` chart contracts -> chart specs before any chart-library migration.
- detail-role metric contracts -> Top Heads/Subcategories, Transaction Preview, Raw Row,
  and Import Quality.

For this Grok assignment, focus on the `kpi-reporting`, validation, and diagnostics pieces
as a concrete accountant workbook. Do not drift into enterprise connectors, React/Recharts
migration, notebooks, or MCP artifact widgets.

## Assignment

Create a plan document at:

`docs/GROK_ACCOUNTANT_WORKBOOK_EXPORT_PLAN.md`

The plan should be detailed enough that Codex can implement it with low ambiguity.

Do not implement the feature unless separately asked. This assignment is to study the
repo and produce a technical/product plan with acceptance criteria, sheet schemas, edge
cases, and tests.

## Files To Read First

Start with these documents:

- `docs/TODOS.md`
- `docs/CODEX_HANDOFF_2026-06-14.md`
- `docs/SESSION_HANDOFF_2026-06-14.md`
- `docs/data-analytics-plugin-study.md`
- `docs/FORMULAS.md`

Then inspect the current export and finance surfaces:

- `src/export/xlsx-workbook.ts`
- `src/export/transactions-workbook.ts`
- `src/export/transactions-workbook.test.ts`
- `src/export/dashboard-export-payloads.ts`
- `src/export/reviewer-report.ts`
- `src/ui/dashboard-export-actions.ts`
- `src/finance/types.ts`
- `src/finance/audit.ts`
- `src/finance/audit-derive.ts`
- `src/finance/dashboard-view.ts`
- `src/finance/summary.ts`
- `src/finance/metric-contract.ts`
- `src/finance/metric-registry.ts`
- `src/finance/metric-diagnostics.ts`
- `src/finance/readiness.ts`

Optional UI files if you need to understand how export buttons are rendered/wired:

- `src/ui/dashboard-cockpit.ts`
- `src/ui/dashboard-results.ts`
- `src/ui/dashboard-sections.ts`

## Product Goal

Design a multi-sheet `.xlsx` export that an accountant, bookkeeper, or owner can open and
understand without running the app.

The workbook should answer:

- What KPIs did the dashboard show?
- What formulas, assumptions, and caveats were used?
- Which normalized ledger rows support the numbers?
- Which rows were excluded, rejected, duplicated, transferred, non-operating, or still
  needing review?
- What review preset, filters, and local decisions changed the visible numbers?
- What data quality/readiness warnings should an accountant see before trusting the file?

## Proposed V1 Scope

Design Workbook V1 around these sheets. Rename or merge sheets only if the repo makes a
better shape obvious.

1. `Summary`
   - Generated timestamp.
   - Source filename.
   - Row counts.
   - Review preset / active filters if available.
   - Currency.
   - Cash-on-hand input if available.
   - Readiness status and headline.

2. `KPI Audit`
   - One row per core KPI.
   - Include label, value, format/unit, role, decision question, formula, inputs, caveats,
     readiness expectations, and audit trail where available.
   - Should lean on `metric-registry.ts` and existing audit/lineage data instead of
     duplicating definitions by hand.

3. `Normalized Ledger`
   - Included transaction rows after normalization and in-session classification overrides.
   - Preserve numbers as numeric cells where possible.
   - Include date, sheet, flow, account, head, parent, subcategory, description,
     counterparty, amount, signed net, running balance.
   - Consider additional review/classification fields if they already exist in the data
     model.

4. `Exclusions And Review`
   - Rows excluded from KPI calculations or needing human review.
   - Include reason/category where available: review decision, active preset, transfer,
     duplicate, non-operating, unresolved category review, unassigned head/counterparty.
   - Include enough original transaction context to reconcile back to the ledger.

5. `Rejected Rows`
   - Import rows that failed parsing/normalization, if available.
   - Include row number, sheet/source, raw values or summary fields, and rejection reason.
   - If the existing rejected-row model cannot safely expose all raw data, document the
     exact available fields and propose a V1-compatible sheet.

6. `Diagnostics`
   - Export the local metric diagnostics in table form:
     - net-cash contributors
     - burn contributors
     - revenue concentration
     - largest transaction influence
     - filter/exclusion impact
   - Include only diagnostics that can be generated from current local data without new
     dependencies.

## Non-Goals

- No server dependency.
- No cloud upload.
- No LLM runtime inside the app.
- No chart-library migration.
- No broad UI redesign.
- No speculative accounting advice.
- No invasive refactor of import parsing or finance models unless required for a clearly
  justified missing data field.

## Important Constraints

- Keep the dashboard local-first and privacy-preserving.
- Follow the existing architecture:
  - pure finance/export model code first
  - tests beside the code
  - UI wiring only after payload generation is stable
- Use the existing workbook helper in `src/export/xlsx-workbook.ts` unless there is a
  concrete reason it cannot support V1.
- Existing `makeWorkbookBlob` supports multiple sheets and numeric cells.
- Keep sheet names Excel-safe and reasonably short.
- Preserve current exports; Accountant Workbook should be additive.
- Do not touch `.claude/` or `mcps/`.

## What The Plan Must Include

In `docs/GROK_ACCOUNTANT_WORKBOOK_EXPORT_PLAN.md`, include these sections:

1. Current Export Surface
   - Summarize existing workbook/export code.
   - Identify the most natural new function names and file names.

2. Data Inventory
   - List each field needed for each sheet.
   - Map fields to existing functions/types/files.
   - Mark missing fields as one of:
     - available now
     - derivable now
     - requires small model addition
     - defer from V1

3. Workbook Sheet Schemas
   - For every sheet, provide exact column headers.
   - For each column, specify data type, source, and fallback behavior.

4. Export API Proposal
   - Propose TypeScript interfaces for the export input.
   - Propose pure builder functions and filenames.
   - Explain how it plugs into `dashboard-export-payloads.ts` and
     `dashboard-export-actions.ts`.

5. Test Plan
   - Unit tests for sheet rows and workbook descriptor.
   - Edge-case tests for empty data, rejected rows, filters, exclusions, missing
     cash-on-hand, no diagnostics, and weird characters in workbook cells.
   - UI binding tests for the export button if UI wiring is in V1.
   - State whether Playwright is required for this slice.

6. Acceptance Criteria
   - Concrete, checkable criteria for V1 completion.
   - Include commands expected to pass.

7. Risks And Tradeoffs
   - Call out anything likely to cause overreach.
   - Recommend what to defer.

8. Implementation Sequence
   - Small steps suitable for TDD.
   - Each step should be independently testable.

9. Data Analytics Plugin Concepts Preserved
   - Explicitly map workbook sheets to plugin ideas:
     - `Summary` -> validation/readiness and source context
     - `KPI Audit` -> metric contracts and KPI reporting
     - `Normalized Ledger` -> local semantic layer/source rows
     - `Exclusions And Review` -> data quality, caveats, and review workflow
     - `Rejected Rows` -> import quality
     - `Diagnostics` -> metric diagnostics
   - Identify which plugin ideas are intentionally deferred:
     - Dashboard Manifest export
     - chart contracts/specs
     - enterprise connectors
     - React/Recharts artifact app

10. Reviewer Notes For Codex
   - The top 5 things Codex should verify before implementing or accepting the plan.

## Preferred Implementation Shape

Assume Codex will implement something close to this unless your repo study proves a better
route:

- Add `src/export/accountant-workbook.ts`
- Add `src/export/accountant-workbook.test.ts`
- Add `buildAccountantWorkbookExport(...)` to `src/export/dashboard-export-payloads.ts`
- Add an export button binding in `src/ui/dashboard-export-actions.ts`
- Add or update UI tests for the new binding
- Keep all workbook row construction deterministic and easy to snapshot/assert

## Quality Bar

The final plan should be practical, not aspirational. Prefer a smaller V1 that can ship
cleanly over a grand workbook that requires new infrastructure. The best output is a plan
Codex can implement in one focused branch with clear tests and no architectural drama.
