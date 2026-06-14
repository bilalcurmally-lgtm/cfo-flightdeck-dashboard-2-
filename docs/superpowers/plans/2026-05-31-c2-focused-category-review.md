# C2 — Focused Category Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Let the user recategorize transactions that distort operating KPIs (Type + Group) and re-derive the cockpit live, with non-operating money reported in its own tile — never silently zeroed.

**Architecture (decided 2026-05-31 — "reuse exclusion path"):** A pure, reversible in-session override layer (`Map<id,{flow?,parent?}>`) rewrites records before any math. Rows whose `parent ∈ {Internal, Financing}` (AFTER overrides) are pulled out of **operating** KPIs through the **existing** `withReviewExclusions`/`appendExclusions` lineage machinery in `dashboard-view.ts` — no parallel KPI math, honoring the eng rule "deriveAuditedCockpit stays a thin reader." A separate non-operating total feeds a dedicated tile. Non-operating rows are **reported, not removed**: they stay in the reviewer/JSON export (they are NOT added to `excludedTransactionIds`). A keyword-OR-group detection queue surfaces *suggestions* in a new drawer (reusing the C1 slide-in/focus-trap); detection never changes math — only a confirmed recategorization does.

**Tech Stack:** TypeScript (strict), Vitest, Playwright. No new runtime deps.

**Design source:** `docs/superpowers/specs/2026-05-31-c2-focused-category-review-design.md` (the spec is directionally right but wrong on two mechanics — see Grounding; this plan supersedes it).

---

## Claude handoff — read this before coding

Codex audited the C2 docs against actual source at `ba15a99` and corrected the executable plan. Treat this file as the source of truth. Treat `docs/superpowers/specs/2026-05-31-c2-focused-category-review-design.md` as concept/background only; it now has a superseded warning because its mechanics still mention stale APIs.

Important corrected edges:
- UI entry is `renderCockpitStrip(...)`, not `renderDashboardCockpit(...)`.
- Results prop type is `DashboardResultsRenderInput`, not `DashboardResultsViewModel`.
- There is no `CockpitViewModelInput` type and no reusable `trapFocus` helper.
- Category drawer should return escaped HTML strings for templates, like C1's `renderReviewDrawer(...)`; bind events in `dashboard-cockpit-actions.ts`.
- Current value class is `.bw-kpi__value`; do not write e2e against a nonexistent `.kpi-value` class.
- Reviewer JSON must receive overridden records, not just original records filtered by `excludedTransactionIds`.

---

## Grounding — VERIFIED by Codex audit at tip `ba15a99`

> Two earlier plan commits (`6e28025`, `a14a2d0`) were written from assumptions and are WRONG. This version is read from source. Do not trust the earlier diffs.

**Data model (`src/finance/types.ts`):**
- `CashFlow = "revenue" | "outflow"`. The inflow value is `"revenue"`, NOT `"inflow"`.
- `TransactionRecord`: `{ id; date: Date; dateISO: string; periodDaily; periodWeekly; periodMonthly: string; sourceSheet?; head; parent; subcategory; description; counterparty; account; flow: CashFlow; amount: number; signedNet: number; runningBalance: number|null }`. Positive magnitude = **`amount`** (no `grossAmount`). `signedNet` = `+amount` (revenue) / `-amount` (outflow). No `currency`/`raw`/`sourceRow`.

**`FinanceSummary` (`src/finance/summary.ts`) is FLAT** — there is **no** `summary.totals`:
`{ revenue; outflow; netCash; transactionCount; periodTrend; topHeads; topSubcategories; accountBalances; diagnostics; warnings; cashHealth: CashHealth; lineage: { revenue; outflow; netCash } }`. `cashHealth` is **nested inside** the summary.
- `summarizeTransactions(records, rejectedRows = [], cashOnHand = 0, trendGrain = "monthly")` — 4 positional args; builds `cashHealth` internally via `calculateCashHealth(records, cashOnHand)`.

**`CashHealth` (`src/finance/cash-health.ts`):** `{ averageMonthlyOutflow; runwayMonths: number|null; largestTransaction; revenueConcentration; lineage: { averageMonthlyOutflow; runwayMonths } }`.
- **Runway = `cashOnHand / averageMonthlyOutflow`** (user-entered cash). NOT netCash/burn.
- Only `flow === "outflow"` rows feed `monthlyOutflows` → `averageMonthlyOutflow`.
- **Exit criterion holds:** recategorizing an owner-draw out of operating outflow lowers `averageMonthlyOutflow` ⇒ runway rises. That is the ONLY way recategorize moves runway.

**`MetricLineage` (`src/finance/audit.ts`):** `{ metric: AuditMetric; value: number|null; formulaText; plainEnglish; direct: RowRef[]; derived?: CalcNode; assumptions: Assumption[]; excluded: ExclusionRef[] }`.
- `excluded` ALREADY EXISTS. `ExclusionRef = { id; reason; confidence: "high"|"medium"|"low" }`.
- `AuditMetric` is a **closed union**: `"revenue"|"outflow"|"netCash"|"averageMonthlyOutflow"|"runwayMonths"`. **Do NOT add a new member** — the non-operating tile uses its own lightweight type, not an AuditMetric lineage.
- `RowRef = { id; dateISO; amount; head; flow }`.

