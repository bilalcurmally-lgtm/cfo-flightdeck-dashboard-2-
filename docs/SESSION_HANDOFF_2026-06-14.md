# Session Handoff - 2026-06-14

## Summary

Studied the official OpenAI Data Analytics role-specific plugin template, folded the useful
ideas into the Billu.Works planning docs, completed D2 S5: the import history browser, and
started D3 with the saved-rules foundation slice.

## Git State

- Branch: `codex/a1-audit-model`.
- Changed this session:
  - `.gitignore`: added `.reference/` for local reference checkouts.
  - `docs/data-analytics-plugin-study.md`: new study note on the official Data Analytics
    plugin template.
  - `docs/TODOS.md`: replaced the old two-item deferred TODO with a unified backlog.
  - `src/ui/import-history-panel.ts`: new pure renderer for persisted import history.
  - `src/ui/import-history-panel.test.ts`: renderer coverage.
  - `src/ui/app-shell.ts`: History action and hidden panel container.
  - `src/main.ts`: History panel toggle/wiring.
  - `src/styles.css`: history panel styles and mobile behavior.
  - `e2e/import-history.spec.ts`: extended to cover strip plus history panel.
  - `src/finance/classification-rules.ts`: pure saved-rule engine.
  - `src/finance/classification-rules.test.ts`: rule-engine coverage.
  - `src/workspace/workspace-store.ts`: WorkspaceSnapshot v3 with rules.
  - `src/workspace/project-file.ts`: project-file v3 migration and rules validation.
  - `src/workspace/indexeddb-workspace-store.ts`: rules write-through persistence.
  - `src/ui/category-review-drawer.ts`: acted rows can save a reusable rule.
  - `src/ui/dashboard-cockpit-actions.ts`: save-rule click binding.
  - `src/ui/saved-rules-actions.ts`: saved-rule enable/disable/delete binding.
  - `src/ui/dashboard-sections.ts`: Local Settings saved-rules management surface.
  - `e2e/lineage-drawer.spec.ts`: recategorize -> Remember rule status coverage.
  - `e2e/lineage-drawer.spec.ts`: saved-rule disable/delete coverage.
  - `public/sample-owner-next.csv`: distinct import fixture for saved-rule auto-apply.
  - `e2e/lineage-drawer.spec.ts`: saved-rule applies to distinct matching import.
  - `src/finance/classification-rules.ts`: rule application now reports matched rows/rules.
  - `src/workspace/persistence-bridge.ts`: persisted category confirmations.
  - `src/ui/dashboard-results.ts`: compact saved-rules-applied signal.
  - `e2e/lineage-drawer.spec.ts`: confirmed category rows carry forward as handled.
  - `docs/SESSION_HANDOFF_2026-06-14.md`: this handoff.
- Untracked `mcps/` remains pre-existing and untouched.

## Reference Checkout

The official plugin templates were cloned locally to:

`.reference/role-specific-plugins`

The studied plugin lives at:

`.reference/role-specific-plugins/plugins/data-analytics`

This folder is intentionally ignored by Git.

## What Changed In Planning

`docs/TODOS.md` now reconciles:

- the latest D2 handoff state,
- `docs/designs/MASTER_PLAN_AUDITABLE_COCKPIT.md`,
- the original roadmap/deferred items,
- and the Data Analytics plugin study.

The updated order is:

1. Finish D2 import history browser.
2. Land or PR `codex/a1-audit-model`.
3. Build D3 saved rules and carried review queue.
4. Add analytics-inspired metric contracts, readiness/trust center, and local metric
   diagnostics.
5. Then proceed to accountant workbook export, dashboard manifests, chart specs, confidence,
   positioning, budget-vs-actual, and expected-income forecast tagging.

## D2 S5 Shipped

- Added a History button beside the existing project actions.
- History is enabled only once a dashboard import is active.
- Opening History renders persisted imports newest-first from `workspaceStore.snapshot().imports`.
- The panel shows source name, import date, transaction count, and runway snapshot.
- Identical re-import dedupe is preserved: the e2e uses same-ledger re-import for the welcome
  strip, then imports a distinct sample so the history panel lists two entries.

## D3 Foundation Shipped

- Added a pure classification-rule engine for "field contains text -> classification
  override" rules.
- Added WorkspaceSnapshot v3 with `rules: ClassificationRule[]`.
- Project files now migrate v1/v2 snapshots forward to v3 with `rules: []`.
- Project-file validation rejects unsupported rule fields and invalid override flows.
- IndexedDB-backed workspaces persist rules through the write-through store.
- Import activation applies saved rules first, then signature-specific category overrides
  win. This preserves the user's explicit row-level choices over broad reusable rules.
