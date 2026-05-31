# C2 — Focused Category Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user recategorize transactions that distort operating KPIs (Type + Group) and re-derive the cockpit live, with non-operating money reported in its own tile — never silently zeroed.

**Architecture:** A pure, reversible in-session override layer (`Map<id, {flow?, parent?}>`) rewrites records before KPI math. `summarizeTransactions` and `calculateCashHealth` are extended to compute KPIs on **operating rows only** (rows whose `parent` is not in `NON_OPERATING_GROUPS`), emitting a parallel `nonOperating` lineage in the same pass. A keyword+group detection queue (sibling of `review-queue.ts`) surfaces suggestions; a new drawer (reusing the C1 slide-in/focus-trap) drives recategorize/confirm/reset, re-rendering via the `reopenReviewItemId` pattern shipped in `cbd910c`.

**Tech Stack:** TypeScript (strict), Vitest (unit + golden), Playwright (e2e). No new runtime deps.

**Design source:** `docs/superpowers/specs/2026-05-31-c2-focused-category-review-design.md`. Read it before starting.

**Grounding facts (verified against the tree at tip `51ddda0`):**
- `CashFlow = "inflow" | "outflow"` (`src/finance/types.ts`). The spec's "Type = revenue/outflow" means `flow = inflow/outflow`. Use `inflow`/`outflow` everywhere.
- `TransactionRecord` fields used here: `id, flow, parent, head, subcategory, counterparty, signedNet, grossAmount, date, description` (`src/finance/types.ts:3`).
- `MetricLineage` already has an optional `excluded?: LineageEntry[]` field — no type change needed for operating `excluded[]`.
- `summarizeTransactions(records)` and `calculateCashHealth(records)` both key **only** off `record.flow` today; `parent` never touches the math.
- `buildDashboardView(input)` filters `activeRecords` via a `deriveExcludedTransactionIds` callback, then summarizes (`src/finance/dashboard-view.ts`).
- `main.ts` holds `const reviewExcludedItemIds = new Set<string>()`, calls `buildDashboardView`, and re-renders through `renderImportResult(container, data, { reopenReviewItemId })`.
- `deriveAuditedCockpit` is a thin reader producing `CockpitKpi[] + needsReviewCount`. **Do not add parallel KPI math there** (eng-review rule). All new totals come from `summary`/`cashHealth`.

**Conventions:** money is integer minor units. Lineage entries use `amount: record.signedNet`. Run `npx tsc --noEmit` before every commit; never commit with a type error.

---

## File Structure

**Create:**
- `src/finance/classification-overrides.ts` — override type + `applyClassificationOverrides`.
- `src/finance/classification-overrides.test.ts`
- `src/ui/category-review-queue.ts` — `buildCategoryReviewSummary` (detection).
- `src/ui/category-review-queue.test.ts`
- `src/ui/category-review-drawer.ts` — drawer markup + binding.
- `src/ui/category-review-drawer.test.ts`

**Modify:**
- `src/finance/types.ts` — add `nonOperating` to `SummaryLineage`; add `nonOperating` to `CashHealthResult.lineage` (+ a `nonOperatingTotal` field).
- `src/finance/operating-groups.ts` — **create** the shared `NON_OPERATING_GROUPS` constant + `isOperating(record)` helper (its own file so summary, cash-health, and the queue share one source of truth).
- `src/finance/summary.ts` — operating-only totals + `nonOperating` lineage + operating `excluded[]`.
- `src/finance/cash-health.ts` — operating-only burn/runway + `nonOperating` lineage.
- `src/finance/cockpit-kpis.ts` — `AuditedCockpit` gains `nonOperatingTotal` + `categoryReviewCount`.
- `src/finance/dashboard-view.ts` — thread overrides + category-review summary through.
- `src/main.ts` — overrides `Map`, bind drawer actions, re-render + reopen, export uses overridden records.
- `e2e/lineage-drawer.spec.ts` — recategorize → live re-derive assertion.

---

## Task 1: Operating-group taxonomy constant

**Files:**
- Create: `src/finance/operating-groups.ts`
- Test: covered indirectly via Task 2/3 (no standalone test — it is a constant + one-line predicate)

- [ ] **Step 1: Create the constant and helper**