**`dashboard-view.ts` — the integration seam (READ IT before Task 6):**
- `buildDashboardView(input)` where `input = { result: CsvImportResult; filters; trendGrain; reviewPreset; selectedTransactionId; cashOnHand; futureEventsText; deriveExcludedTransactionIds?: (reviewSummary: FinanceSummary) => readonly string[] }`.
- Output `DashboardViewData = { baseFilteredRecords; baseSummary; reviewSummary; excludedTransactionIds?; filteredRecords; summary; selectedTransactionId; selectedRecord; futureEventsText; forecast }`.
- Flow today: `filterTransactions(result.records, filters)` → `reviewSummary` → `excludedIds = Set(deriveExcludedTransactionIds(reviewSummary))` → `baseFilteredRecords = reviewFiltered.filter(!excludedIds)` → `applyReviewPreset` → `summary = withReviewExclusions(summarize(filteredRecords,…), reviewFiltered.filter(excludedIds))`.
- `withReviewExclusions(summary, excludedRecords)` + `appendExclusions(lineage, exclusions)` + `toReviewExclusion(record)` are **private in this file** (lines ~84–133). `toReviewExclusion` hardcodes `reason: "excluded in review drawer"`.

**`main.ts` — re-render path (READ lines 207–263; mirror exactly for C2):**
- Module-level `const reviewExcludedItemIds = new Set<string>()` (line 59), cleared on import reset.
- `renderImportResult(result, sourceName, options: { reopenReviewItemId?: string } = {})` (line 207) is the single re-render entry. It calls `buildDashboardView({...})` passing a `deriveExcludedTransactionIds` callback that wraps `deriveExcludedTransactionIdsFromQueue({summary, rejectedRows, excludedReviewItemIds: reviewExcludedItemIds, formatMoney})`.
- It then `renderDashboardResults({...})` and `bindDashboardCockpitActions({ reopenReviewItemId, onReviewDecision })`. `onReviewDecision` mutates `reviewExcludedItemIds` and calls `renderImportResult(result, sourceName, { reopenReviewItemId: decision.itemId })`.
- `bindExportButton(view.summary, view.filteredRecords, reviewedImportResult(result, excludedTransactionIds))` — export removal uses `excludedTransactionIds` ONLY. **Non-operating rows must NOT enter `excludedTransactionIds`** so they stay in the export.

**UI render (READ before Tasks 7–8):**
- `renderCockpitStrip(viewModel, formatters, reviewItems)` in `src/ui/dashboard-cockpit.ts` builds KPI tiles and the shared lineage `<aside data-bw-lineage-panel>`.
- `renderLineagePanel(...)` is private in `dashboard-cockpit.ts`; extend it in-place to add category/non-operating templates or adjacent template markup. Do not call it from outside the file.
- Current KPI openers are `[data-bw-lineage-trigger]`; the review opener is `[data-bw-review-trigger]`; close is `[data-bw-lineage-close]`; the panel is `[data-bw-lineage-panel]`; the active body is `[data-bw-lineage-active]`.
- `bindDashboardCockpitActions(options)` (`src/ui/dashboard-cockpit-actions.ts`) owns the open/close/reopen logic and contains an inline Tab focus trap. There is **no** reusable `trapFocus` function today.
- `renderDashboardResults(input: DashboardResultsRenderInput)` (`src/ui/dashboard-results.ts`) composes the page; `DashboardResultsRenderInput` is the prop bag passed from `main.ts`.
- `review-drawer.ts` `renderReviewDrawer(...)` returns an escaped HTML string for insertion into a `<template>`. Imitate that string-rendering pattern for the category drawer; bind its events in `dashboard-cockpit-actions.ts`, not inside the render function.

**Conventions:** integer minor units. `npx tsc --noEmit` before every commit; never commit a type error. Bash tool: multiline commit bodies via `git commit -F file`, never PowerShell heredoc.

---

## File Structure

**Create:** `src/finance/operating-groups.ts`; `src/finance/classification-overrides.ts` (+test); `src/finance/non-operating.ts` (+test); `src/ui/category-review-queue.ts` (+test); `src/ui/category-review-drawer.ts` (+test).
**Modify:** `src/finance/dashboard-view.ts` (overrides + non-op exclusion + outputs); `src/ui/dashboard-cockpit.ts` (non-op + category tiles, category drawer markup); `src/ui/dashboard-cockpit-actions.ts` (category drawer open/close/reopen); `src/ui/dashboard-results.ts` + `src/main.ts` (thread overrides, wire actions); `e2e/lineage-drawer.spec.ts`.

---

## Task 1 — Operating-group taxonomy

**Create `src/finance/operating-groups.ts`:**

- [ ] **Step 1: Implement**
```typescript
// src/finance/operating-groups.ts
/** Canonical non-operating groups, matched case-insensitively against record.parent. */
export const NON_OPERATING_GROUPS = new Set(["internal", "financing"]);

export function isOperating(record: { parent: string }): boolean {
  return !NON_OPERATING_GROUPS.has((record.parent ?? "").trim().toLowerCase());
}
```
- [ ] **Step 2:** `npx tsc --noEmit` → exit 0.
- [ ] **Step 3:** commit `feat(finance): operating/non-operating group taxonomy (C2)`.

