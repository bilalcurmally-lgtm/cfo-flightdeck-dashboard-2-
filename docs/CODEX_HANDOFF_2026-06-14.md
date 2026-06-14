# Codex Handoff — 2026-06-14 (from Claude)

Hey Codex. I picked up your D2 S5 + D3 work, verified and committed it, then carried the
auditable-cockpit plan forward through the metric/readiness/diagnostics layers. Everything
below is **on `main`** now. Here's the state, what changed, and what's left for you.

## Current Git State

- **`main`** carries the whole arc. Two PRs merged today:
  - **PR #1** (`codex/a1-audit-model` → `main`, merge `f7caa94`): C1/C2 + D1 + D2 + D3 +
    metric registry + readiness/trust center + runway-change diagnostics.
  - **PR #2** (`codex/diagnostics-netcash` → `main`): net-cash contributors diagnostic.
- `mcps/` and `.claude/launch.json` are untracked and intentionally left alone.
- Verification at handoff: `tsc --noEmit` 0, `vitest run` 427 passed, `playwright
  --workers=1` 20 passed, `npm run build` green.
- Codex continuation after this handoff shipped burn contributors on `main` working tree:
  `vitest run` 435 passed, `playwright --workers=1` 22 passed, `npm run build` green.
- Codex continuation then shipped revenue concentration diagnostics/readiness:
  `vitest run` 444 passed, `playwright --workers=1` 24 passed, `npm run build` green.
- Codex continuation then shipped largest-transaction influence:
  `vitest run` 451 passed, `playwright --workers=1` 24 passed, `npm run build` green.
- Codex continuation then shipped filter/exclusion impact, completing the initial
  diagnostics family: `vitest run` 457 passed, `playwright --workers=1` 24 passed,
  `npm run build` green.

## What I Shipped This Session (all on `main`)

1. **Committed your uncommitted day** as two logical commits (D2 S5 import history browser;
   D3 saved-rules foundation). Shared `main.ts`/`styles.css` rode with D3 — a clean by-file
   split wasn't possible.
2. **Metric contracts registry** (`src/finance/metric-contract.ts`, `metric-registry.ts`):
   typed "what does this number mean" layer (decision question, formula, role, format,
   inputs, caveats, readiness). Wired into the per-KPI **lineage drawer** (decision question
   above the formula, "Good to know" caveats below).
3. **Readiness / Trust Center** (`src/finance/readiness.ts` + `src/ui/readiness-panel.ts`):
   pure `assessReadiness(input)` → `{ status, headline, signals }` (blocker→needs-review,
   caution→partial, info never downgrades, empty when no rows). Compact widget above the
   cockpit that opens a detail drawer. Wired through `CockpitExtras`.
4. **Local Metric Diagnostics** (`src/finance/metric-diagnostics.ts`):
   - `explainRunwayChange(prev, curr, formatters)` — decomposes a runway delta into
     cash-on-hand vs monthly-burn drivers (exact counterfactual split). Surfaced as a "why"
     line in the welcome-back strip. `ImportSnapshot.kpiSnapshot` now also captures
     `cashOnHand` + `averageMonthlyOutflow` (open Record, backward compatible).
   - `topNetCashContributors(records, opts)` — biggest inflows/outflows behind net cash.
     Rendered in the net-cash audit drawer via `src/ui/net-cash-contributors.ts`.
   - `topBurnContributors(records, opts)` — biggest outflow heads/subcategories behind
     average burn. Rendered in the average-burn audit drawer via
     `src/ui/burn-contributors.ts`.
   - `revenueConcentration(records, opts)` — top revenue head/counterparty and share of
     revenue. Rendered in the revenue audit drawer via `src/ui/revenue-concentration.ts`
     and wired into readiness at the 75% caution threshold.
   - `largestTransactionInfluence(records)` — single largest row, share of gross activity,
     and signed net-cash impact. Rendered in the net-cash audit drawer via
     `src/ui/largest-transaction-influence.ts`.
   - `filterExclusionImpact(before, after)` — how current review preset, non-operating
     exclusions, and review decisions changed revenue/outflow/net-cash/row count. Rendered
     in the net-cash audit drawer via `src/ui/filter-exclusion-impact.ts`.

## Conventions I Followed (please keep)

- **TDD**: every new function got a failing test first (RED→GREEN). Pure models in
  `src/finance/`, pure renderers in `src/ui/`, then thread through `CockpitExtras` →
  `dashboard-results.ts` → `dashboard-cockpit.ts`.
- **DESIGN.md**: reused existing `bw-*` classes / tokens; added `--color-olive` /
  `--color-coral` from the documented palette for readiness status accents.
- **Drawer pattern**: a new cockpit drawer = a `data-bw-X-trigger` button + a
  `<template data-bw-X-template>` + a binding in `dashboard-cockpit-actions.ts` (copy the
  non-operating/readiness path; the focus trap is shared).
- **Vault**: `docs/TODOS.md` is the live backlog; this + `SESSION_HANDOFF_2026-06-14.md`
  are the durable record.

## ⚠️ Tooling Note

The **Preview MCP broke this session** — it reported `viewport: 0` and the `screenshot`
tool hangs on this headless renderer. I verified visuals via **Playwright e2e** (real
Chromium, desktop + mobile) and live `eval` content checks instead. If you hit the same,
don't trust Preview screenshots; lean on Playwright at real viewports.

## What's Left (suggested order)

**Finish the diagnostics family** (`src/finance/metric-diagnostics.ts` is the home; each is a
pure model + a small drawer/section renderer, TDD'd):

The initial diagnostics family is complete. Future diagnostics should start from concrete
operator/accountant questions rather than adding generic panels.

**Then the next backlog tiers in `docs/TODOS.md`:**

- Extend the **metric registry** to detail-role metrics (top heads/subcategories, txn
  preview, raw row, import quality) + readiness wiring.
- **Accountant workbook export v1** (multi-sheet: KPI audit, ledger, exclusions, rejected).
- **Dashboard manifest export**, **chart specs**, **forecast/runway confidence**,
  **README/positioning refresh**, then P3 **budget-vs-actual** and **expected-income tagging**.

Numbers and contracts are now solid enough that the **accountant workbook export** is the
highest-leverage non-diagnostics move when you want to switch lanes.

— Claude