```typescript
// src/finance/operating-groups.ts
import type { TransactionRecord } from "./types";

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
git commit -F .git/COMMIT_C2_T1.txt
```
Commit message: `feat(finance): add operating/non-operating group taxonomy`

> Note (Windows/Bash tool): write multiline commit bodies to a file and use `-F`, never a PowerShell heredoc.

---

## Task 2: Classification override layer

**Files:**
- Create: `src/finance/classification-overrides.ts`
- Test: `src/finance/classification-overrides.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/finance/classification-overrides.test.ts
import { describe, it, expect } from "vitest";
import { applyClassificationOverrides } from "./classification-overrides";
import type { TransactionRecord } from "./types";

function rec(over: Partial<TransactionRecord>): TransactionRecord {
  return {
    id: "t1", sourceRow: 1, date: "2026-01-01", description: "d", counterparty: "c",
    flow: "outflow", parent: "Operating Costs", head: "Misc", subcategory: "",
    signedNet: -5000, grossAmount: 5000, currency: "PKR", raw: {}, ...over,
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
    const out = applyClassificationOverrides(
      records,
      new Map([["a", { parent: "Financing" }]]),
    );
    expect(out[0].parent).toBe("Financing");
    expect(out[0].flow).toBe("outflow");
    expect(out[0].signedNet).toBe(-5000);
  });

  it("recomputes signedNet when flow flips outflow -> inflow", () => {
    const records = [rec({ id: "a", flow: "outflow", signedNet: -5000, grossAmount: 5000 })];
    const out = applyClassificationOverrides(records, new Map([["a", { flow: "inflow" }]]));
    expect(out[0].flow).toBe("inflow");
    expect(out[0].signedNet).toBe(5000);
  });

  it("recomputes signedNet when flow flips inflow -> outflow", () => {
    const records = [rec({ id: "a", flow: "inflow", signedNet: 5000, grossAmount: 5000 })];
    const out = applyClassificationOverrides(records, new Map([["a", { flow: "outflow" }]]));
    expect(out[0].signedNet).toBe(-5000);
  });

  it("ignores overrides whose id is absent from the record set", () => {
    const records = [rec({ id: "a" })];
    const out = applyClassificationOverrides(records, new Map([["ghost", { flow: "inflow" }]]));
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
 * When flow flips, signedNet is recomputed from grossAmount so account
 * balances stay correct (inflow = +gross, outflow = -gross).
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
      next.signedNet = override.flow === "inflow" ? record.grossAmount : -record.grossAmount;
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
git commit -F .git/COMMIT_C2_T2.txt
```
Commit message: `feat(finance): in-session classification override layer (C2)`

---

## Task 3: Operating/non-operating split in `summarizeTransactions`

**Files:**
- Modify: `src/finance/types.ts` (extend `SummaryLineage`)
- Modify: `src/finance/summary.ts`
- Test: `src/finance/summary.test.ts` (add cases; create if absent)

- [ ] **Step 1: Extend the lineage type**

In `src/finance/types.ts`, change `SummaryLineage`:

```typescript
export interface SummaryLineage {
  inflow: MetricLineage;
  outflow: MetricLineage;
  net: MetricLineage;
  /** Money in Internal/Financing groups, pulled out of operating KPIs. */
  nonOperating: MetricLineage;
}
```

Add a field to `FinanceTotals`:

```typescript
export interface FinanceTotals {
  inflow: number;
  outflow: number;
  net: number;
  transactionCount: number;
  /** Signed sum of non-operating rows (informational; not part of net). */
  nonOperating: number;
}
```

- [ ] **Step 2: Write the failing test**