---

## Task 2 — Classification override layer

**Create `src/finance/classification-overrides.ts` + test.** The `rec()` fixture below matches the REAL `TransactionRecord`; export it and reuse it across the plan.

- [ ] **Step 1: Failing test** `src/finance/classification-overrides.test.ts`
```typescript
import { describe, it, expect } from "vitest";
import { applyClassificationOverrides } from "./classification-overrides";
import type { TransactionRecord } from "./types";

export function rec(over: Partial<TransactionRecord>): TransactionRecord {
  return {
    id: "t1", date: new Date("2026-01-01T00:00:00Z"), dateISO: "2026-01-01",
    periodDaily: "2026-01-01", periodWeekly: "2026-W01", periodMonthly: "2026-01",
    head: "Misc", parent: "Operating Costs", subcategory: "", description: "d",
    counterparty: "c", account: "main", flow: "outflow", amount: 5000,
    signedNet: -5000, runningBalance: null, ...over,
  };
}

describe("applyClassificationOverrides", () => {
  it("returns a new array, originals untouched", () => {
    const records = [rec({ id: "a" })];
    const out = applyClassificationOverrides(records, new Map());
    expect(out).not.toBe(records);
    expect(out[0]).toEqual(records[0]);
  });
  it("overrides parent only", () => {
    const out = applyClassificationOverrides([rec({ id: "a" })], new Map([["a", { parent: "Financing" }]]));
    expect(out[0].parent).toBe("Financing");
    expect(out[0].flow).toBe("outflow");
    expect(out[0].signedNet).toBe(-5000);
  });
  it("recomputes signedNet on outflow->revenue flip", () => {
    const out = applyClassificationOverrides([rec({ id: "a", flow: "outflow", amount: 5000, signedNet: -5000 })], new Map([["a", { flow: "revenue" }]]));
    expect(out[0].signedNet).toBe(5000);
  });
  it("recomputes signedNet on revenue->outflow flip", () => {
    const out = applyClassificationOverrides([rec({ id: "a", flow: "revenue", amount: 5000, signedNet: 5000 })], new Map([["a", { flow: "outflow" }]]));
    expect(out[0].signedNet).toBe(-5000);
  });
  it("ignores absent ids", () => {
    const out = applyClassificationOverrides([rec({ id: "a" })], new Map([["ghost", { flow: "revenue" }]]));
    expect(out[0]).toEqual(rec({ id: "a" }));
  });
});
```
- [ ] **Step 2:** run → FAIL (module not found).
- [ ] **Step 3: Implement** `src/finance/classification-overrides.ts`
```typescript
import type { CashFlow, TransactionRecord } from "./types";

export interface ClassificationOverride { flow?: CashFlow; parent?: string; }

/** New array with flow/parent replaced; signedNet recomputed from `amount` on flow flip
 *  (revenue=+amount, outflow=-amount). Pure & reversible (drop entry = restore). */
export function applyClassificationOverrides(
  records: TransactionRecord[],
  overrides: Map<string, ClassificationOverride>,
): TransactionRecord[] {
  if (overrides.size === 0) return records.map((r) => ({ ...r }));
  return records.map((record) => {
    const o = overrides.get(record.id);
    if (!o) return { ...record };
    const next: TransactionRecord = { ...record };
    if (o.parent !== undefined) next.parent = o.parent;
    if (o.flow !== undefined && o.flow !== record.flow) {
      next.flow = o.flow;
      next.signedNet = o.flow === "revenue" ? record.amount : -record.amount;
    }
    return next;
  });
}
```
- [ ] **Step 4:** run → PASS (5).
- [ ] **Step 5:** commit `feat(finance): in-session classification override layer (C2)`.

---

## Task 3 — Category-review detection queue (suggestions only)

**Create `src/ui/category-review-queue.ts` + test.** Detection = keyword OR group (suggestion surface for the drawer). It NEVER changes KPIs.

