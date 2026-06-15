# Grok Composer 2.5 Brief - Backlog Batch After Manifest

Use this brief as the prompt for Grok Composer 2.5. The goal is to knock out several
remaining backlog slices quickly while keeping each slice reviewable by Codex.

## Current State

Repository: `cfo-flightdeck-dashboard-2-`

Branch: `main`

As of 2026-06-15:

- Import history browser is shipped.
- Saved classification rules and review carry-forward are shipped.
- Core metric contracts registry is shipped.
- Readiness / Trust Center is shipped.
- Local metric diagnostics are shipped.
- Accountant Workbook Export V1 is shipped and Codex-reviewed.
- Dashboard Manifest Export V1 + chart specs foundation is shipped and Codex-reviewed.

Known local noise to leave alone:

- `.claude/`
- `mcps/`
- `src/finance/__snapshots__/audit-derive.test.ts.snap` line-ending mark

## How To Work

Do these as separate slices. After each slice:

- Run targeted tests.
- Keep the diff small enough for Codex to review.
- Update `docs/TODOS.md`.
- Add a Codex review doc for the slice.

If you do more than one slice in the same session, keep the review docs separate and make
the final handoff very explicit about which slice changed which files.

Do not introduce server dependencies, cloud storage, LLM runtime, bank integrations, chart
library migration, or broad visual redesign.

## Files To Read First

- `docs/TODOS.md`
- `docs/SESSION_HANDOFF_2026-06-15.md`
- `docs/CODEX_REVIEW_DASHBOARD_MANIFEST_2026-06-15.md`
- `docs/CODEX_REVIEW_ACCOUNTANT_WORKBOOK_2026-06-15.md`
- `docs/data-analytics-plugin-study.md`
- `src/finance/metric-contract.ts`
- `src/finance/metric-registry.ts`
- `src/finance/readiness.ts`
- `src/finance/dashboard-view.ts`
- `src/finance/forecast.ts`
- `src/finance/summary.ts`
- `src/export/dashboard-manifest.ts`
- `src/export/accountant-workbook.ts`
- `src/ui/lineage-drawer.ts`
- `src/ui/readiness-panel.ts`
- `src/ui/dashboard-results.ts`

## Slice A - Detail-Role Metric Contracts

Priority: highest.

Goal: extend the metric registry beyond the core cockpit KPI cards so detail/reporting
surfaces have contracts too.

Add detail/guardrail contracts for:

- `topHeads`
- `topSubcategories`
- `transactionPreview`
- `rawRow`
- `importQuality`
- optionally `accountBalances` if it fits cleanly

Expected behavior:

- Contracts include id, label, role, decision question, formula/definition, format,
  required inputs, caveats, and readiness expectation.
- Existing core metric ids must remain stable.
- Registry tests should prove:
  - all ids are unique
  - new ids validate structurally
  - `getMetricsByRole("detail")` returns the new detail metrics
  - guardrail/detail role mapping is sensible
- If easy and low-risk, surface these contracts in exports:
  - Dashboard Manifest KPI/contracts section, or a separate `contracts`/`metricContracts`
    section if detail metrics do not have scalar values.
  - Accountant Workbook KPI Audit may include them with blank/non-scalar values only if
    that does not confuse the sheet.

Do not force non-scalar detail metrics into cockpit KPI cards. This is a semantic-layer
improvement, not a UI expansion.

Suggested files:

- `src/finance/metric-registry.ts`
- `src/finance/metric-registry.test.ts`
- `src/export/dashboard-manifest.ts`
- `src/export/dashboard-manifest.test.ts`
- maybe `src/export/accountant-workbook.ts`
- docs review handoff

Review doc:

`docs/CODEX_REVIEW_DETAIL_METRIC_CONTRACTS_2026-06-15.md`

Include:

- new metric ids and roles
- whether exports include them
- tests run
- risks/open questions

## Slice B - Forecast / Runway Confidence Mechanics

Priority: high, but do after Slice A if doing both.