```typescript
// src/finance/summary.test.ts  (add these; keep existing tests)
import { describe, it, expect } from "vitest";
import { summarizeTransactions } from "./summary";
import type { TransactionRecord } from "./types";

function rec(over: Partial<TransactionRecord>): TransactionRecord {
  return {
    id: "x", sourceRow: 1, date: "2026-01-01", description: "d", counterparty: "c",
    flow: "outflow", parent: "Operating Costs", head: "Misc", subcategory: "",
    signedNet: -1000, grossAmount: 1000, currency: "PKR", raw: {}, ...over,
  };
}

describe("summarizeTransactions operating/non-operating split", () => {
  it("excludes Internal/Financing rows from inflow/outflow totals", () => {
    const records = [
      rec({ id: "op", flow: "outflow", parent: "Operating Costs", signedNet: -1000, grossAmount: 1000 }),
      rec({ id: "fin", flow: "inflow", parent: "Financing", signedNet: 5000, grossAmount: 5000 }),
    ];
    const s = summarizeTransactions(records);
    expect(s.totals.inflow).toBe(0);
    expect(s.totals.outflow).toBe(1000);
    expect(s.totals.nonOperating).toBe(5000);
  });

  it("lists pulled rows in lineage.nonOperating and in operating excluded[]", () => {
    const records = [
      rec({ id: "op", parent: "Operating Costs" }),
      rec({ id: "intl", flow: "outflow", parent: "Internal", signedNet: -2000, grossAmount: 2000 }),
    ];
    const s = summarizeTransactions(records);
    expect(s.lineage.nonOperating.entries.map((e) => e.id)).toEqual(["intl"]);
    expect(s.lineage.outflow.excluded?.map((e) => e.id)).toEqual(["intl"]);
  });

  it("matches group names case-insensitively", () => {
    const records = [rec({ id: "fin", flow: "inflow", parent: "financing", signedNet: 100, grossAmount: 100 })];
    const s = summarizeTransactions(records);
    expect(s.totals.inflow).toBe(0);
    expect(s.totals.nonOperating).toBe(100);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/finance/summary.test.ts`
Expected: FAIL — `totals.nonOperating` undefined / `lineage.nonOperating` undefined.

- [ ] **Step 4: Implement the split in `summarizeTransactions`**

In `src/finance/summary.ts`, import the helper and partition inside the existing single loop. Add near the top of the function:

```typescript
import { isOperating } from "./operating-groups";
```

Add accumulators beside `totalsBucket`:

```typescript
  const nonOperatingBucket = makeBucket();
  let nonOperatingSigned = 0;
```

Inside the `for (const record of records)` loop, **guard the operating accumulation**. Replace the opening of the loop body (the inflow/outflow bucket push) with:

```typescript
    const entry = {
      id: record.id,
      date: record.date,
      description: record.description,
      amount: record.signedNet,
      flow: record.flow,
    };

    if (!isOperating(record)) {
      nonOperatingBucket.total += record.grossAmount;
      nonOperatingBucket.count += 1;
      nonOperatingBucket.entries.push(entry);
      nonOperatingSigned += record.signedNet;
      continue; // non-operating rows never feed operating totals/rollups/monthly
    }

    const bucket = record.flow === "inflow" ? totalsBucket.inflow : totalsBucket.outflow;
    bucket.total += record.grossAmount;
    bucket.count += 1;
    bucket.entries.push(entry);
```

Reuse `entry` for the existing `parent`/`head`/`monthly` pushes (replace their inline object literals with `entry`) so non-operating rows are also absent from those rollups.

Then extend `totals` and `lineage` in the return path:

```typescript
  const totals: FinanceTotals = {
    inflow: inflowTotal,
    outflow: outflowTotal,
    net: netTotal,
    transactionCount: records.length,
    nonOperating: nonOperatingSigned,
  };
```

```typescript
  const lineage: SummaryLineage = {
    inflow: {
      metric: "inflow",
      total: inflowTotal,
      entries: totalsBucket.inflow.entries,
      excluded: nonOperatingBucket.entries.filter((e) => e.flow === "inflow"),
    },
    outflow: {
      metric: "outflow",
      total: outflowTotal,
      entries: totalsBucket.outflow.entries,
      excluded: nonOperatingBucket.entries.filter((e) => e.flow === "outflow"),
    },
    net: {
      metric: "net",
      total: netTotal,
      entries: [...totalsBucket.inflow.entries, ...totalsBucket.outflow.entries],
    },
    nonOperating: {
      metric: "nonOperating",
      total: nonOperatingSigned,
      entries: nonOperatingBucket.entries,
    },
  };
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/finance/summary.test.ts`
Expected: PASS (new + existing). If pre-existing golden tests assert `totals` shape with `toEqual`, update them to include `nonOperating: 0` for all-operating fixtures.

- [ ] **Step 6: Full type + suite check, then commit**