- [ ] **Step 1: Failing test** `src/ui/category-review-queue.test.ts`
```typescript
import { describe, it, expect } from "vitest";
import { buildCategoryReviewSummary } from "./category-review-queue";
import { rec } from "../finance/classification-overrides.test";

describe("buildCategoryReviewSummary", () => {
  it("flags by non-operating group", () => {
    const s = buildCategoryReviewSummary({ records: [rec({ id: "a", parent: "Financing" })], overrides: new Map() });
    expect(s.items.map((i) => i.id)).toEqual(["a"]);
    expect(s.items[0].reasons).toContain("non-operating-group");
  });
  it("flags owner-draw still in Operating by keyword", () => {
    const s = buildCategoryReviewSummary({ records: [rec({ id: "a", head: "Owner Draw" })], overrides: new Map() });
    expect(s.items[0].reasons).toContain("keyword");
  });
  it("does not flag an ordinary cost", () => {
    const s = buildCategoryReviewSummary({ records: [rec({ id: "a", head: "Rent", counterparty: "Landlord", subcategory: "" })], overrides: new Map() });
    expect(s.items).toEqual([]);
  });
  it("marks acted when an override exists", () => {
    const s = buildCategoryReviewSummary({ records: [rec({ id: "a", parent: "Financing" })], overrides: new Map([["a", { parent: "Income" }]]) });
    expect(s.items[0].acted).toBe(true);
  });
});
```
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: Implement**
```typescript
// src/ui/category-review-queue.ts
import type { CashFlow, TransactionRecord } from "../finance/types";
import type { ClassificationOverride } from "../finance/classification-overrides";
import { NON_OPERATING_GROUPS } from "../finance/operating-groups";

export type CategoryReviewReason = "non-operating-group" | "keyword";
const KEYWORDS = ["owner draw","draw","tax","refund","reimbursement","loan","investment","dividend","transfer"];

export interface CategoryReviewItem {
  id: string; flow: CashFlow; parent: string; head: string; label: string;
  reasons: CategoryReviewReason[]; acted: boolean; record: TransactionRecord;
}
export interface CategoryReviewSummary { items: CategoryReviewItem[]; }
export interface BuildCategoryReviewOptions {
  records: TransactionRecord[]; overrides: Map<string, ClassificationOverride>;
}

function matchesKeyword(r: TransactionRecord): boolean {
  const h = `${r.head} ${r.subcategory} ${r.counterparty}`.toLowerCase();
  return KEYWORDS.some((kw) => h.includes(kw));
}

export function buildCategoryReviewSummary(o: BuildCategoryReviewOptions): CategoryReviewSummary {
  const items: CategoryReviewItem[] = [];
  for (const r of o.records) {
    const reasons: CategoryReviewReason[] = [];
    if (NON_OPERATING_GROUPS.has((r.parent ?? "").trim().toLowerCase())) reasons.push("non-operating-group");
    if (matchesKeyword(r)) reasons.push("keyword");
    if (reasons.length === 0) continue;
    items.push({
      id: r.id, flow: r.flow, parent: r.parent, head: r.head,
      label: `${r.description} — ${r.head || "Uncategorized"}`,
      reasons, acted: o.overrides.has(r.id), record: r,
    });
  }
  return { items };
}
```
- [ ] **Step 4:** run → PASS (4).
- [ ] **Step 5:** commit `feat(ui): category-review detection queue (keyword OR group) (C2)`.

---

## Task 4 — Non-operating summary helper

**Create `src/finance/non-operating.ts` + test.** Pure: total + breakdown + RowRefs for the tile/drawer. Does NOT use the closed `AuditMetric` union.

- [ ] **Step 1: Failing test** `src/finance/non-operating.test.ts`
```typescript
import { describe, it, expect } from "vitest";
import { summarizeNonOperating } from "./non-operating";
import { rec } from "./classification-overrides.test";

describe("summarizeNonOperating", () => {
  it("totals signedNet and splits in/out", () => {
    const s = summarizeNonOperating([
      rec({ id: "fin", flow: "revenue", parent: "Financing", amount: 5000, signedNet: 5000 }),
      rec({ id: "int", flow: "outflow", parent: "Internal", amount: 2000, signedNet: -2000 }),
    ]);
    expect(s.total).toBe(3000);
    expect(s.revenueIn).toBe(5000);
    expect(s.outflowOut).toBe(2000);
    expect(s.rows.map((r) => r.id)).toEqual(["fin", "int"]);
  });
  it("is empty for no rows", () => {
    const s = summarizeNonOperating([]);
    expect(s).toEqual({ total: 0, revenueIn: 0, outflowOut: 0, rows: [] });
  });
});
```
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: Implement**
```typescript
// src/finance/non-operating.ts
import type { RowRef } from "./audit";
import type { TransactionRecord } from "./types";

export interface NonOperatingSummary {
  total: number;       // signed sum
  revenueIn: number;   // sum amount of revenue rows
  outflowOut: number;  // sum amount of outflow rows
  rows: RowRef[];
}

export function summarizeNonOperating(records: TransactionRecord[]): NonOperatingSummary {
  let total = 0, revenueIn = 0, outflowOut = 0;
  const rows: RowRef[] = [];
  for (const r of records) {
    total += r.signedNet;
    if (r.flow === "revenue") revenueIn += r.amount; else outflowOut += r.amount;
    rows.push({ id: r.id, dateISO: r.dateISO, amount: r.amount, head: r.head, flow: r.flow });
  }
  return { total, revenueIn, outflowOut, rows };
}
```
- [ ] **Step 4:** run → PASS (2).
- [ ] **Step 5:** commit `feat(finance): non-operating summary helper (C2)`.

---

## Task 5 — Tag operating-exclusion reasons in `withReviewExclusions`

**Modify `src/finance/dashboard-view.ts`** so excluded rows carry their real reason (review vs non-operating) in lineage `excluded[]`.

