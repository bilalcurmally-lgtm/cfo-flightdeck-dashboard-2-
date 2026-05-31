# C2 — Focused Category Review (Design)

**Date:** 2026-05-31
**Phase:** C2 (Trust pass, non-blocking) — master plan `docs/designs/MASTER_PLAN_AUDITABLE_COCKPIT.md`
**Branch base:** `codex/a1-audit-model` (C1 shipped; tip `bc69d5f`)

## Goal

Let the user fix the classification of transactions that distort operating KPIs, and
re-derive the cockpit live. Exit criterion (from the master plan): *a misclassified
owner draw can be recategorized and KPIs re-derive.*

Non-blocking trust pass: KPIs always render; this is a correction surface, never a gate.

## Decisions (brainstorming, 2026-05-31)

1. **Recategorize = full recategorization**, not exclude-only. The user changes a
   transaction's classification and KPIs re-derive from the new values.
2. **Editable fields: Type + Group.** `Type` = `record.flow` (revenue/outflow);
   `Group` = `record.parent` (Income / Operating Costs / Delivery Costs / Internal /
   Financing). Category/subcategory text stays descriptive (does not affect KPI math).
3. **Group changes re-derive via an operating vs non-operating split.** `Internal` and
   `Financing` are non-operating. This is net-new KPI-engine logic — today the math keys
   off `flow` only and ignores `parent`.
4. **Detection = keyword + group union.** A row is flagged if it matches a curated
   high-distortion keyword list OR is already grouped Internal/Financing.
5. **Surface = separate "Category review" tile + drawer** (Approach B), distinct from
   C1's "Needs review". Chosen for discoverability — a separate flag draws attention
   immediately; a buried section did not.
6. **Non-operating money = dedicated "Non-operating" cockpit tile** (Option 1) with its
   own lineage drawer. Reported separately, never silently zeroed.
7. **In-session only.** Decisions live in memory for the session; durable persistence is
   Phase D, which will persist this same override map.

## Field mapping (grounding)

`TransactionRecord` (`src/finance/types.ts`) has no `group`/`type` field. The CSV columns
map as: **Type → `flow`**, **Category → `head`**, **Group → `parent`**,
**Subcategory → `subcategory`**. The override changes `flow` and `parent` only.

All KPIs currently key off `record.flow` (`summary.ts`, `cash-health.ts`,
`cockpit-kpis.ts`); `parent` is descriptive and never touches the math today.

## Architecture

### 1. Override layer — `src/finance/classification-overrides.ts`

- `ClassificationOverride = { flow?: CashFlow; parent?: string }`, keyed by transaction `id`.
- Held in-session in `main.ts` as a `Map<string, ClassificationOverride>`, beside
  `reviewExcludedItemIds`.
- `applyClassificationOverrides(records, overrides): TransactionRecord[]` returns a **new**
  array with `flow`/`parent` replaced; if `flow` flips, `signedNet` is recomputed so
  account balances stay correct.
- Pure and reversible: removing an entry = "Reset to original".

### 2. Operating vs non-operating split — KPI engine

- `NON_OPERATING_GROUPS = new Set(["Internal", "Financing"])` defined once and matched
  against `parent`.
- Extend `summarizeTransactions` (`summary.ts`) and `calculateCashHealth`
  (`cash-health.ts`) to compute revenue / outflow / net cash / avg burn / runway on
  **operating rows only**, in the same pass that emits lineage. `deriveAuditedCockpit`
  stays a thin reader (honors eng-review rule: no parallel KPI math).
- Add a `nonOperating` total and a `nonOperating` `MetricLineage` (financing-in,
  internal-out, itemized rows) to `FinanceSummary.lineage`.
- Operating KPI lineage `excluded[]` lists the rows pulled out of operating, with reason,
  so the lineage drawer footing stays explainable.

### 3. Detection — `src/ui/category-review-queue.ts` (sibling of `review-queue.ts`)

- `buildCategoryReviewItems({ records, overrides })` flags a row if **either**:
  - `parent ∈ NON_OPERATING_GROUPS`, **or**
  - `head` / `subcategory` / `counterparty` matches the keyword list (case-insensitive):
    `owner draw, draw, tax, refund, reimbursement, loan, investment, dividend, transfer`.
- Each item carries: current `flow`/`parent`, the matched reason, and whether the user has
  already acted (override present / confirmed).
- Conservative "review suggested" wording, consistent with C1.

### 4. UI

- Two new cockpit tiles (distinct from C1 "Needs review"):
  - **"Non-operating"** → opens its own lineage drawer (financing-in / internal-out).
  - **"⌗ N categories to review"** → opens the category-review drawer.
- `src/ui/category-review-drawer.ts`: each flagged row renders Type + Group `<select>`s,
  a **"Looks right"** confirm (dismiss without change), and a **"Reset"** when overridden.
- Reuses the existing slide-in panel + focus-trap (`dashboard-cockpit-actions.ts`).
  Recategorize / confirm updates the overrides map → `renderImportResult` re-renders and
  reopens the drawer with focus restored (the reopen/focus pattern shipped in `cbd910c`).
- Empty queue hides the category tile; zero non-operating hides that tile too.
- **Layout:** with C1's review tile plus these two, the cockpit reaches ~8 tiles. Plan a
  second "trust/audit" cluster row beneath the 5 core KPIs rather than one 8-wide strip.
  Final placement to be settled during implementation against `DESIGN.md`.
- Styling per `DESIGN.md`: coral review chips, flat audit surfaces for non-operating lineage,
  44px touch targets, aria-live on KPI re-derive.

### 5. Edge cases

- Override referencing a row absent from the current import → ignored (degrades like C1's
  filter-independent exclusion derivation).
- Flow flip recomputes `signedNet`.
- Overrides and C1 exclusions compose: a row may be both reclassified and excluded; the
  union of effects applies (excluded rows leave KPI math entirely).
- Reviewer/JSON export must use the overridden record set (mirror the C1 export fix).
- **C1/C2 overlap:** C1 surfaces auto-detected anomaly *pairs* (heuristic transfer/duplicate
  matching); C2 surfaces *single rows* by group/keyword. A transfer row may appear in both.
  This is acceptable — they answer different questions ("is this a real anomaly?" vs "is this
  classified right?") — but the two drawers must not double-count the same row in KPI math:
  C1 exclusion and a C2 override on the same `id` compose to a single net effect.

### 6. Testing (TDD)

- Override apply/reset, including `signedNet` recompute on flow flip.
- Operating vs non-operating partition golden files; runway/burn re-derive when a row moves
  to Internal/Financing.
- Detection union: keyword OR group; a misclassified owner-draw-in-Operating is flagged.
- Lineage footing: pulled rows appear in both operating `excluded[]` and `nonOperating`;
  totals foot.
- Action layer: recategorize sets override + re-renders; confirm dismisses; reset restores;
  drawer reopens with focus.
- **Exit-criterion test:** recategorize an owner draw → avg burn drops and runway rises.
- e2e: extend `e2e/lineage-drawer.spec.ts` to drive a recategorize and assert live re-derive.

## Out of scope (recorded)

- Durable persistence of overrides (Phase D).
- Editing category/subcategory text or amounts.
- Saved rules / auto-apply (Phase D3).
- Bulk recategorization across many rows at once.