- Category review rows that have been recategorized now show `Remember rule`.
- Clicking `Remember rule` stores a reusable rule:
  - uses counterparty when it is present and not `Unassigned Counterparty`
  - falls back to description
  - stores the active classification override as the rule action
- Local Settings now lists saved rules.
- Rules can be enabled/disabled or deleted from Local Settings.
- Added a purpose-built fixture, `public/sample-owner-next.csv`, with the same `Owner`
  counterparty but different date, amount, and description.
- E2E now proves create rule -> clear -> import distinct matching file -> rule applies
  automatically. This confirms the rule engine is doing the work, not transaction-signature
  persistence.
- Rule matches now show a compact import-level signal with rows/rules applied.
- Saved-rule changes re-activate the current import so disabling/deleting rules updates the
  current classifications, not just Local Settings text.
- Rule-applied category rows no longer carry forward as unresolved category-review work.
- `Looks right` category confirmations persist by stable transaction signature.
- E2E now proves confirmed category rows stay out of future category-review queues on re-import.

## Verification

- `npx tsc --noEmit` -> 0
- `npx vitest run` -> 377 passed (73 files)
- `npx playwright test --workers=1` -> 16 passed
- `npm run build` -> green

## Continuation (Claude, same day)

Reviewed Codex's uncommitted day of work, verified it green, committed it, and took the
next slice (metric contracts registry).

- Verified the working tree: `tsc` 0, `vitest` 377, `build` green, `playwright` 16 — matched
  the handoff claims exactly.
- Committed Codex's blob as two logical commits (shared `main.ts`/`styles.css` rode with D3
  since a clean by-file split was impossible):
  - `8b1d6ac` feat(ui): import history browser panel [D2 S5]
  - `033bb7d` feat: D3 saved classification rules foundation
- Shipped P1 Metric Contracts Registry foundation (`793e447`):
  - `src/finance/metric-contract.ts` + `src/finance/metric-registry.ts` (+ tests).
  - Typed "what does this number mean" layer (decision question, formula, role, format,
    inputs, caveats, readiness) for the core cockpit metrics; ids align with
    `CockpitViewModel` / cash-health for later wiring.
  - 15 new tests; full suite now `tsc` 0, `vitest` 392 passing.
- `mcps/` left untouched (still untracked, pre-existing).

Then wired the registry into the cockpit UI (`56f25e9`): the per-KPI lineage drawer now
shows the contract's decision question above the formula and a "Good to know" caveats
section below the audit trail (`src/ui/lineage-drawer.ts`, reusing calm audit-surface
styling). Verified in-browser desktop + mobile via Preview MCP — computed tokens match
DESIGN.md, clean text wrap at 375px. Note: Preview `screenshot` tool hung (headless
renderer); used `eval` computed-style + bounding-box inspection instead, which is the
recommended path for precise style checks. Full suite: tsc 0, vitest 394, e2e 16/16, build.
Added `.claude/launch.json` (vite dev, port 5173) for Preview — left untracked.

Then shipped the **P1 Dashboard Readiness / Trust Center** in two slices:

- `b...` (readiness model): `src/finance/readiness.ts` — pure `assessReadiness(input)` folding
  all scattered trust signals into `{ status, headline, signals }` (blocker→needs-review,
  caution→partial, info never downgrades, empty when no rows). 9 tests.
- readiness widget (`src/ui/readiness-panel.ts`): compact trust widget above the cockpit +
  detail drawer, wired through `CockpitExtras` into the existing lineage-panel drawer infra
  (template + action trigger mirroring non-operating/category). `dashboard-results.ts` maps
  view signals → `ReadinessInput`; `main.ts` feeds `hasImportHistory`. Status accents per
  DESIGN.md (added `--color-olive` / `--color-coral`). Browser-verified desktop + mobile via
  Preview MCP `eval` (screenshot tool still hangs) — coral/accent/line severity borders all
  resolve to the right tokens; clean wrap at 375px.

Full suite after both: `tsc` 0, `vitest` 410, `playwright` 18/18, build green.

Then shipped the **P1 Local Metric Diagnostics** first explainer ("why did runway change?"):
`src/finance/metric-diagnostics.ts` — pure `explainRunwayChange(prev, curr, formatters)` that
decomposes a runway delta into cash-on-hand and monthly-burn drivers (exact counterfactual
split, dominant driver named). `ImportSnapshot.kpiSnapshot` now also captures `cashOnHand` +
`averageMonthlyOutflow` (open Record, backward compatible). The welcome-back strip renders a
"why" sub-line under the delta summary when drivers are available (legacy baselines degrade to
no line, so no duplication). Why-line layout browser-verified (sits under text, ink-soft); the
full cash/burn-driven scenario is unit-covered (live repro is blocked by capture-after-import
+ same-ledger dedupe). Full suite: `tsc` 0, `vitest` 418, `playwright` 18/18, build green.