- [ ] **Step 1:** Change `toReviewExclusion(record)` to take a reason:
```typescript
function toReviewExclusion(record: TransactionRecord, reason: string): ExclusionRef {
  return { id: record.id, reason, confidence: "medium" };
}
```
- [ ] **Step 2:** Change `withReviewExclusions(summary, excludedRecords)` to accept a classifier and map each record to its reason. Replace the three `.map(toReviewExclusion)` calls:
```typescript
function withReviewExclusions(
  summary: FinanceSummary,
  excludedRecords: readonly TransactionRecord[],
  isNonOperating: (record: TransactionRecord) => boolean,
): FinanceSummary {
  if (excludedRecords.length === 0) return summary;
  const reasonFor = (r: TransactionRecord) =>
    isNonOperating(r) ? "non-operating (Internal/Financing)" : "excluded in review drawer";
  const toExcl = (r: TransactionRecord) => toReviewExclusion(r, reasonFor(r));
  const revenueExclusions = excludedRecords.filter((r) => r.flow === "revenue").map(toExcl);
  const outflowExclusions = excludedRecords.filter((r) => r.flow === "outflow").map(toExcl);
  const allExclusions = excludedRecords.map(toExcl);
  // ... rest unchanged (appendExclusions calls)
}
```
- [ ] **Step 3:** `npx tsc --noEmit` (callers updated in Task 6). Commit happens with Task 6.

---

## Task 6 — Thread overrides + non-operating into `buildDashboardView`

**Modify `src/finance/dashboard-view.ts`** + test. This is the core integration. Non-op rows leave OPERATING KPIs but do NOT enter `excludedTransactionIds` (export).

- [ ] **Step 1: Failing test** `src/finance/dashboard-view.test.ts` (add). Reuse the existing local `importResult(records)` helper and import `DEFAULT_FILTERS` from `./filters`. `rec` comes from the overrides test.
```typescript
it("recategorizing an owner draw to Internal lowers avg monthly outflow and raises runway", () => {
  const records = [
    rec({ id: "in",   flow: "revenue", parent: "Income",          amount: 30000, signedNet: 30000,  periodMonthly: "2026-01" }),
    rec({ id: "burn", flow: "outflow", parent: "Operating Costs", amount: 10000, signedNet: -10000, periodMonthly: "2026-01" }),
    rec({ id: "draw", flow: "outflow", parent: "Operating Costs", head: "Owner Draw", amount: 10000, signedNet: -10000, periodMonthly: "2026-01" }),
  ];
  const base = { filters: DEFAULT_FILTERS, trendGrain: "monthly" as const, reviewPreset: "all" as const,
                 selectedTransactionId: "", cashOnHand: 50000, futureEventsText: "" };
  const before = buildDashboardView({ result: importResult(records), ...base });
  const after  = buildDashboardView({ result: importResult(records), ...base, overrides: new Map([["draw", { parent: "Internal" }]]) });
  expect(after.summary.cashHealth.averageMonthlyOutflow).toBeLessThan(before.summary.cashHealth.averageMonthlyOutflow);
  expect((after.summary.cashHealth.runwayMonths ?? 0)).toBeGreaterThan(before.summary.cashHealth.runwayMonths ?? 0);
  expect(after.nonOperating.total).toBe(-10000);
  expect(after.excludedTransactionIds ?? []).not.toContain("draw"); // still exported
  expect(after.categoryReview.items.map((i) => i.id)).toContain("draw");
});
```
> Verified names: `DEFAULT_FILTERS` from `filters.ts`; review preset `"all"` is valid in `review-presets.ts`.
- [ ] **Step 2:** run → FAIL (`overrides`/`nonOperating`/`categoryReview` absent).
- [ ] **Step 3: Implement.** Add imports: `applyClassificationOverrides`, `ClassificationOverride`; `isOperating`; `summarizeNonOperating`, `NonOperatingSummary`; `buildCategoryReviewSummary`, `CategoryReviewSummary`. Extend the interfaces:
```typescript
export interface DashboardViewInput {
  // ...existing...
  overrides?: Map<string, ClassificationOverride>;
}
export interface DashboardViewData {
  // ...existing...
  nonOperating: NonOperatingSummary;
  categoryReview: CategoryReviewSummary;
}
```
Rewrite the body (overrides first; non-op pulled from operating KPIs via the same exclusion union, but kept OUT of `excludedTransactionIds`):
```typescript
export function buildDashboardView(input: DashboardViewInput): DashboardViewData {
  const overrides = input.overrides ?? new Map();
  const overridden = applyClassificationOverrides(input.result.records, overrides);
  const reviewFilteredRecords = filterTransactions(overridden, input.filters);

  const reviewSummary = summarizeTransactions(
    reviewFilteredRecords, input.result.rejectedRows, input.cashOnHand, input.trendGrain);

  const reviewExcludedIds = new Set(input.deriveExcludedTransactionIds?.(reviewSummary) ?? []);
  const nonOperatingIds = new Set(
    reviewFilteredRecords.filter((r) => !isOperating(r)).map((r) => r.id));
  const operatingExcludedIds = new Set([...reviewExcludedIds, ...nonOperatingIds]);

  const baseFilteredRecords = reviewFilteredRecords.filter((r) => !operatingExcludedIds.has(r.id));
  const baseSummary = summarizeTransactions(
    baseFilteredRecords, input.result.rejectedRows, input.cashOnHand, input.trendGrain);
  const filteredRecords = applyReviewPreset(baseFilteredRecords, baseSummary, input.reviewPreset);

  const excludedRecords = reviewFilteredRecords.filter((r) => operatingExcludedIds.has(r.id));
  const summary = withReviewExclusions(
    summarizeTransactions(filteredRecords, input.result.rejectedRows, input.cashOnHand, input.trendGrain),
    excludedRecords,
    (r) => nonOperatingIds.has(r.id),
  );

  const nonOperating = summarizeNonOperating(
    reviewFilteredRecords.filter((r) => nonOperatingIds.has(r.id)));
  const categoryReview = buildCategoryReviewSummary({ records: overridden, overrides });

  const selectedTransactionId = filteredRecords.some((r) => r.id === input.selectedTransactionId)
    ? input.selectedTransactionId : filteredRecords[0]?.id ?? "";
  const selectedRecord = filteredRecords.find((r) => r.id === selectedTransactionId) ?? null;
  const parsedEvents = parseFutureCashEvents(input.futureEventsText);
  const forecast = { ...build13WeekForecast(filteredRecords, input.cashOnHand, parsedEvents.events),
                     rejectedEvents: parsedEvents.rejectedEvents };

  return {
    baseFilteredRecords, baseSummary, reviewSummary,
    excludedTransactionIds: [...reviewExcludedIds], // export removal = review only; non-op stays
    filteredRecords, summary, selectedTransactionId, selectedRecord,
    futureEventsText: input.futureEventsText, forecast,
    nonOperating, categoryReview,
  };
}
```
> Note: `excludedTransactionIds` deliberately excludes `nonOperatingIds` so `reviewedImportResult` keeps non-op rows in the export. Operating KPIs/lineage still drop them (via `operatingExcludedIds` + `withReviewExclusions`).
- [ ] **Step 4:** run → PASS. Update existing `dashboard-view.test.ts` literals to add `nonOperating`/`categoryReview` where they assert full `DashboardViewData` with `toEqual`.
- [ ] **Step 5:** `npx tsc --noEmit`; `npx vitest run src/finance`; commit `feat(finance): overrides + non-operating split via exclusion path (C2)` (includes Task 5).

