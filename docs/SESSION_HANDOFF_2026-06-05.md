# Session Handoff — 2026-06-05

## Summary
Executed **Phase C2 (Focused Category Review)** inline, end-to-end, from the
Codex-corrected plan. Users can now recategorize transactions (Type + Group) and
the cockpit re-derives live, with non-operating money reported in its own tile
instead of being silently zeroed.

## Git state
- Branch: `codex/a1-audit-model`
- Tip: `e24d511` (10 task commits + `29dc388` docs-correction commit on top of `ba15a99`)
- Working tree clean except untracked `mcps/` (pre-existing, unrelated).
- Not yet pushed / no PR opened.

## What changed
Plan: `docs/superpowers/plans/2026-05-31-c2-focused-category-review.md` (Codex-audited).
Architecture: **reuse the existing exclusion path** — a pure, reversible
in-session override `Map<id,{flow?,parent?}>` rewrites records before any math;
rows whose `parent ∈ {Internal, Financing}` (after overrides) leave **operating**
KPIs via the existing `withReviewExclusions`/`appendExclusions` lineage machinery.
Non-operating rows are reported, **not removed** — they stay in the export
(never added to `excludedTransactionIds`). Detection is suggestion-only.

New files:
- `src/finance/operating-groups.ts` — `NON_OPERATING_GROUPS`, `isOperating`
- `src/finance/classification-overrides.ts` (+test) — `applyClassificationOverrides`, shared `rec()` fixture
- `src/finance/non-operating.ts` (+test) — `summarizeNonOperating`
- `src/ui/category-review-queue.ts` (+test) — `buildCategoryReviewSummary` (keyword OR group)
- `src/ui/category-review-drawer.ts` (+test) — `renderCategoryReviewDrawer` (escaped string template)

Modified:
- `src/finance/dashboard-view.ts` (+test) — `overrides` input; `nonOperating` + `categoryReview` outputs; reason-tagged exclusions; non-op kept out of `excludedTransactionIds`.
- `src/ui/dashboard-cockpit.ts` — Non-operating + Category-review tiles, `data-kpi="runway"`, non-op drawer + category drawer templates loaded into the **shared** `[data-bw-lineage-active]` panel (mirrors the existing review-tile pattern; resolves the Task 8/9 separate-vs-shared-panel inconsistency toward the proven path).
- `src/ui/dashboard-results.ts` — threads `view.nonOperating` + `view.categoryReview.items` into the cockpit.
- `src/ui/dashboard-cockpit-actions.ts` — non-op/category triggers reusing `openTemplate` (close/Escape/focus-trap reused); `bindCategoryControls` for select/confirm/reset; `reopenCategoryItemId` focus restore.
- `src/main.ts` — `classificationOverrides` Map + `confirmedCategoryIds` Set (cleared on every import reset); `onRecategorize`/`onConfirmCategory`/`onResetCategory`; export now uses **overridden** records.
- `src/styles.css` — `.bw-cockpit--7/--8`, non-op tile + drawer styling (warm `--color-accent`, no plum token exists).
- `public/sample-agency.csv` — added an Owner-Draw operating outflow (the fixture the plan's exit criterion assumed but was missing).
- `e2e/lineage-drawer.spec.ts` — new "recategorizing a row to Internal re-derives runway live" test.
- `src/finance/__snapshots__/audit-derive.test.ts.snap` — agency snapshot updated for the new row (outflow 10800→14800, runway recalculated).

## Verification run
- `npx tsc --noEmit` → 0 errors.
- `npx vitest run` → **271 passed** (60 files).
- `npx playwright test e2e/lineage-drawer.spec.ts` → **6 passed** (desktop + mobile).
- `npm run build` → green.

## Decisions worth knowing
- Shared lineage panel + templates (not separate `[data-bw-nonop-panel]` asides) — the review tile already proves non-`AuditMetric` templates work there, and Task 9 explicitly wanted the shared body/close/Escape/focus-trap reused.
- Agency sample lacked any owner-draw operating row; added one so an operating outflow is keyword-flagged and recategorization can actually move runway. Only the agency audit-lineage snapshot changed.

## Next-session priorities
1. **Phase D** — persist the override map (and `confirmedCategoryIds`) across sessions (see plan Final-verification note). Currently in-session only; cleared on import reset.
2. Decide integration: open a PR for `codex/a1-audit-model` (C1 + C2) or continue stacking.
3. Optional polish: non-operating drawer visual QA in a real browser (DESIGN.md soft-widget check); confirm `--bw-cockpit--7/8` grid at mobile widths.