Goal: compute and surface a mechanical confidence level for runway/forecast so users know
how much trust to put in the runway number.

Create a pure model, likely:

- `src/finance/runway-confidence.ts`
- `src/finance/runway-confidence.test.ts`

Suggested output:

```ts
type RunwayConfidenceLevel = "high" | "medium" | "low";

interface RunwayConfidenceReport {
  level: RunwayConfidenceLevel;
  score: number; // 0-100, deterministic
  headline: string;
  reasons: Array<{
    id: string;
    severity: "positive" | "caution" | "risk";
    label: string;
    detail: string;
  }>;
}
```

Suggested inputs:

- visible KPI records
- cash on hand
- forecast result
- readiness report or readiness inputs
- rejected row count
- unresolved category review count
- manual future event accepted/rejected counts

Suggested factors:

- data coverage months
- income volatility
- expense/outflow volatility
- missing or zero cash-on-hand
- unresolved review items
- rejected import rows
- dependence on manual future events
- revenue concentration, if already available from summary/readiness

Expected UI:

- Start small. Add a compact confidence line to the runway/forecast area or readiness drawer
  only if there is an obvious existing place.
- Avoid a new large panel unless the repo already has a matching pattern.
- If UI wiring is too big, ship the pure model and export/manifest wiring first, then note
  UI as deferred.

Expected export integration:

- Dashboard Manifest should include runway confidence in context/caveats/diagnostics if
  implemented.
- Accountant Workbook Summary or KPI Audit can include the confidence headline if clean.

Tests:

- high confidence for enough clean history, cash on hand, low volatility, no review debt
- medium confidence for partial coverage or moderate volatility
- low confidence for missing cash, little history, high review debt, or high volatility
- deterministic score boundaries

Review doc:

`docs/CODEX_REVIEW_RUNWAY_CONFIDENCE_2026-06-15.md`

Include:

- scoring model
- thresholds
- examples
- UI/export wiring
- tests run
- limitations

## Slice C - README / Positioning Refresh

Priority: medium, low risk, good filler if code slices are done.

Goal: update docs/copy now that the product genuinely has the trust workflow.

Refresh the README and/or high-level docs to lead with:

- auditable cash truth
- repeat re-import workflow
- local-first privacy
- KPI lineage and readiness
- accountant workbook export
- dashboard manifest export
- saved rules and review carry-forward

Do not oversell AI. AI is not the hero workflow.

Suggested files:

- `README.md`
- `docs/TODOS.md`
- optional `docs/BILLU_WORKS_V2_ROADMAP.md` if it is clearly stale

Review doc:

`docs/CODEX_REVIEW_POSITIONING_REFRESH_2026-06-15.md`

Include:

- changed docs
- old vs new positioning
- claims that rely on shipped behavior
- anything intentionally not claimed

## Slice D - Tiny Saved-Rules UX Polish

Priority: optional.

Only do this if the first slices are done and there is time.

Backlog decisions:

- Decide whether `Remember rule` should become `Remember for future imports`.
- Decide whether rule-applied rows need a drilldown/audit drawer beyond the compact signal
  and Local Settings controls.

Suggested implementation:

- Prefer copy-only change from `Remember rule` to `Remember for future imports` if tests can
  be updated cleanly.
- Do not build a new drawer unless there is a strong, small existing drawer pattern to reuse
  and the UX is clearly better.

Review doc:

`docs/CODEX_REVIEW_SAVED_RULES_POLISH_2026-06-15.md`

## Verification Expectations

For any code slice, run:

- `npx tsc --noEmit`
- targeted `npx vitest run ...`
- `npx vitest run`
- `npm run build`

Run Playwright if UI behavior changed:

- `npx playwright test --workers=1`

Always run:

- `git diff --check`

## Final Handoff To Codex

At the end, provide:

- what slices were completed
- files changed per slice
- verification results
- known limitations
- whether Codex should land one combined commit or split commits
- what remains next in `docs/TODOS.md`

Do not stage or commit unless explicitly asked. Codex will review, test, and land.
