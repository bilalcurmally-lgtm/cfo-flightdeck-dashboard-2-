# C2 — Focused Category Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user recategorize transactions that distort operating KPIs (Type + Group) and re-derive the cockpit live, with non-operating money reported in its own tile — never silently zeroed.

**Architecture:** A pure, reversible in-session override layer (`Map<id, {flow?, parent?}>`) rewrites records before KPI math. `summarizeTransactions` and `calculateCashHealth` partition records into **operating** vs **non-operating** (rows whose `parent` is in `NON_OPERATING_GROUPS`) and compute KPIs on operating rows only, emitting a parallel `nonOperating` `MetricLineage` in the same pass. A keyword+group detection queue (sibling of `review-queue.ts`) surfaces suggestions; a new drawer (reusing the C1 slide-in/focus-trap) drives recategorize/confirm/reset, re-rendering via the `reopenReviewItemId` pattern shipped in `cbd910c`.

**Tech Stack:** TypeScript (strict), Vitest (unit + golden), Playwright (e2e). No new runtime deps.

**Design source:** `docs/superpowers/specs/2026-05-31-c2-focused-category-review-design.md`. Read it before starting.

---

## Grounding facts — VERIFIED against the tree at tip `51ddda0`

These were read directly from source (the spec contained two inaccuracies; this plan supersedes it where they conflict):

- **`CashFlow = "revenue" | "outflow"`** (`src/finance/types.ts:1`). The inflow value is `"revenue"`, NOT `"inflow"`. Use `"revenue"` everywhere.
- **`TransactionRecord`** real fields (`types.ts:21`): `id; date: Date; dateISO: string; periodDaily; periodWeekly; periodMonthly: string; sourceSheet?; head; parent; subcategory; description; counterparty; account; flow: CashFlow; amount: number; signedNet: number; runningBalance: number | null`. There is **no** `grossAmount`, `currency`, `raw`, or `sourceRow`. The positive magnitude field is **`amount`**; `signedNet` is `+amount` for revenue, `-amount` for outflow.
- **`MetricLineage = { metric: string; total: number; formula: string; inputs: LineageInput[]; recordIds: string[]; note?: string }`** (`types.ts`). There is **no** `entries[]` and **no** `excluded[]` (the spec was wrong about this). Lineage objects are built by the private helper `metric(name, total, formula, records)` in `summary.ts`, which fills `inputs` via `buildInputs(records)` and `recordIds` via `records.map(r => r.id)`.
- **`SummaryLineage`** has an index signature `[key: string]: MetricLineage` plus required `revenue|outflow|net`. Adding a `nonOperating` key needs **no type change**, but we add it explicitly for discoverability.
- **`FinanceTotals = { revenue; outflow; net; transactionCount }`** — the field is `revenue`, not `inflow`.
- **`summarizeTransactions(records)`** (`summary.ts`): `revenueRecords/outflowRecords = records.filter(flow===...)`, totals via `sumAmount` (sums `record.amount`), `lineage` via `buildLineage(...)` → `metric(...)`. Keys only off `record.flow`; `parent` never touches math today.
- **`calculateCashHealth(records, options={})`** (`cash-health.ts`): same revenue/outflow filter; `monthsCovered = countDistinctMonths(records)`; `averageMonthlyBurn = outflowTotal / monthsCovered`; `runwayMonths = round2(netCash / averageMonthlyBurn)` or `null`. `lineage` keys are exactly `netCash | averageMonthlyBurn | runwayMonths`.
- **`buildDashboardView(input)`** (`dashboard-view.ts`) returns `{ records, activeRecords, summary, cashHealth, reviewSummary, excludedTransactionIds? }`. It does **NOT** produce a `cockpit` field. It calls `buildReviewSummary(records)` **positionally** (not `{records}`), then filters `activeRecords` via the `deriveExcludedTransactionIds` callback.
- **`buildReviewSummary(records: TransactionRecord[])`** is positional → `{ items, excludableTransactionIds, defaultExcludedTransactionIds }`.
- **`deriveAuditedCockpit({summary, cashHealth, reviewSummary})`** (`cockpit-kpis.ts`) returns `{ kpis: CockpitKpi[]; needsReviewCount }`. `CockpitKpi = { id; label; value: number|null; lineageKey; cashHealthMetric? }`. It is a thin reader — **do not add KPI math here** (eng-review rule). Verify its call site (likely `main.ts`) during Task 6.
- `main.ts` holds `const reviewExcludedItemIds = new Set<string>()`, calls `buildDashboardView`, re-renders through `renderImportResult(...)` with a `reopenReviewItemId` option (shipped `cbd910c`).

**Conventions:** money is integer minor units. `npx tsc --noEmit` before every commit; never commit with a type error. Bash tool: write multiline commit bodies to a file and `git commit -F file` — never a PowerShell heredoc.

---

## File Structure

**Create:**
- `src/finance/operating-groups.ts` — shared `NON_OPERATING_GROUPS` + `isOperating`.
- `src/finance/classification-overrides.ts` — override type + `applyClassificationOverrides`.
- `src/finance/classification-overrides.test.ts`
- `src/ui/category-review-queue.ts` — `buildCategoryReviewSummary` (detection).
- `src/ui/category-review-queue.test.ts`
- `src/ui/category-review-drawer.ts` — drawer markup + binding.
- `src/ui/category-review-drawer.test.ts`

**Modify:**
- `src/finance/types.ts` — `FinanceTotals.nonOperating`; `SummaryLineage.nonOperating`; `CashHealthResult.nonOperatingTotal` + `lineage.nonOperating`.
- `src/finance/summary.ts` — operating partition + `nonOperating` lineage.
- `src/finance/cash-health.ts` — operating-only burn/runway + `nonOperating` total/lineage.
- `src/finance/cockpit-kpis.ts` — `AuditedCockpit.{nonOperatingTotal,categoryReviewCount}`.
- `src/finance/dashboard-view.ts` — thread overrides + `categoryReview` through.
- `src/main.ts` — overrides `Map`, drawer wiring, re-render + reopen, export uses overridden records.
- `e2e/lineage-drawer.spec.ts` — recategorize → live re-derive.