```bash
npx tsc --noEmit
npx vitest run src/finance
git add src/finance/types.ts src/finance/summary.ts src/finance/summary.test.ts
git commit -F .git/COMMIT_C2_T3.txt
```
Commit message: `feat(finance): operating vs non-operating split in summary (C2)`

---

## Task 4: Operating-only burn/runway in `calculateCashHealth`

**Files:**
- Modify: `src/finance/types.ts` (extend `CashHealthResult`)
- Modify: `src/finance/cash-health.ts`
- Test: `src/finance/cash-health.test.ts` (add cases)

- [ ] **Step 1: Extend `CashHealthResult`**

In `src/finance/types.ts`, inside `CashHealthResult` add:

```typescript
  /** Signed sum of non-operating rows, reported separately. */
  nonOperatingTotal: number;
```

and inside its `lineage` object type add `nonOperating: MetricLineage`.

- [ ] **Step 2: Write the failing test (exit-criterion math)**

```typescript
// src/finance/cash-health.test.ts (add)
import { describe, it, expect } from "vitest";
import { calculateCashHealth } from "./cash-health";
import type { TransactionRecord } from "./types";

function rec(over: Partial<TransactionRecord>): TransactionRecord {
  return {
    id: "x", sourceRow: 1, date: "2026-01-01", description: "d", counterparty: "c",
    flow: "outflow", parent: "Operating Costs", head: "Misc", subcategory: "",
    signedNet: -1000, grossAmount: 1000, currency: "PKR", raw: {}, ...over,
  };
}

describe("calculateCashHealth operating split", () => {
  it("excludes non-operating outflow from burn, raising runway", () => {
    // 1 month span; one operating burn + one owner-draw now classed Internal.
    const base = [
      rec({ id: "in", flow: "inflow", parent: "Income", signedNet: 30000, grossAmount: 30000, date: "2026-01-01" }),
      rec({ id: "burn", flow: "outflow", parent: "Operating Costs", signedNet: -10000, grossAmount: 10000, date: "2026-01-31" }),
      rec({ id: "draw", flow: "outflow", parent: "Internal", signedNet: -10000, grossAmount: 10000, date: "2026-01-15" }),
    ];
    const h = calculateCashHealth(base);
    // operating outflow = 10000 (draw excluded); operating inflow = 30000
    expect(h.outflowTotal).toBe(10000);
    expect(h.nonOperatingTotal).toBe(-10000);
    expect(h.averageMonthlyBurn).toBeLessThan(20000); // would be ~20k if draw counted
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/finance/cash-health.test.ts`
Expected: FAIL — `nonOperatingTotal` undefined and burn includes the draw.

- [ ] **Step 4: Implement**

In `src/finance/cash-health.ts`:

```typescript
import { isOperating } from "./operating-groups";
```

In the empty-records early return, add `nonOperatingTotal: 0` and `nonOperating: { metric: "nonOperating", total: 0, entries: [] }` to `lineage`.

In the accumulation loop, skip non-operating rows from inflow/outflow and collect them separately. Add before the loop:

```typescript
  let nonOperatingTotal = 0;
  const nonOperatingEntries: LineageEntry[] = [];
```

At the top of the loop body, before the `if (record.flow === "inflow")` branch:

```typescript
    if (!isOperating(record)) {
      nonOperatingTotal += record.signedNet;
      nonOperatingEntries.push({
        id: record.id, date: record.date, description: record.description,
        amount: record.signedNet, flow: record.flow,
      });
      // still extend min/max date so the month span reflects all activity
      if (record.date < minDate) minDate = record.date;
      if (record.date > maxDate) maxDate = record.date;
      continue;
    }
```