Branch `codex/a1-audit-model` tip is now at the diagnostics commit. Still not pushed.

## Merged to main + next slice on a fresh branch

- Pushed `codex/a1-audit-model` and opened **PR #1** against `main`, then merged it (merge
  commit `f7caa94`). `main` now carries the full arc (C1/C2 → diagnostics). Local `main` in
  sync with `origin/main`.
- Started a new branch **`codex/diagnostics-netcash`** off `main` for the next diagnostics
  explainer: **net-cash contributors**. `topNetCashContributors(records)` (pure, in
  `metric-diagnostics.ts`) + `src/ui/net-cash-contributors.ts` renderer, wired through
  `CockpitExtras` into the netCash lineage drawer template. Shows "Biggest inflows / Biggest
  outflows" grouped by head. Full suite: `tsc` 0, `vitest` 427, `playwright` 20/20, build.
  Verified via real-browser e2e (desktop + mobile); the Preview MCP was stuck reporting
  `viewport: 0` this session so I relied on Playwright + a live content check rather than a
  screenshot. NOT yet pushed/PR'd.

## Next Session Priorities

1. Extend the metric registry to detail-role metrics and wire contracts into the cockpit UI
   (decision question + caveats on KPI hover/drilldown).
2. Build the Dashboard Readiness / Trust Center on top of the contracts (P1).
3. Tune the rule-learning copy now that the auto-apply and carry-forward behavior is proven.
4. Decide whether the compact "rules applied" signal needs a drilldown/audit drawer.
5. Consider opening the PR for `codex/a1-audit-model` (C1/C2 + D1 + D2 + D3 + metric registry).
6. Keep `mcps/` untouched unless the user explicitly asks to work on it.

## Codex Continuation - Burn Contributors

- Picked up from merged `main` tip `e55a2a4`.
- Shipped `topBurnContributors(records, opts)` in `src/finance/metric-diagnostics.ts`.
- Added `src/ui/burn-contributors.ts` renderer and wired it through `CockpitExtras` into
  the average-burn audit drawer.
- Added model, renderer, cockpit, and desktop/mobile e2e coverage for the burn drawer.
- Updated shared `.bw-contributors` styling to support amount + percent share rows.
- Full gate: `npx tsc --noEmit` 0, `npx vitest run` 435 passed, `npx playwright test
  --workers=1` 22 passed, `npm run build` green.
- Next diagnostics priority: revenue concentration by head/counterparty, including wiring
  `revenueConcentration` into readiness.

## Codex Continuation - Revenue Concentration

- Shipped `revenueConcentration(records, opts)` in `src/finance/metric-diagnostics.ts`.
- Added `src/ui/revenue-concentration.ts` renderer and wired it through `CockpitExtras` into
  the revenue audit drawer.
- Readiness now accepts `revenueConcentration` and emits a caution when the largest source
  reaches the existing 75% concentration threshold.
- Added model, renderer, readiness, cockpit, and desktop/mobile e2e coverage.
- Full gate: `npx tsc --noEmit` 0, `npx vitest run` 444 passed, `npx playwright test
  --workers=1` 24 passed, `npm run build` green.
- Next diagnostics priority: largest-transaction influence.

## Codex Continuation - Largest Transaction Influence

- Shipped `largestTransactionInfluence(records)` in `src/finance/metric-diagnostics.ts`.
- Added `src/ui/largest-transaction-influence.ts` renderer and wired it through
  `CockpitExtras` into the net-cash audit drawer.
- The drawer now shows the largest row, share of gross activity, and signed net-cash impact.
- Added model, renderer, cockpit, and desktop/mobile e2e coverage.
- Full gate: `npx tsc --noEmit` 0, `npx vitest run` 451 passed, `npx playwright test
  --workers=1` 24 passed, `npm run build` green.
- Next diagnostics priority: filter/exclusion impact summary.

## Codex Continuation - Filter/Exclusion Impact

- Shipped `filterExclusionImpact(before, after)` in `src/finance/metric-diagnostics.ts`.
- Added `src/ui/filter-exclusion-impact.ts` renderer and wired it through `CockpitExtras`
  into the net-cash audit drawer.
- The drawer now shows how the current review preset, non-operating exclusions, and review
  decisions changed revenue, outflow, net cash, and visible row count.
- Added model, renderer, cockpit, and desktop/mobile e2e coverage.
- Full gate: `npx tsc --noEmit` 0, `npx vitest run` 457 passed, `npx playwright test
  --workers=1` 24 passed, `npm run build` green.
- Initial local metric diagnostics family is complete.