---

## Task 1: Operating-group taxonomy constant

**Files:**
- Create: `src/finance/operating-groups.ts`

- [ ] **Step 1: Create the constant and helper**

```typescript
// src/finance/operating-groups.ts
/**
 * Canonical internal taxonomy. Rows in these groups are non-operating
 * (financing in / internal transfers) and are excluded from operating KPIs.
 * Matched case-insensitively against `record.parent`.
 */
export const NON_OPERATING_GROUPS = new Set(["internal", "financing"]);

export function isOperating(record: { parent: string }): boolean {
  return !NON_OPERATING_GROUPS.has((record.parent ?? "").trim().toLowerCase());
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/finance/operating-groups.ts
git commit -m "feat(finance): add operating/non-operating group taxonomy (C2)"
```

---

## Task 2: Classification override layer

**Files:**
- Create: `src/finance/classification-overrides.ts`
- Test: `src/finance/classification-overrides.test.ts`

> The shared test fixture below (`rec`) matches the **real** `TransactionRecord`. Reuse it (or copy it) in every later test in this plan.

- [ ] **Step 1: Write the failing test**

```typescript
// src/finance/classification-overrides.test.ts
import { describe, it, expect } from "vitest";
import { applyClassificationOverrides } from "./classification-overrides";
import type { TransactionRecord } from "./types";

export function rec(over: Partial<TransactionRecord>): TransactionRecord {
  return {
    id: "t1",
    date: new Date("2026-01-01T00:00:00Z"),
    dateISO: "2026-01-01",
    periodDaily: "2026-01-01",
    periodWeekly: "2026-W01",
    periodMonthly: "2026-01",
    head: "Misc",
    parent: "Operating Costs",
    subcategory: "",
    description: "d",
    counterparty: "c",
    account: "main",
    flow: "outflow",
    amount: 5000,
    signedNet: -5000,
    runningBalance: null,
    ...over,
  };
}

describe("applyClassificationOverrides", () => {
  it("returns a new array and leaves originals untouched", () => {
    const records = [rec({ id: "a" })];
    const out = applyClassificationOverrides(records, new Map());
    expect(out).not.toBe(records);
    expect(out[0]).toEqual(records[0]);
  });

  it("overrides parent without touching flow/signedNet", () => {
    const records = [rec({ id: "a", parent: "Operating Costs" })];
    const out = applyClassificationOverrides(records, new Map([["a", { parent: "Financing" }]]));
    expect(out[0].parent).toBe("Financing");
    expect(out[0].flow).toBe("outflow");
    expect(out[0].signedNet).toBe(-5000);
  });

  it("recomputes signedNet when flow flips outflow -> revenue", () => {
    const records = [rec({ id: "a", flow: "outflow", signedNet: -5000, amount: 5000 })];
    const out = applyClassificationOverrides(records, new Map([["a", { flow: "revenue" }]]));
    expect(out[0].flow).toBe("revenue");
    expect(out[0].signedNet).toBe(5000);
  });

  it("recomputes signedNet when flow flips revenue -> outflow", () => {
    const records = [rec({ id: "a", flow: "revenue", signedNet: 5000, amount: 5000 })];
    const out = applyClassificationOverrides(records, new Map([["a", { flow: "outflow" }]]));
    expect(out[0].signedNet).toBe(-5000);
  });

  it("ignores overrides whose id is absent from the record set", () => {
    const records = [rec({ id: "a" })];
    const out = applyClassificationOverrides(records, new Map([["ghost", { flow: "revenue" }]]));
    expect(out[0]).toEqual(records[0]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/finance/classification-overrides.test.ts`
Expected: FAIL — "applyClassificationOverrides is not a function" (module not found).

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/finance/classification-overrides.ts
import type { CashFlow, TransactionRecord } from "./types";

export interface ClassificationOverride {
  flow?: CashFlow;
  parent?: string;
}

/**
 * Returns a NEW record array with flow/parent replaced per the overrides map.
 * Pure and reversible: dropping a map entry restores the original record.
 * When flow flips, signedNet is recomputed from `amount` so balances stay correct
 * (revenue = +amount, outflow = -amount).
 */