---

## Task 7 — Category-review drawer markup

**Create `src/ui/category-review-drawer.ts` + test.** Read `review-drawer.ts` and `DESIGN.md` first (coral chips, flat audit surfaces, 44px targets). Option values use canonical flow strings (`"revenue"`/`"outflow"`). This module must be a pure escaped string renderer, matching `renderReviewDrawer(...)`; DOM event binding belongs in `dashboard-cockpit-actions.ts`.

- [ ] **Step 1: Failing test** `src/ui/category-review-drawer.test.ts`
```typescript
import { describe, it, expect } from "vitest";
import { renderCategoryReviewDrawer } from "./category-review-drawer";
import type { CategoryReviewItem } from "./category-review-queue";

function item(o: Partial<CategoryReviewItem> = {}): CategoryReviewItem {
  return { id: "a", flow: "outflow", parent: "Operating Costs", head: "Owner Draw",
    label: "ACME — Owner Draw", reasons: ["keyword"], acted: false, record: {} as any, ...o };
}
describe("renderCategoryReviewDrawer", () => {
  it("renders Type+Group selects with current values", () => {
    const el = document.createElement("div");
    el.innerHTML = renderCategoryReviewDrawer([item()]);
    expect(el.querySelector<HTMLSelectElement>('[data-role="flow-select"]')?.value).toBe("outflow");
    expect(el.querySelector<HTMLSelectElement>('[data-role="group-select"]')?.value).toBe("Operating Costs");
  });
  it("escapes labels and keeps item ids on interactive controls", () => {
    const html = renderCategoryReviewDrawer([item({ id: "x", label: "<b>bad</b>" })]);
    expect(html).toContain("&lt;b&gt;bad&lt;/b&gt;");
    expect(html).toContain('data-category-id="x"');
  });
  it("shows Reset only for acted rows", () => {
    const el = document.createElement("div");
    el.innerHTML = renderCategoryReviewDrawer([item({ acted: true })]);
    expect(el.querySelector('[data-role="reset"]')).not.toBeNull();
  });
});
```
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: Implement**
```typescript
// src/ui/category-review-drawer.ts
import type { CashFlow } from "../finance/types";
import type { CategoryReviewItem } from "./category-review-queue";
import { escapeHtml } from "./html";

const GROUP_OPTIONS = ["Income", "Operating Costs", "Delivery Costs", "Internal", "Financing"];
const FLOW_OPTIONS: { value: CashFlow; label: string }[] = [
  { value: "revenue", label: "Revenue (in)" }, { value: "outflow", label: "Outflow (out)" },
];

const sel = (v: string, cur: string) => v === cur ? " selected" : "";

export function renderCategoryReviewDrawer(items: readonly CategoryReviewItem[]): string {
  if (items.length === 0) {
    return `<section class="bw-review" role="region" aria-label="Category review"><p class="bw-review__empty">No categories need review.</p></section>`;
  }
  return `<section class="bw-review bw-category-review" role="region" aria-label="Category review">
    <header class="bw-review__head">
      <span class="bw-review__eyebrow">Category review</span>
      <p class="bw-review__intro">Review suggested for rows that can distort operating KPIs. Changing Type or Group re-derives the cockpit immediately.</p>
    </header>
    <ul class="bw-review__list">
      ${items.map((it) => `
    <li class="category-review-item" data-category-id="${escapeHtml(it.id)}" data-acted="${it.acted}">
      <div class="category-review-item__label">${escapeHtml(it.label)}</div>
      <label>Type <select data-role="flow-select" data-category-id="${escapeHtml(it.id)}" aria-label="Type for ${escapeHtml(it.label)}">
        ${FLOW_OPTIONS.map((o) => `<option value="${o.value}"${sel(o.value, it.flow)}>${escapeHtml(o.label)}</option>`).join("")}
      </select></label>
      <label>Group <select data-role="group-select" data-category-id="${escapeHtml(it.id)}" aria-label="Group for ${escapeHtml(it.label)}">
        ${GROUP_OPTIONS.map((g) => `<option value="${escapeHtml(g)}"${sel(g, it.parent)}>${escapeHtml(g)}</option>`).join("")}
      </select></label>
      <button type="button" data-role="confirm" data-category-id="${escapeHtml(it.id)}">Looks right</button>
      ${it.acted ? `<button type="button" data-role="reset" data-category-id="${escapeHtml(it.id)}">Reset</button>` : ""}
    </li>`).join("")}
    </ul>
  </section>`;
}
```
- [ ] **Step 4:** run → PASS (3). Event tests for select/confirm/reset belong in `dashboard-cockpit-actions.test.ts` when Task 9 wires callbacks.
- [ ] **Step 5:** commit `feat(ui): category-review drawer with Type/Group selects (C2)`.