Add `nonOperatingTotal` to the return object and `nonOperating: { metric: "nonOperating", total: nonOperatingTotal, entries: nonOperatingEntries }` to `lineage`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/finance/cash-health.test.ts`
Expected: PASS. Update any pre-existing `toEqual` golden to include `nonOperatingTotal: 0`.

- [ ] **Step 6: Commit**

```bash
npx tsc --noEmit
git add src/finance/types.ts src/finance/cash-health.ts src/finance/cash-health.test.ts
git commit -F .git/COMMIT_C2_T4.txt
```
Commit message: `feat(finance): operating-only burn/runway + non-operating total (C2)`

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
import type { TransactionRecord } from "../finance/types";

function rec(over: Partial<TransactionRecord>): TransactionRecord {
  return {
    id: "x", sourceRow: 1, date: "2026-01-01", description: "d", counterparty: "c",
    flow: "outflow", parent: "Operating Costs", head: "Misc", subcategory: "",
    signedNet: -1000, grossAmount: 1000, currency: "PKR", raw: {}, ...over,
  };
}

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
    const r = rec({ id: "a", parent: "Operating Costs", head: "Rent", counterparty: "Landlord" });
    const s = buildCategoryReviewSummary({ records: [r], overrides: new Map() });
    expect(s.items).toEqual([]);
  });

  it("marks a flagged row as acted when an override exists", () => {
    const r = rec({ id: "a", parent: "Financing" });
    const s = buildCategoryReviewSummary({
      records: [r],
      overrides: new Map([["a", { parent: "Income" }]]),
    });
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
git commit -F .git/COMMIT_C2_T5.txt
```
Commit message: `feat(ui): category-review detection queue (keyword OR group) (C2)`

---

## Task 6: Surface counts in `deriveAuditedCockpit`

**Files:**
- Modify: `src/finance/cockpit-kpis.ts`
- Test: `src/finance/cockpit-kpis.test.ts` (add cases)

> `deriveAuditedCockpit` stays a thin reader. It only *reads* `summary.totals.nonOperating` and a passed-in category-review count; it computes no KPI math.

- [ ] **Step 1: Write the failing test**

```typescript
// src/finance/cockpit-kpis.test.ts (add)
import { describe, it, expect } from "vitest";
import { deriveAuditedCockpit } from "./cockpit-kpis";

// Build minimal summary/cashHealth/reviewSummary stubs matching their interfaces,
// or import existing helpers already used by this test file.

describe("deriveAuditedCockpit non-operating + category review", () => {
  it("exposes nonOperatingTotal and categoryReviewCount", () => {
    const cockpit = deriveAuditedCockpit({
      summary: { totals: { nonOperating: 5000 } } as any,
      cashHealth: {} as any,
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

In `src/finance/cockpit-kpis.ts`, extend the interfaces and reader:

```typescript
export interface AuditedCockpit {
  kpis: CockpitKpi[];
  needsReviewCount: number;
  nonOperatingTotal: number;
  categoryReviewCount: number;
}