export function applyClassificationOverrides(
  records: TransactionRecord[],
  overrides: Map<string, ClassificationOverride>,
): TransactionRecord[] {
  if (overrides.size === 0) return records.map((r) => ({ ...r }));
  return records.map((record) => {
    const override = overrides.get(record.id);
    if (!override) return { ...record };
    const next: TransactionRecord = { ...record };
    if (override.parent !== undefined) next.parent = override.parent;
    if (override.flow !== undefined && override.flow !== record.flow) {
      next.flow = override.flow;
      next.signedNet = override.flow === "revenue" ? record.amount : -record.amount;
    }
    return next;
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/finance/classification-overrides.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/finance/classification-overrides.ts src/finance/classification-overrides.test.ts
git commit -m "feat(finance): in-session classification override layer (C2)"
```

---

## Task 3: Operating/non-operating split in `summarizeTransactions`

**Files:**
- Modify: `src/finance/types.ts`
- Modify: `src/finance/summary.ts`
- Test: `src/finance/summary.test.ts` (add cases; create if absent — import `rec` from the overrides test or copy it)

- [ ] **Step 1: Extend the types**

In `src/finance/types.ts`, add to `FinanceTotals`:

```typescript
export interface FinanceTotals {
  revenue: number;
  outflow: number;
  net: number;
  transactionCount: number;
  /** Signed sum of non-operating (Internal/Financing) rows. Reported separately. */
  nonOperating: number;
}
```

Add an explicit `nonOperating` key to `SummaryLineage` (the index signature already permits it; this documents it):

```typescript
export interface SummaryLineage {
  revenue: MetricLineage;
  outflow: MetricLineage;
  net: MetricLineage;
  nonOperating: MetricLineage;
  [key: string]: MetricLineage;
}
```

- [ ] **Step 2: Write the failing test**

```typescript
// src/finance/summary.test.ts (add; keep existing tests)
import { describe, it, expect } from "vitest";
import { summarizeTransactions } from "./summary";
import { rec } from "./classification-overrides.test";

describe("summarizeTransactions operating/non-operating split", () => {
  it("excludes Internal/Financing rows from revenue/outflow totals", () => {
    const records = [
      rec({ id: "op", flow: "outflow", parent: "Operating Costs", amount: 1000, signedNet: -1000 }),
      rec({ id: "fin", flow: "revenue", parent: "Financing", amount: 5000, signedNet: 5000 }),
    ];
    const s = summarizeTransactions(records);
    expect(s.totals.revenue).toBe(0);
    expect(s.totals.outflow).toBe(1000);
    expect(s.totals.nonOperating).toBe(5000); // signed sum of non-operating rows
  });

  it("records pulled rows in lineage.nonOperating.recordIds", () => {
    const records = [
      rec({ id: "op", parent: "Operating Costs" }),
      rec({ id: "intl", flow: "outflow", parent: "Internal", amount: 2000, signedNet: -2000 }),
    ];
    const s = summarizeTransactions(records);
    expect(s.lineage.nonOperating.recordIds).toEqual(["intl"]);
    expect(s.lineage.outflow.recordIds).not.toContain("intl");
  });

  it("matches group names case-insensitively", () => {
    const records = [rec({ id: "fin", flow: "revenue", parent: "financing", amount: 100, signedNet: 100 })];
    const s = summarizeTransactions(records);
    expect(s.totals.revenue).toBe(0);
    expect(s.totals.nonOperating).toBe(100);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/finance/summary.test.ts`
Expected: FAIL — `totals.nonOperating` / `lineage.nonOperating` undefined.

- [ ] **Step 4: Implement the split in `summary.ts`**

Add the import at the top:

```typescript
import { isOperating } from "./operating-groups";
```

At the start of `summarizeTransactions`, partition before filtering by flow:

```typescript
export function summarizeTransactions(records: TransactionRecord[]): FinanceSummary {
  const operatingRecords = records.filter(isOperating);
  const nonOperatingRecords = records.filter((record) => !isOperating(record));

  const revenueRecords = operatingRecords.filter((record) => record.flow === REVENUE);
  const outflowRecords = operatingRecords.filter((record) => record.flow === OUTFLOW);

  const revenueTotal = sumAmount(revenueRecords);
  const outflowTotal = sumAmount(outflowRecords);
  const net = revenueTotal - outflowTotal;
  const nonOperatingSigned = nonOperatingRecords.reduce((t, r) => t + r.signedNet, 0);

  const lineage: SummaryLineage = buildLineage(
    revenueRecords,
    outflowRecords,
    revenueTotal,
    outflowTotal,
    net,
    nonOperatingRecords,
    nonOperatingSigned,
  );

  return {
    totals: {
      revenue: revenueTotal,
      outflow: outflowTotal,
      net,
      transactionCount: records.length,
      nonOperating: nonOperatingSigned,
    },
    byParent: rollupByParent(operatingRecords),
    byHead: rollupByHead(operatingRecords),
    timeline: buildTimeline(operatingRecords),
    lineage,
    records,
  };
}
```

> Rollups/timeline run on `operatingRecords` so non-operating money never appears in operating breakdowns. `records` in the return stays the full set (consumers expect every row).

Extend `buildLineage` to accept and emit the non-operating metric:

```typescript
function buildLineage(
  revenueRecords: TransactionRecord[],
  outflowRecords: TransactionRecord[],
  revenueTotal: number,
  outflowTotal: number,
  net: number,
  nonOperatingRecords: TransactionRecord[],
  nonOperatingSigned: number,
): SummaryLineage {
  return {
    revenue: metric("revenue", revenueTotal, "sum(amount where flow=revenue, operating)", revenueRecords),
    outflow: metric("outflow", outflowTotal, "sum(amount where flow=outflow, operating)", outflowRecords),
    net: metric("net", net, "revenue - outflow (operating)", [...revenueRecords, ...outflowRecords]),
    nonOperating: metric(
      "nonOperating",
      nonOperatingSigned,
      "sum(signedNet where group in Internal/Financing)",
      nonOperatingRecords,
    ),
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/finance/summary.test.ts`
Expected: PASS (new + existing). If existing golden tests assert `totals` with `toEqual`, add `nonOperating: 0` to those expectations.

- [ ] **Step 6: Full check, then commit**

```bash
npx tsc --noEmit
npx vitest run src/finance
git add src/finance/types.ts src/finance/summary.ts src/finance/summary.test.ts
git commit -m "feat(finance): operating vs non-operating split in summary (C2)"
```

---

## Task 4: Operating-only burn/runway in `calculateCashHealth`

**Files:**
- Modify: `src/finance/types.ts`
- Modify: `src/finance/cash-health.ts`
- Test: `src/finance/cash-health.test.ts` (add cases)

- [ ] **Step 1: Extend `CashHealthResult`**

In `types.ts`:

```typescript
export interface CashHealthResult {
  netCash: number;
  averageMonthlyBurn: number;
  runwayMonths: number | null;
  monthsCovered: number;
  revenueTotal: number;
  outflowTotal: number;
  /** Signed sum of non-operating rows, reported separately. */
  nonOperatingTotal: number;
  lineage: {
    netCash: MetricLineage;
    averageMonthlyBurn: MetricLineage;
    runwayMonths: MetricLineage;
    nonOperating: MetricLineage;
  };
}
```

- [ ] **Step 2: Write the failing test (exit-criterion math)**

```typescript
// src/finance/cash-health.test.ts (add)
import { describe, it, expect } from "vitest";
import { calculateCashHealth } from "./cash-health";
import { rec } from "./classification-overrides.test";

describe("calculateCashHealth operating split", () => {
  it("excludes a non-operating owner draw from burn, raising runway", () => {
    const base = [
      rec({ id: "in",   flow: "revenue", parent: "Income",          amount: 30000, signedNet: 30000,  periodMonthly: "2026-01" }),
      rec({ id: "burn", flow: "outflow", parent: "Operating Costs", amount: 10000, signedNet: -10000, periodMonthly: "2026-01" }),
      rec({ id: "draw", flow: "outflow", parent: "Internal",        amount: 10000, signedNet: -10000, periodMonthly: "2026-01" }),
    ];
    const h = calculateCashHealth(base);
    expect(h.outflowTotal).toBe(10000);        // draw excluded from operating outflow
    expect(h.nonOperatingTotal).toBe(-10000);  // signed
    expect(h.averageMonthlyBurn).toBe(10000);  // 10000 / 1 month, not 20000
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/finance/cash-health.test.ts`
Expected: FAIL — `nonOperatingTotal` undefined; burn would be 20000.

- [ ] **Step 4: Implement**

Add the import and partition at the top of `calculateCashHealth`:

```typescript
import { isOperating } from "./operating-groups";
import { metric } from "./summary"; // export `metric` from summary.ts (see note below)
```

> `metric()` is currently private to `summary.ts`. Export it (`export function metric(...)`) so cash-health can build a `nonOperating` lineage identically. One-line change in `summary.ts`; add it in this task's commit.

Rewrite the body to partition first:

```typescript
export function calculateCashHealth(
  records: TransactionRecord[],
  options: CashHealthOptions = {},
): CashHealthResult {
  const operatingRecords = records.filter(isOperating);
  const nonOperatingRecords = records.filter((record) => !isOperating(record));

  const revenueRecords = operatingRecords.filter((record) => record.flow === "revenue");
  const outflowRecords = operatingRecords.filter((record) => record.flow === "outflow");

  const revenueTotal = sumAmount(revenueRecords);
  const outflowTotal = sumAmount(outflowRecords);
  const netCash = revenueTotal - outflowTotal;
  const nonOperatingTotal = nonOperatingRecords.reduce((t, r) => t + r.signedNet, 0);

  const monthsCovered = countDistinctMonths(operatingRecords);
  const averageMonthlyBurn = monthsCovered > 0 ? outflowTotal / monthsCovered : 0;
  const runwayMonths = averageMonthlyBurn > 0 ? round2(netCash / averageMonthlyBurn) : null;

  return {
    netCash,
    averageMonthlyBurn: round2(averageMonthlyBurn),
    runwayMonths,
    monthsCovered,
    revenueTotal,
    outflowTotal,
    nonOperatingTotal,
    lineage: {
      ...buildCashHealthLineage({
        revenueTotal,
        outflowTotal,
        netCash,
        monthsCovered,
        averageMonthlyBurn,
        runwayMonths,
        revenueRecordIds: revenueRecords.map((r) => r.id),
        outflowRecordIds: outflowRecords.map((r) => r.id),
      }),
      nonOperating: metric(
        "nonOperating",
        nonOperatingTotal,
        "sum(signedNet where group in Internal/Financing)",
        nonOperatingRecords,
      ),
    },
  };
}
```

> If `cash-health.ts` has its own `sumAmount`/`round2`/`countDistinctMonths` private helpers, keep using them. If `sumAmount` lives only in `summary.ts`, import it. Verify during implementation; do not duplicate.

In the empty-records early return (if present), add `nonOperatingTotal: 0` and `nonOperating: metric("nonOperating", 0, "...", [])` to `lineage`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/finance/cash-health.test.ts`
Expected: PASS. Update any pre-existing `toEqual` golden to add `nonOperatingTotal: 0` + `lineage.nonOperating`.

- [ ] **Step 6: Commit**

```bash
npx tsc --noEmit
git add src/finance/types.ts src/finance/cash-health.ts src/finance/summary.ts src/finance/cash-health.test.ts
git commit -m "feat(finance): operating-only burn/runway + non-operating total (C2)"
```

---

## Task 5: Category-review detection queue

**Files:**
- Create: `src/ui/category-review-queue.ts`
- Test: `src/ui/category-review-queue.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/ui/category-review-queue.test.ts
import { describe, it, expect } from "vitest";
import { buildCategoryReviewSummary } from "./category-review-queue";
import { rec } from "../finance/classification-overrides.test";

describe("buildCategoryReviewSummary", () => {
  it("flags a row by non-operating group", () => {
    const r = rec({ id: "a", parent: "Financing" });
    const s = buildCategoryReviewSummary({ records: [r], overrides: new Map() });
    expect(s.items.map((i) => i.id)).toEqual(["a"]);
    expect(s.items[0].reasons).toContain("non-operating-group");
  });

  it("flags an owner-draw still sitting in Operating by keyword", () => {
    const r = rec({ id: "a", parent: "Operating Costs", head: "Owner Draw" });
    const s = buildCategoryReviewSummary({ records: [r], overrides: new Map() });
    expect(s.items.map((i) => i.id)).toEqual(["a"]);
    expect(s.items[0].reasons).toContain("keyword");
  });

  it("does not flag an ordinary operating cost", () => {
    const r = rec({ id: "a", parent: "Operating Costs", head: "Rent", counterparty: "Landlord", subcategory: "" });
    const s = buildCategoryReviewSummary({ records: [r], overrides: new Map() });
    expect(s.items).toEqual([]);
  });

  it("marks a flagged row as acted when an override exists", () => {
    const r = rec({ id: "a", parent: "Financing" });
    const s = buildCategoryReviewSummary({ records: [r], overrides: new Map([["a", { parent: "Income" }]]) });
    expect(s.items[0].acted).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/category-review-queue.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
// src/ui/category-review-queue.ts
import type { CashFlow, TransactionRecord } from "../finance/types";
import type { ClassificationOverride } from "../finance/classification-overrides";
import { NON_OPERATING_GROUPS } from "../finance/operating-groups";

export type CategoryReviewReason = "non-operating-group" | "keyword";

const KEYWORDS = [
  "owner draw", "draw", "tax", "refund", "reimbursement",
  "loan", "investment", "dividend", "transfer",
];

export interface CategoryReviewItem {
  id: string;
  flow: CashFlow;
  parent: string;
  head: string;
  label: string;
  reasons: CategoryReviewReason[];
  /** true when the user has already applied an override to this row. */
  acted: boolean;
  record: TransactionRecord;
}

export interface CategoryReviewSummary {
  items: CategoryReviewItem[];
}

export interface BuildCategoryReviewOptions {
  records: TransactionRecord[];
  overrides: Map<string, ClassificationOverride>;
}

function matchesKeyword(record: TransactionRecord): boolean {
  const haystack = `${record.head} ${record.subcategory} ${record.counterparty}`.toLowerCase();
  return KEYWORDS.some((kw) => haystack.includes(kw));
}

export function buildCategoryReviewSummary(
  options: BuildCategoryReviewOptions,
): CategoryReviewSummary {
  const { records, overrides } = options;
  const items: CategoryReviewItem[] = [];

  for (const record of records) {
    const reasons: CategoryReviewReason[] = [];
    if (NON_OPERATING_GROUPS.has((record.parent ?? "").trim().toLowerCase())) {
      reasons.push("non-operating-group");
    }
    if (matchesKeyword(record)) reasons.push("keyword");
    if (reasons.length === 0) continue;

    items.push({
      id: record.id,
      flow: record.flow,
      parent: record.parent,
      head: record.head,
      label: `${record.description} — ${record.head || "Uncategorized"}`,
      reasons,
      acted: overrides.has(record.id),
      record,
    });
  }

  return { items };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/category-review-queue.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ui/category-review-queue.ts src/ui/category-review-queue.test.ts
git commit -m "feat(ui): category-review detection queue (keyword OR group) (C2)"
```

---

## Task 6: Surface counts in `deriveAuditedCockpit`

**Files:**
- Modify: `src/finance/cockpit-kpis.ts`
- Test: `src/finance/cockpit-kpis.test.ts` (add cases)

> Thin reader. It only *reads* `summary.totals.nonOperating` and a passed-in count; no KPI math.

- [ ] **Step 1: Write the failing test**

```typescript
// src/finance/cockpit-kpis.test.ts (add)
import { describe, it, expect } from "vitest";
import { deriveAuditedCockpit } from "./cockpit-kpis";

describe("deriveAuditedCockpit non-operating + category review", () => {
  it("exposes nonOperatingTotal and categoryReviewCount", () => {
    const cockpit = deriveAuditedCockpit({
      summary: { totals: { revenue: 0, outflow: 0, net: 0, transactionCount: 0, nonOperating: 5000 } } as any,
      cashHealth: { runwayMonths: null, averageMonthlyBurn: 0 } as any,
      reviewSummary: { items: [] } as any,
      categoryReviewCount: 3,
    });
    expect(cockpit.nonOperatingTotal).toBe(5000);
    expect(cockpit.categoryReviewCount).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/finance/cockpit-kpis.test.ts`
Expected: FAIL — `categoryReviewCount` not accepted / fields undefined.

- [ ] **Step 3: Implement**

Extend the interfaces (`cockpit-kpis.ts`):

```typescript
interface AuditedCockpit {
  kpis: CockpitKpi[];
  needsReviewCount: number;
  nonOperatingTotal: number;
  categoryReviewCount: number;
}

interface DeriveAuditedCockpitInput {
  summary: FinanceSummary;
  cashHealth: CashHealthResult;
  reviewSummary: ReviewSummary;
  categoryReviewCount?: number;
}
```

In the return statement of `deriveAuditedCockpit`, add the two fields (keep `kpis`/`needsReviewCount` unchanged):

```typescript
  return {
    kpis,
    needsReviewCount,
    nonOperatingTotal: summary.totals.nonOperating,
    categoryReviewCount: input.categoryReviewCount ?? 0,
  };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/finance/cockpit-kpis.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npx tsc --noEmit
git add src/finance/cockpit-kpis.ts src/finance/cockpit-kpis.test.ts
git commit -m "feat(finance): expose non-operating + category-review counts on cockpit (C2)"
```

---

## Task 7: Thread overrides through `buildDashboardView`

**Files:**
- Modify: `src/finance/dashboard-view.ts`
- Test: `src/finance/dashboard-view.test.ts` (add cases)

> `buildDashboardView` does NOT build a cockpit — leave that to its caller. This task adds `overrides` + a `categoryReview` field only.

- [ ] **Step 1: Write the failing test (exit-criterion at the integration seam)**

```typescript
// src/finance/dashboard-view.test.ts (add)
import { describe, it, expect } from "vitest";
import { buildDashboardView } from "./dashboard-view";
import { rec } from "./classification-overrides.test";

describe("buildDashboardView classification overrides", () => {
  const records = [
    rec({ id: "in",   flow: "revenue", parent: "Income",          amount: 30000, signedNet: 30000,  periodMonthly: "2026-01" }),
    rec({ id: "burn", flow: "outflow", parent: "Operating Costs", amount: 10000, signedNet: -10000, periodMonthly: "2026-01" }),
    rec({ id: "draw", flow: "outflow", parent: "Operating Costs", head: "Owner Draw", amount: 10000, signedNet: -10000, periodMonthly: "2026-01" }),
  ];

  it("recategorizing an owner draw to Internal lowers burn and raises runway", () => {
    const before = buildDashboardView({ records });
    const after = buildDashboardView({ records, overrides: new Map([["draw", { parent: "Internal" }]]) });
    expect(after.cashHealth.averageMonthlyBurn).toBeLessThan(before.cashHealth.averageMonthlyBurn);
    expect((after.cashHealth.runwayMonths ?? 0)).toBeGreaterThan(before.cashHealth.runwayMonths ?? 0);
  });

  it("populates categoryReview items for flagged rows", () => {
    const view = buildDashboardView({ records });
    expect(view.categoryReview.items.map((i) => i.id)).toContain("draw");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/finance/dashboard-view.test.ts`
Expected: FAIL — `overrides` not accepted / `categoryReview` undefined.

- [ ] **Step 3: Implement**

Add imports:

```typescript
import { applyClassificationOverrides, type ClassificationOverride } from "./classification-overrides";
import { buildCategoryReviewSummary, type CategoryReviewSummary } from "../ui/category-review-queue";
```

Extend the interfaces:

```typescript
export interface DashboardViewInput {
  records: TransactionRecord[];
  deriveExcludedTransactionIds?: (reviewSummary: ReviewSummary) => string[];
  overrides?: Map<string, ClassificationOverride>;
}

export interface DashboardViewData {
  records: TransactionRecord[];
  activeRecords: TransactionRecord[];
  summary: FinanceSummary;
  cashHealth: CashHealthResult;
  reviewSummary: ReviewSummary;
  categoryReview: CategoryReviewSummary;
  excludedTransactionIds?: string[];
}
```

Rewrite the body so overrides apply **first** (so detection, exclusion, and KPI math all see overridden values), then C1 exclusion filters. Note `buildReviewSummary` is positional:

```typescript
export function buildDashboardView(input: DashboardViewInput): DashboardViewData {
  const { records, deriveExcludedTransactionIds, overrides } = input;

  const overridden = applyClassificationOverrides(records, overrides ?? new Map());

  const reviewSummary = buildReviewSummary(overridden);

  const excludedSet = computeExcludedSet(overridden, deriveExcludedTransactionIds, reviewSummary);
  const activeRecords =
    excludedSet.size > 0
      ? overridden.filter((record) => !excludedSet.has(record.id))
      : overridden;

  const summary = summarizeTransactions(activeRecords);
  const cashHealth = calculateCashHealth(activeRecords);

  const categoryReview = buildCategoryReviewSummary({
    records: overridden,
    overrides: overrides ?? new Map(),
  });

  const excludedTransactionIds =
    excludedSet.size > 0 ? Array.from(excludedSet) : undefined;

  return {
    records: overridden,
    activeRecords,
    summary,
    cashHealth,
    reviewSummary,
    categoryReview,
    excludedTransactionIds,
  };
}
```

> Decision: `data.records` is the overridden set so all downstream consumers (reviewer/JSON export, drawer rows) read post-override values — this satisfies the spec's "export must use the overridden record set." `computeExcludedSet` is unchanged (now fed `overridden`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/finance/dashboard-view.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npx tsc --noEmit
npx vitest run src/finance
git add src/finance/dashboard-view.ts src/finance/dashboard-view.test.ts
git commit -m "feat(finance): thread classification overrides through buildDashboardView (C2)"
```

---

## Task 8: Category-review drawer (markup + binding)

**Files:**
- Create: `src/ui/category-review-drawer.ts`
- Test: `src/ui/category-review-drawer.test.ts`

> Read `src/ui/dashboard-cockpit-actions.ts` first to reuse its slide-in panel + focus-trap helpers. Read `DESIGN.md` for chip/surface/44px-target rules before writing markup. The select option values use the canonical flow strings (`"revenue"` / `"outflow"`).

- [ ] **Step 1: Write the failing test (jsdom)**

```typescript
// src/ui/category-review-drawer.test.ts
import { describe, it, expect, vi } from "vitest";
import { renderCategoryReviewDrawer } from "./category-review-drawer";
import type { CategoryReviewItem } from "./category-review-queue";

function item(over: Partial<CategoryReviewItem> = {}): CategoryReviewItem {
  return {
    id: "a", flow: "outflow", parent: "Operating Costs", head: "Owner Draw",
    label: "ACME — Owner Draw", reasons: ["keyword"], acted: false,
    record: {} as any, ...over,
  };
}

describe("renderCategoryReviewDrawer", () => {
  it("renders a Type and Group select per item with current values selected", () => {
    const el = document.createElement("div");
    renderCategoryReviewDrawer(el, { items: [item()], onRecategorize: vi.fn(), onConfirm: vi.fn(), onReset: vi.fn() });
    expect(el.querySelector<HTMLSelectElement>('[data-role="flow-select"]')?.value).toBe("outflow");
    expect(el.querySelector<HTMLSelectElement>('[data-role="group-select"]')?.value).toBe("Operating Costs");
  });

  it("calls onRecategorize when the group select changes", () => {
    const el = document.createElement("div");
    const onRecategorize = vi.fn();
    renderCategoryReviewDrawer(el, { items: [item()], onRecategorize, onConfirm: vi.fn(), onReset: vi.fn() });
    const group = el.querySelector<HTMLSelectElement>('[data-role="group-select"]')!;
    group.value = "Internal";
    group.dispatchEvent(new Event("change", { bubbles: true }));
    expect(onRecategorize).toHaveBeenCalledWith("a", { parent: "Internal" });
  });

  it("shows Reset only for acted rows", () => {
    const el = document.createElement("div");
    renderCategoryReviewDrawer(el, { items: [item({ acted: true })], onRecategorize: vi.fn(), onConfirm: vi.fn(), onReset: vi.fn() });
    expect(el.querySelector('[data-role="reset"]')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/category-review-drawer.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
// src/ui/category-review-drawer.ts
import type { CashFlow } from "../finance/types";
import type { ClassificationOverride } from "../finance/classification-overrides";
import type { CategoryReviewItem } from "./category-review-queue";

/** Canonical group choices the user can assign into (writes the internal taxonomy). */
const GROUP_OPTIONS = ["Income", "Operating Costs", "Delivery Costs", "Internal", "Financing"];
const FLOW_OPTIONS: { value: CashFlow; label: string }[] = [
  { value: "revenue", label: "Revenue (in)" },
  { value: "outflow", label: "Outflow (out)" },
];

export interface CategoryReviewDrawerProps {
  items: CategoryReviewItem[];
  onRecategorize: (id: string, override: ClassificationOverride) => void;
  onConfirm: (id: string) => void;
  onReset: (id: string) => void;
}

function flowOption(o: { value: CashFlow; label: string }, current: string): string {
  return `<option value="${o.value}"${o.value === current ? " selected" : ""}>${o.label}</option>`;
}
function groupOption(value: string, current: string): string {
  return `<option value="${value}"${value === current ? " selected" : ""}>${value}</option>`;
}

export function renderCategoryReviewDrawer(
  container: HTMLElement,
  props: CategoryReviewDrawerProps,
): void {
  const { items, onRecategorize, onConfirm, onReset } = props;

  container.innerHTML = items
    .map((it) => `
      <li class="category-review-item" data-id="${it.id}" data-acted="${it.acted}">
        <div class="category-review-item__label">${it.label}</div>
        <label>Type
          <select data-role="flow-select" aria-label="Type for ${it.label}">
            ${FLOW_OPTIONS.map((o) => flowOption(o, it.flow)).join("")}
          </select>
        </label>
        <label>Group
          <select data-role="group-select" aria-label="Group for ${it.label}">
            ${GROUP_OPTIONS.map((g) => groupOption(g, it.parent)).join("")}
          </select>
        </label>
        <button type="button" data-role="confirm">Looks right</button>
        ${it.acted ? '<button type="button" data-role="reset">Reset</button>' : ""}
      </li>`)
    .join("");

  container.querySelectorAll<HTMLLIElement>(".category-review-item").forEach((li) => {
    const id = li.dataset.id!;
    li.querySelector('[data-role="flow-select"]')!.addEventListener("change", (e) => {
      onRecategorize(id, { flow: (e.target as HTMLSelectElement).value as CashFlow });
    });
    li.querySelector('[data-role="group-select"]')!.addEventListener("change", (e) => {
      onRecategorize(id, { parent: (e.target as HTMLSelectElement).value });
    });
    li.querySelector('[data-role="confirm"]')!.addEventListener("click", () => onConfirm(id));
    li.querySelector('[data-role="reset"]')?.addEventListener("click", () => onReset(id));
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/category-review-drawer.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
npx tsc --noEmit
git add src/ui/category-review-drawer.ts src/ui/category-review-drawer.test.ts
git commit -m "feat(ui): category-review drawer with Type/Group selects (C2)"
```

---

## Task 9: Wire tiles + drawer into `main.ts`

**Files:**
- Modify: `src/main.ts`
- (No new unit test — covered by Task 10 e2e. Verify by build + manual run.)

> Read these in `main.ts` first: the `reviewExcludedItemIds` Set + its re-render path, the `renderImportResult` signature and its `reopenReviewItemId` option (shipped `cbd910c`), and the `deriveAuditedCockpit` call site (this is where the cockpit is actually built). Mirror the existing review-drawer pattern exactly.

- [ ] **Step 1: Add the overrides map + confirmed set beside the exclusion set**

Where `const reviewExcludedItemIds = new Set<string>()` is declared, add:

```typescript
import { type ClassificationOverride } from "./finance/classification-overrides";

const classificationOverrides = new Map<string, ClassificationOverride>();
const confirmedCategoryIds = new Set<string>(); // "Looks right" dismissals (no override)
```

- [ ] **Step 2: Pass overrides into `buildDashboardView` and compute the cockpit count**

At the `buildDashboardView({...})` call, add `overrides: classificationOverrides`. At the `deriveAuditedCockpit({...})` call, add:

```typescript
categoryReviewCount: data.categoryReview.items.filter(
  (i) => !i.acted && !confirmedCategoryIds.has(i.id),
).length,
```

- [ ] **Step 3: Render the two new tiles + drawer**

In the render path, beneath the 5 core KPI tiles, add a "trust/audit" cluster row (confirm layout against `DESIGN.md`; spec note: plan a second row, not an 8-wide strip):
- **Non-operating** tile: `data-tile="non-operating"`, value `cockpit.nonOperatingTotal` (formatted), hidden when `0`; click opens a lineage drawer fed by `data.summary.lineage.nonOperating` (reuse the existing lineage-drawer renderer used for other KPIs).
- **"⌗ N categories to review"** tile: `data-tile="category-review"`, value `cockpit.categoryReviewCount`, hidden when `0`; click opens the category-review drawer.

Render the category drawer body with:

```typescript
renderCategoryReviewDrawer(drawerBodyEl, {
  items: data.categoryReview.items.filter((i) => !confirmedCategoryIds.has(i.id)),
  onRecategorize,
  onConfirm,
  onReset,
});
```

- [ ] **Step 4: Wire handlers to mutate state + re-render with reopen**

```typescript
function rerenderDashboard(reopenCategoryItemId?: string) {
  const data = buildDashboardView({
    records: importedRecords,
    deriveExcludedTransactionIds,
    overrides: classificationOverrides,
  });
  renderImportResult(container, data, { reopenCategoryItemId });
}

const onRecategorize = (id: string, patch: ClassificationOverride) => {
  classificationOverrides.set(id, { ...classificationOverrides.get(id), ...patch });
  confirmedCategoryIds.delete(id); // acting supersedes a prior "looks right"
  rerenderDashboard(id);
};
const onConfirm = (id: string) => { confirmedCategoryIds.add(id); rerenderDashboard(id); };
const onReset = (id: string) => {
  classificationOverrides.delete(id);
  confirmedCategoryIds.delete(id);
  rerenderDashboard(id);
};
```

Extend `RenderImportResultOptions` with `reopenCategoryItemId?: string`, and after rendering reopen the category drawer + restore focus to that item's row — identical to the existing `reopenReviewItemId` handling. Use the row selector `[data-id="${id}"] [data-role="group-select"]` for focus restore.

> Naming: keep `importedRecords` / `container` / `deriveExcludedTransactionIds` consistent with whatever the existing `main.ts` review path already names them. Match, don't invent.

- [ ] **Step 5: Verify build + type + manual run**

```bash
npx tsc --noEmit
npm run build
```
Then run the app (`/run`), import the Agency sample, open "categories to review", change an Owner Draw row's Group to Internal, and confirm Runway rises + the Non-operating tile appears, the drawer reopens with focus on the row.

- [ ] **Step 6: Commit**

```bash
git add src/main.ts
git commit -m "feat(ui): wire non-operating + category-review tiles and drawer (C2)"
```

---

## Task 10: e2e — recategorize drives live re-derive

**Files:**
- Modify: `e2e/lineage-drawer.spec.ts`

> Read the existing spec first; reuse its sample-load + drawer helpers and the selectors established in `7be3afe`. Align all `data-*` selectors with what Task 9 emitted.

- [ ] **Step 1: Add the failing e2e test**

```typescript
// e2e/lineage-drawer.spec.ts (add a test)
test("recategorizing a row to Internal re-derives runway live", async ({ page }) => {
  await loadAgencySample(page); // existing helper

  const runwayBefore = await page.locator('[data-kpi="runway"] .kpi-value').innerText();

  await page.locator('[data-tile="category-review"]').click();
  const row = page.locator('.category-review-item').first();
  await row.locator('[data-role="group-select"]').selectOption("Internal");

  await expect(page.locator('[data-tile="non-operating"]')).toBeVisible();
  const runwayAfter = await page.locator('[data-kpi="runway"] .kpi-value').innerText();
  expect(runwayAfter).not.toBe(runwayBefore);
  await expect(row.locator('[data-role="group-select"]')).toBeFocused();
});
```

> Adjust selectors (`[data-kpi="runway"] .kpi-value`, tile selectors) to match the real markup from Task 9; add stable hooks there if missing.

- [ ] **Step 2: Run to verify it fails (selectors absent until Task 9 lands)**

Run: `npm run test:e2e`
Expected: FAIL.

- [ ] **Step 3: Reconcile selectors and make it pass**

Run: `npm run test:e2e`
Expected: PASS (desktop + mobile).

- [ ] **Step 4: Commit**

```bash
git add e2e/lineage-drawer.spec.ts
git commit -m "test(e2e): recategorize → live runway re-derive (C2)"
```

---

## Final verification

- [ ] `npx tsc --noEmit` → exit 0
- [ ] `npm test` → all pass (update any pre-existing golden fixtures touched by the new `nonOperating` / `nonOperatingTotal` fields)
- [ ] `npm run test:e2e` → pass desktop + mobile
- [ ] Manual: Agency sample, recategorize an owner draw → burn drops, runway rises, Non-operating tile shows the moved money (master-plan exit criterion)
- [ ] Update `docs/SESSION_HANDOFF_2026-05-31.md`: git state, what changed, verification run, next priority (Phase D — durable persistence of this same override map). Per the Vault Rule.

---

## Self-Review (against the spec)

**Spec coverage:**
- Decision 1 (full recategorization) → Tasks 2, 7, 8.
- Decision 2 (editable Type + Group; Type=`flow`, Group=`parent`) → Task 2 + Task 8 selects.
- Decision 3 (operating/non-operating split is net-new KPI logic) → Tasks 1, 3, 4.
- Decision 4 (detection = keyword OR group union) → Task 5.
- Decision 5 (separate "Category review" tile + drawer) → Tasks 6, 8, 9.
- Decision 6 (dedicated Non-operating tile + lineage) → Tasks 3/4 lineage, Task 9 tile + lineage drawer.
- Decision 7 (in-session only) → Task 9 `Map`; persistence deferred to Phase D (final checklist).
- Edge cases: absent-id override → Task 2; flow flip recompute (using `amount`) → Task 2; overrides+exclusions compose → Task 7 (overrides apply before C1 filter, single net effect); export uses overridden set → Task 7 (`data.records` = overridden).
- Universality: manual path writes canonical groups (Task 8 `GROUP_OPTIONS`); detection is suggestion-only (Task 5, never mutates math).
- Testing list → Tasks 2–10 incl. exit-criterion (Task 7) and e2e (Task 10).

**Spec corrections folded in (spec was wrong; code is source of truth):**
1. `MetricLineage` has **no** `entries`/`excluded` — it is `{metric,total,formula,inputs,recordIds}`. Non-operating reporting is a **separate `nonOperating` `MetricLineage`** built via the shared `metric()` helper (exported from `summary.ts` in Task 4), plus filtering operating rows out of operating totals. There is no per-metric `excluded[]` list.
2. The revenue flow value is `"revenue"`, not `"inflow"`; the magnitude field is `amount`, not `grossAmount`.

**Gap noted & handled:** "Looks right" needs session state to drop a row from the count without an override → `confirmedCategoryIds` Set added in Task 9.

**Type consistency:** `ClassificationOverride {flow?,parent?}`; `applyClassificationOverrides`; `buildCategoryReviewSummary`/`CategoryReviewSummary.items`; `CategoryReviewItem.{flow,parent,reasons,acted}`; `summary.totals.nonOperating`; `summary.lineage.nonOperating`; `cashHealth.nonOperatingTotal` + `cashHealth.lineage.nonOperating`; `cockpit.{nonOperatingTotal,categoryReviewCount}` — used identically across Tasks 1–10. `buildReviewSummary(records)` and `deriveAuditedCockpit({...})` call shapes match the real signatures.