---

## Task 8 — Render non-operating + category tiles

**Modify `src/ui/dashboard-cockpit.ts` (+ `dashboard-results.ts` viewmodel as needed).** Read both first. Add to the trust/audit cluster row beneath the 5 core KPIs (confirm layout vs `DESIGN.md`):
- **Non-operating** tile `data-tile="non-operating"`: value `nonOperating.total` (formatted); hidden when `total === 0` and `rows.length === 0`. Clicking opens a lightweight non-operating drawer listing `nonOperating.rows` (revenueIn / outflowOut split). It does NOT use the `AuditMetric` lineage panel (closed union) — render its own `[data-bw-nonop-panel]` aside mirroring the lineage-panel structure.
- **Category-review** tile `data-tile="category-review"`: value = count of items not acted/confirmed; hidden when 0. Clicking opens the category drawer container `[data-bw-category-panel]` whose body is filled by `renderCategoryReviewDrawer`.

These two tiles + drawers need data threaded from `main.ts` → `renderDashboardResults` → `renderCockpitStrip`. Extend `DashboardResultsRenderInput` and the `renderCockpitStrip` argument shape minimally to carry `nonOperating`, category-review items, and the category/non-operating template HTML. There is no `DashboardResultsViewModel` or `CockpitViewModelInput` type in the current source.

- [ ] **Step 1:** Add the tiles + drawers to the cockpit markup (no behavior yet). If the e2e needs a stable runway value selector, add `data-kpi="runway"` to the existing runway button and select `.bw-kpi__value`; do not assume a `.kpi-value` class exists.
- [ ] **Step 2:** `npx tsc --noEmit`; run `npm test` (snapshot/markup tests in `dashboard-cockpit.test.ts` may need updating).
- [ ] **Step 3:** commit `feat(ui): non-operating + category-review tiles (C2)`.

---

## Task 9 — Wire overrides + drawer actions in `main.ts`

**Modify `src/main.ts` + `src/ui/dashboard-cockpit-actions.ts`.** Mirror the verified `reviewExcludedItemIds` / `onReviewDecision` / `reopenReviewItemId` pattern (lines 59, 207–263).

- [ ] **Step 1:** Beside `reviewExcludedItemIds` (line 59) add:
```typescript
import { type ClassificationOverride } from "./finance/classification-overrides";
const classificationOverrides = new Map<string, ClassificationOverride>();
const confirmedCategoryIds = new Set<string>(); // "Looks right" without an override
```
Clear both wherever `reviewExcludedItemIds.clear()` is called (lines 99, 170, 196).
- [ ] **Step 2:** In `renderImportResult`, pass `overrides: classificationOverrides` into `buildDashboardView({...})`. Extend its `options` to `{ reopenReviewItemId?: string; reopenCategoryItemId?: string }`.
- [ ] **Step 3:** Define handlers and pass them through `renderDashboardResults` to the cockpit; bind via an extended `bindDashboardCockpitActions`:
```typescript
const onRecategorize = (id: string, patch: ClassificationOverride) => {
  classificationOverrides.set(id, { ...classificationOverrides.get(id), ...patch });
  confirmedCategoryIds.delete(id);
  renderImportResult(result, sourceName, { reopenCategoryItemId: id });
};
const onConfirmCategory = (id: string) => { confirmedCategoryIds.add(id); renderImportResult(result, sourceName, { reopenCategoryItemId: id }); };
const onResetCategory = (id: string) => { classificationOverrides.delete(id); confirmedCategoryIds.delete(id); renderImportResult(result, sourceName, { reopenCategoryItemId: id }); };
```
Filter the drawer items + tile count by `!confirmedCategoryIds.has(id)`.
- [ ] **Step 4:** In `bindDashboardCockpitActions`, add category/non-operating openers and template loading alongside the existing lineage/review openers. Reuse the existing `[data-bw-lineage-panel]`, `[data-bw-lineage-active]`, close button, Escape handling, and inline Tab focus-trap block; there is no standalone `trapFocus` helper. Restore `reopenCategoryItemId` focus to `[data-category-id="${id}"][data-role="group-select"]`.
- [ ] **Step 5:** Apply overrides to reviewer export data too. `reviewedImportResult(result, excludedTransactionIds)` currently only removes C1-excluded ids from original records; C2 must pass the overridden records into this export path so Type/Group edits appear in Reviewer JSON while non-operating rows remain exported.
- [ ] **Step 6:** `npx tsc --noEmit`; `npm run build`; then run the app, load the Agency sample, change an Owner-Draw row's Group to Internal → Non-operating tile appears, runway rises, drawer reopens with focus on the row, and Reviewer JSON reflects the overridden Type/Group.
- [ ] **Step 7:** commit `feat(ui): wire classification overrides + category drawer (C2)`.