export interface DeriveAuditedCockpitInput {
  summary: FinanceSummary;
  cashHealth: CashHealthResult;
  reviewSummary: ReviewSummary;
  categoryReviewCount?: number;
}
```

In the return statement add:

```typescript
  return {
    kpis,
    needsReviewCount: /* existing expression */,
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
git commit -F .git/COMMIT_C2_T6.txt
```
Commit message: `feat(finance): expose non-operating + category-review counts on cockpit (C2)`

---

## Task 7: Thread overrides through `buildDashboardView`

**Files:**
- Modify: `src/finance/dashboard-view.ts`
- Test: `src/finance/dashboard-view.test.ts` (add cases)

- [ ] **Step 1: Write the failing test (exit-criterion at the integration seam)**

```typescript
// src/finance/dashboard-view.test.ts (add)
import { describe, it, expect } from "vitest";
import { buildDashboardView } from "./dashboard-view";
import type { TransactionRecord } from "./types";

function rec(over: Partial<TransactionRecord>): TransactionRecord {
  return {
    id: "x", sourceRow: 1, date: "2026-01-01", description: "d", counterparty: "c",
    flow: "outflow", parent: "Operating Costs", head: "Misc", subcategory: "",
    signedNet: -1000, grossAmount: 1000, currency: "PKR", raw: {}, ...over,
  };
}

describe("buildDashboardView classification overrides", () => {
  const records = [
    rec({ id: "in", flow: "inflow", parent: "Income", signedNet: 30000, grossAmount: 30000, date: "2026-01-01" }),
    rec({ id: "burn", flow: "outflow", parent: "Operating Costs", signedNet: -10000, grossAmount: 10000, date: "2026-01-31" }),
    rec({ id: "draw", flow: "outflow", parent: "Operating Costs", head: "Owner Draw", signedNet: -10000, grossAmount: 10000, date: "2026-01-15" }),
  ];

  it("recategorizing an owner draw to Internal lowers burn and raises runway", () => {
    const before = buildDashboardView({ records });
    const after = buildDashboardView({
      records,
      overrides: new Map([["draw", { parent: "Internal" }]]),
    });
    expect(after.cashHealth.averageMonthlyBurn).toBeLessThan(before.cashHealth.averageMonthlyBurn);
    const beforeRunway = before.cashHealth.runwayMonths ?? 0;
    const afterRunway = after.cashHealth.runwayMonths ?? 0;
    expect(afterRunway).toBeGreaterThan(beforeRunway);
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

Edit `src/finance/dashboard-view.ts`:

```typescript
import { applyClassificationOverrides, type ClassificationOverride } from "./classification-overrides";
import { buildCategoryReviewSummary, type CategoryReviewSummary } from "../ui/category-review-queue";
```

Extend the input/output interfaces:

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
  cockpit: AuditedCockpit;
  categoryReview: CategoryReviewSummary;
  excludedTransactionIds?: string[];
}
```

Rewrite the body so overrides apply **first** (so detection, exclusion derivation, and KPI math all see overridden values), then C1 exclusion filters:

```typescript
export function buildDashboardView(input: DashboardViewInput): DashboardViewData {
  const { records, deriveExcludedTransactionIds, overrides } = input;

  // 1. Apply reclassification overrides (new array; signedNet recomputed on flow flip).
  const overridden = applyClassificationOverrides(records, overrides ?? new Map());

  // 2. C1 review detection + exclusion (runs on overridden rows).
  const reviewSummary = buildReviewSummary({ records: overridden });
  const excludedTransactionIds = deriveExcludedTransactionIds
    ? deriveExcludedTransactionIds(reviewSummary)
    : [];
  const excludedSet = new Set(excludedTransactionIds);
  const activeRecords = overridden.filter((r) => !excludedSet.has(r.id));

  // 3. KPI math on active (post-override, post-exclusion) rows.
  const summary = summarizeTransactions(activeRecords);
  const cashHealth = calculateCashHealth(activeRecords);

  // 4. C2 category-review detection (over overridden full set so acted rows stay listed).
  const categoryReview = buildCategoryReviewSummary({
    records: overridden,
    overrides: overrides ?? new Map(),
  });

  const cockpit = deriveAuditedCockpit({
    summary,
    cashHealth,
    reviewSummary,
    categoryReviewCount: categoryReview.items.filter((i) => !i.acted).length,
  });

  return {
    records: overridden,
    activeRecords,
    summary,
    cashHealth,
    reviewSummary,
    cockpit,
    categoryReview,
    excludedTransactionIds,
  };
}
```

> Decision: `data.records` is the overridden set so all downstream consumers (reviewer/JSON export, drawer rows) read post-override values — this satisfies the spec's "export must use the overridden record set."

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/finance/dashboard-view.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npx tsc --noEmit
npx vitest run src/finance
git add src/finance/dashboard-view.ts src/finance/dashboard-view.test.ts
git commit -F .git/COMMIT_C2_T7.txt
```
Commit message: `feat(finance): thread classification overrides through buildDashboardView (C2)`

---

## Task 8: Category-review drawer (markup + binding)

**Files:**
- Create: `src/ui/category-review-drawer.ts`
- Test: `src/ui/category-review-drawer.test.ts`

> Read `src/ui/dashboard-cockpit-actions.ts` first to reuse its slide-in panel + focus-trap helpers rather than re-implementing them. Read `DESIGN.md` for chip/surface/44px-target rules before writing markup.

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
    const flow = el.querySelector<HTMLSelectElement>('[data-role="flow-select"]');
    const group = el.querySelector<HTMLSelectElement>('[data-role="group-select"]');
    expect(flow?.value).toBe("outflow");
    expect(group?.value).toBe("Operating Costs");
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
const FLOW_OPTIONS: CashFlow[] = ["inflow", "outflow"];

export interface CategoryReviewDrawerProps {
  items: CategoryReviewItem[];
  onRecategorize: (id: string, override: ClassificationOverride) => void;
  onConfirm: (id: string) => void;
  onReset: (id: string) => void;
}

function option(value: string, current: string): string {
  const sel = value === current ? " selected" : "";
  return `<option value="${value}"${sel}>${value}</option>`;
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
            ${FLOW_OPTIONS.map((f) => option(f, it.flow)).join("")}
          </select>
        </label>
        <label>Group
          <select data-role="group-select" aria-label="Group for ${it.label}">
            ${GROUP_OPTIONS.map((g) => option(g, it.parent)).join("")}
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
git commit -F .git/COMMIT_C2_T8.txt
```
Commit message: `feat(ui): category-review drawer with Type/Group selects (C2)`

---

## Task 9: Wire tiles + drawer into `main.ts`

**Files:**
- Modify: `src/main.ts`
- (No new unit test — covered by Task 10 e2e. Verify by `npm run build`/manual run.)

> Read the existing `renderImportResult`, `bindReviewActions`, `setupImport`, and the `reviewExcludedItemIds` Set in `main.ts` first, plus how `RenderImportResultOptions.reopenReviewItemId` is threaded (shipped in `cbd910c`). Mirror that pattern exactly.

- [ ] **Step 1: Add the overrides map beside the exclusion set**

In `setupImport` (where `const reviewExcludedItemIds = new Set<string>()` lives), add:

```typescript
const classificationOverrides = new Map<string, ClassificationOverride>();
```
and import `ClassificationOverride` from `./finance/classification-overrides`.

- [ ] **Step 2: Pass overrides into `buildDashboardView`**

At the existing `buildDashboardView({ records, deriveExcludedTransactionIds })` call site add `overrides: classificationOverrides`.

- [ ] **Step 3: Render the two new tiles + drawer in `renderImportResult`**

Add a "trust/audit" cluster row beneath the 5 core KPIs (per spec layout note; confirm against `DESIGN.md`). Render:
- A **Non-operating** tile showing `data.cockpit.nonOperatingTotal` (formatted), hidden when `0`; clicking opens a lineage drawer fed by `data.summary.lineage.nonOperating`.
- A **"⌗ N categories to review"** tile showing `data.cockpit.categoryReviewCount`, hidden when `0`; clicking opens the category-review drawer.

Render the drawer body via `renderCategoryReviewDrawer(drawerEl, { items: data.categoryReview.items, onRecategorize, onConfirm, onReset })`.

- [ ] **Step 4: Wire the action handlers to mutate overrides + re-render with reopen**

```typescript
function rerender(reopenCategoryItemId?: string) {
  const data = buildDashboardView({
    records: importedRecords,
    deriveExcludedTransactionIds,
    overrides: classificationOverrides,
  });
  renderImportResult(container, data, { reopenCategoryItemId });
}

const onRecategorize = (id: string, patch: ClassificationOverride) => {
  classificationOverrides.set(id, { ...classificationOverrides.get(id), ...patch });
  rerender(id);
};
const onConfirm = (id: string) => { /* dismiss only: mark confirmed, no math change */ rerender(id); };
const onReset = (id: string) => { classificationOverrides.delete(id); rerender(id); };
```

Extend `RenderImportResultOptions` with `reopenCategoryItemId?: string` and, after rendering, reopen the category drawer + restore focus to that item — identical to the `reopenReviewItemId` handling already in place.

> "Looks right" (confirm) needs a dismissed-set so a confirmed-but-unchanged row drops out of the count without an override. Add `const confirmedCategoryIds = new Set<string>()`; `onConfirm` adds to it; subtract confirmed ids from `categoryReviewCount` and filter them out of the drawer list. (Keep this in `main.ts`; it is session UI state, not KPI math.)

- [ ] **Step 5: Verify build + type + manual run**

```bash
npx tsc --noEmit
npm run build
```
Then run the app (`/run`), import the Agency sample, open "categories to review", change an Owner Draw row's Group to Internal, and confirm Runway rises + a Non-operating tile appears. Expected: live re-derive, drawer reopens with focus on the row.

- [ ] **Step 6: Commit**

```bash
git add src/main.ts
git commit -F .git/COMMIT_C2_T9.txt
```
Commit message: `feat(ui): wire non-operating + category-review tiles and drawer (C2)`

---

## Task 10: e2e — recategorize drives live re-derive

**Files:**
- Modify: `e2e/lineage-drawer.spec.ts`

> Read the existing spec first; reuse its sample-load + drawer-open helpers and the selectors established in `7be3afe`.

- [ ] **Step 1: Add the failing e2e test**

```typescript
// e2e/lineage-drawer.spec.ts (add a test)
test("recategorizing a row to Internal re-derives runway live", async ({ page }) => {
  await loadAgencySample(page); // existing helper

  const runwayBefore = await page.locator('[data-kpi="runway"] .kpi-value').innerText();

  await page.locator('[data-tile="category-review"]').click();
  const row = page.locator('.category-review-item').first();
  await row.locator('[data-role="group-select"]').selectOption("Internal");

  // drawer reopens; KPI re-derives
  await expect(page.locator('[data-tile="non-operating"]')).toBeVisible();
  const runwayAfter = await page.locator('[data-kpi="runway"] .kpi-value').innerText();
  expect(runwayAfter).not.toBe(runwayBefore);
  await expect(row.locator('[data-role="group-select"]')).toBeFocused();
});
```

> Adjust `data-*` selectors to match whatever Task 9 emitted; keep them stable (add them if missing).

- [ ] **Step 2: Run to verify it fails (selectors absent)**

Run: `npm run test:e2e`
Expected: FAIL until Task 9 selectors exist.

- [ ] **Step 3: Reconcile selectors and make it pass**

Ensure Task 9 markup uses `data-tile="category-review"`, `data-tile="non-operating"`, `data-kpi="runway"`, and the drawer item selectors from Task 8. Re-run.

Run: `npm run test:e2e`
Expected: PASS (desktop + mobile).

- [ ] **Step 4: Commit**

```bash
git add e2e/lineage-drawer.spec.ts src/main.ts
git commit -F .git/COMMIT_C2_T10.txt
```
Commit message: `test(e2e): recategorize → live runway re-derive (C2)`

---

## Final verification

- [ ] `npx tsc --noEmit` → exit 0
- [ ] `npm test` → all pass (update any pre-existing golden fixtures touched by the new `nonOperating`/`nonOperatingTotal` fields)
- [ ] `npm run test:e2e` → pass desktop + mobile
- [ ] Manual: Agency sample, recategorize an owner draw → burn drops, runway rises, Non-operating tile shows the moved money. (Exit criterion from the master plan.)
- [ ] Update `docs/SESSION_HANDOFF_2026-05-31.md`: git state, what changed, verification run, next priority (Phase D — durable persistence of this same override map). Per the Vault Rule.

---

## Self-Review (against the spec)

**Spec coverage:**
- Decision 1 (full recategorization) → Tasks 2, 7, 8.
- Decision 2 (editable Type + Group) → Task 8 selects; Task 2 override applies `flow`/`parent`.
- Decision 3 (operating/non-operating split is net-new KPI logic) → Tasks 1, 3, 4.
- Decision 4 (detection = keyword + group union) → Task 5.
- Decision 5 (separate "Category review" tile + drawer) → Tasks 6, 8, 9.
- Decision 6 (dedicated Non-operating tile + lineage) → Tasks 3/4 lineage, Task 9 tile.
- Decision 7 (in-session only) → Task 9 `Map`; persistence deferred to Phase D (final checklist).
- Field mapping (Type→flow, Group→parent) → Tasks 1, 8.
- Edge cases: absent-id override → Task 2 test; flow flip recompute → Task 2; overrides+exclusions compose → Task 7 (overrides apply before C1 filter); export uses overridden set → Task 7 (`data.records` = overridden); C1/C2 single net effect → Task 7 ordering.
- Universality: manual path writes canonical groups (Task 8 `GROUP_OPTIONS`); detection is suggestion-only (Task 5, never mutates math) — matches spec's universality section.
- Testing list → Tasks 2–10 mirror each bullet incl. exit-criterion test (Task 7) and e2e (Task 10).

**Gap noted & handled:** the spec's "Looks right" confirm needs session state to drop a row from the count without an override — added explicitly in Task 9 Step 4.

**Type consistency:** `ClassificationOverride {flow?,parent?}`, `applyClassificationOverrides`, `buildCategoryReviewSummary`/`CategoryReviewSummary.items`, `CategoryReviewItem.{flow,parent,reasons,acted}`, `summary.totals.nonOperating`, `lineage.nonOperating`, `cashHealth.nonOperatingTotal`, `cockpit.{nonOperatingTotal,categoryReviewCount}` are used identically across Tasks 1–10.
