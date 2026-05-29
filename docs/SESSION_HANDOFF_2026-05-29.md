# Dashboard Session Handoff - 2026-05-29

## Current State

- Branch: `main`. No code changed this session — planning only.
- This was a `/plan-ceo-review` (SCOPE EXPANSION) session plus a codex (gpt-5.5)
  outside-voice review and a grounded engineering architecture pass.
- Three planning docs were created/updated (see below). No `src/` changes; tests/build untouched.

## What Changed

New/updated docs:

- `docs/designs/AUDITABLE_COCKPIT_V2.md` (new) — strategy doc. The "why," the landscape
  research, scope decisions, and explicit out-of-scope calls.
- `docs/designs/MASTER_PLAN_AUDITABLE_COCKPIT.md` (new) — execution plan. Architecture lock
  (audit data model, re-derivation engine, persistent workspace) + phased, session-by-session
  build (Phases A–F, ~11 sessions) with test and review gates.
- `docs/TODOS.md` (new) — deferred work: Budget vs Actual (P1), expected-income forecast
  tagging (P2, forecast-input only, not invoicing).

## Key Decisions

- **Positioning flips** from "privacy-first" (now commoditized — 3+ free local CSV analyzers
  exist) to **"auditable cash truth + workflow trust."** Privacy becomes a supporting feature.
- **The moat is the workflow, not the popover** (codex correction): persistent local workspace
  (IndexedDB + exportable `*.billu.json`), import history, "what changed since last import,"
  saved classification rules, review queue. This is the retention layer and the answer to
  "make it truly usable." Owner chose the FULL workflow version.
- **Anomaly review is non-blocking** — KPIs render instantly with a "needs review" badge,
  preserving the 3-second runway moment. No gate before render.
- **Focused category review** for high-distortion categories only (transfers, owner draws,
  taxes, refunds, reimbursements, loan proceeds).
- **Build the model before the story** — audit data model + one auditable KPI first;
  positioning copy ships LAST, once provably true.
- **Out (owner decisions):** admin panel, invoice creation/sending, full receivables,
  multi-user/server. Boss's admin-panel/invoicing suggestions declined to keep focus
  ("be good at one thing"); Payoneer/Wise already own invoicing.

## Verification Already Run

- None (planning session, no code). Existing baseline from 2026-05-28 handoff: 212 tests pass,
  clean build.
- Codex review ran read-only and returned 18 findings; 8 folded in as refinements, 4 surfaced
  as decisions and resolved by the owner, the rest incorporated into the master plan.

## Eng Review Outcome (2026-05-29)

`/plan-eng-review` ran on the master plan. Verdict: CLEAR, 0 critical gaps. Two architecture
issues found and resolved (master plan §3.2 / §3.3 updated):

- **Issue 1 — math source of truth.** Do NOT re-implement KPI math in `audit-derive.ts`.
  Refactor the EXISTING `cockpit-kpis.ts` / `cash-health.ts` / `summary.ts` to emit lineage
  in the same pass; `deriveCockpit` becomes a thin reader. One source of truth, no drift.
- **Issue 2 — transaction identity.** The persistence fingerprint must use IMMUTABLE import
  fields only (dateISO + amount + rawDescription + account + sourceSheet) + an occurrence
  index. NOT category/counterparty (mutable → orphans decisions; collisions hit wrong rows).

Folded-in recommendations: `src/workspace/` behind a thin `workspaceStore` facade; IndexedDB
degrades to in-memory + warning; corrupted `.billu.json` rejected loudly; lineage drawer caps
row display (~50 + count). Four tests added (signature distinctness, signature stability,
IndexedDB degradation, corrupted-file rejection).

## Design Review Outcome (2026-05-29)

`/plan-design-review` ran on the UI phases (B/C/D), calibrated to `DESIGN.md`. Score 5/10 →
9/10. Two design forks decided; full state/responsive/a11y spec folded into master plan §3.6:

- **Lineage surface = right-side slide-in panel** (matches DESIGN.md's reserved utility rail;
  audit-surface styling, full-screen sheet on mobile, ARIA dialog + focus trap).
- **"What changed since last import" = calm welcome-back summary strip** on re-import
  (olive=improvement, coral=attention, dismissible).
- Folded in: interaction-state table (loading/empty/error/success per surface), token mapping
  (drawer/calc-tree/diff = flat audit surfaces; badge = coral chip not alert banner; toggles =
  tactile chips), responsive rules, and accessibility (load-bearing for a trust product:
  keyboard nav, aria-live on KPI re-derive, 44px targets, AA contrast).

All three plan reviews (CEO, Eng, Design) are CLEAR. Plan is ready to implement.

## First Next-Session Priorities

1. **Phase A1** (from the master plan): refactor `cockpit-kpis.ts` / `cash-health.ts` /
   `summary.ts` to emit `MetricLineage` in-pass + add `src/finance/audit.ts` types, capturing
   lineage for revenue (direct rows) and runway (calc tree with the `cashOnHand` assumption).
   Golden-file lineage tests + drawer-value-equals-cockpit-value test. No UI change. Existing
   212 tests must stay green.
2. Resolve the runway `cashOnHand` source ambiguity (running balance vs inferred vs
   user-entered) as an explicit labeled `Assumption` in A1.
3. Optionally run `/plan-design-review` before the Phase B/C/D UI work.

## Notes

- Two highest-risk abstractions to guard with extra adversarial review: `audit-derive.ts`
  (Phase A) and the persistence layer (Phase D).
- `DESIGN.md` remains required reading before any visual work (Phases B/C/D have UI).
- Review cadence: per session `/code-review` + `codex review`; per phase `/checkpoint`.