---

## Task 10 — e2e: recategorize → live re-derive

**Modify `e2e/lineage-drawer.spec.ts`.** Reuse its sample-load + drawer helpers (from `7be3afe`). Align `data-*` with Tasks 8–9.

- [ ] **Step 1:** Add:
```typescript
test("recategorizing a row to Internal re-derives runway live", async ({ page }) => {
  await loadAgencySample(page);
  const before = await page.locator('[data-kpi="runway"] .bw-kpi__value').innerText();
  await page.locator('[data-tile="category-review"]').click();
  const row = page.locator('.category-review-item').first();
  await row.locator('[data-role="group-select"]').selectOption("Internal");
  await expect(page.locator('[data-tile="non-operating"]')).toBeVisible();
  expect(await page.locator('[data-kpi="runway"] .bw-kpi__value').innerText()).not.toBe(before);
  await expect(row.locator('[data-role="group-select"]')).toBeFocused();
});
```
> Requires cash-on-hand set in the sample flow so runway is non-null; set it in the helper if needed.
- [ ] **Step 2:** `npm run test:e2e` → FAIL until selectors exist; then PASS (desktop + mobile).
- [ ] **Step 3:** commit `test(e2e): recategorize → live runway re-derive (C2)`.

---

## Final verification
- [ ] `npx tsc --noEmit` → 0
- [ ] `npm test` → all pass (update goldens touched by `nonOperating`/`categoryReview` outputs)
- [ ] `npm run test:e2e` → pass desktop + mobile
- [ ] Manual exit criterion: Agency sample, recategorize owner draw → avg monthly outflow drops, runway rises, Non-operating tile shows the moved money, it remains in the export.
- [ ] Update `docs/SESSION_HANDOFF_2026-05-31.md` (Vault Rule): git state, changes, verification, next priority = Phase D (persist this override map).

---

## Self-Review
**Coverage:** override layer (T2); detection/suggestions (T3); operating exclusion of non-op via existing machinery (T5–T6); non-operating reporting (T4, T6, T8); drawer + recategorize/confirm/reset (T7, T9); live re-derive + reopen/focus (T9, T10). Exit criterion test at the seam (T6) and e2e (T10).
**Key corrections vs spec/earlier drafts:** `revenue` not `inflow`; `amount` not `grossAmount`; flat `FinanceSummary` with nested `cashHealth`; runway = `cashOnHand/averageMonthlyOutflow` (recategorize moves runway only via `averageMonthlyOutflow`); `MetricLineage.excluded` exists and `AuditMetric` is closed (non-op tile uses its own type, not a new AuditMetric); non-op rows excluded from operating KPIs but kept OUT of `excludedTransactionIds` so they remain in export; reviewer export must still use overridden records.
**Decision applied:** "reuse exclusion path" — non-op flows through `withReviewExclusions` (reason-tagged in T5), no parallel KPI math.
**Gap handled:** "Looks right" without override → `confirmedCategoryIds` (T9).
**Type consistency:** `ClassificationOverride{flow?,parent?}`, `applyClassificationOverrides`, `buildCategoryReviewSummary`/`CategoryReviewItem{flow,parent,reasons,acted}`, `summarizeNonOperating`→`NonOperatingSummary{total,revenueIn,outflowOut,rows}`, `DashboardViewData.{nonOperating,categoryReview}`, `buildDashboardView({result,...,overrides})`, `renderImportResult(result,sourceName,{reopenReviewItemId,reopenCategoryItemId})`, `renderDashboardResults(input: DashboardResultsRenderInput)`, `renderCockpitStrip(...)` — consistent T1–T10.
**Still-to-verify during impl (flagged inline, not guessed):** exact cockpit/results markup extension shape (T8); `dashboard-cockpit.test.ts` snapshot/markup updates (T8); category/non-operating opener names chosen in `dashboard-cockpit-actions.ts` (T9).
