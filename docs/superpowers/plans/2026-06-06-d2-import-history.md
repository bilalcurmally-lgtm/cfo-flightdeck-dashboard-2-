# D2 — Import History + "What Changed" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist a per-import history and, on a recognized re-import, lead the cockpit with a dismissible "what changed since last import" strip; add a panel to browse past imports.

**Architecture:** Extend `WorkspaceSnapshot` to v2 (`imports: ImportSnapshot[]`) with forward-migration. A new pure `import-history.ts` computes history mutations + diffs (building on the existing `ledger-diff.ts`). `main.ts` captures an `ImportSnapshot` per import and renders the strip; a new panel browses history. Pure logic is fully unit-tested; wiring is covered by an e2e reload test.

**Tech Stack:** TypeScript, Vite, vitest (unit), Playwright (e2e). No new runtime deps.

**Spec:** `docs/superpowers/specs/2026-06-06-d2-import-history-design.md`

**Multi-agent note:** S1+S2 (pure) and the S4/S5 render functions suit Grok briefs; integration tasks (marked **[integration]**) are claude-opus. Golden signature values in `txn-signature.test.ts` must remain byte-identical throughout.

---

## File structure

- `src/workspace/import-history.ts` — **new.** `ImportSnapshot` type + pure history/diff functions. Dependency-free (consumes `string[]` + `SignedRow` from `ledger-diff`/`sign-ledger`; never imports DOM or `persistence-bridge`).
- `src/workspace/import-history.test.ts` — **new.** Unit tests.
- `src/workspace/workspace-store.ts` — **modify.** v2 snapshot + migration + `addImport` accessor.
- `src/workspace/indexeddb-workspace-store.ts` — **modify.** Implement `addImport` in the write-through wrapper.
- `src/workspace/project-file.ts` — **modify.** Migrate v1→v2; validate `imports`.
- `src/ui/welcome-back-strip.ts` — **new.** Pure render of the strip.
- `src/ui/import-history-panel.ts` — **new.** Pure render of the history list.
- `src/main.ts` — **modify.** Capture on import; render strip; wire history panel.
- `src/ui/app-shell.ts` — **modify.** History toggle button.
- `e2e/import-history.spec.ts` — **new.** Reload/strip/panel e2e.

---

## Slice 1 (S1) — WorkspaceSnapshot v2 + migration

### Task 1.1: Add the `ImportSnapshot` type

**Files:**
- Create: `src/workspace/import-history.ts`

- [ ] **Step 1: Create the file with the type only**

```ts
// src/workspace/import-history.ts

/** A point-in-time record of one import, for history + "what changed" diffs. */
export interface ImportSnapshot {
  importedAt: string; // ISO timestamp
  sourceName: string;
  signatureSet: string[]; // txn signatures present (ledger order)
  kpiSnapshot: Record<string, number | null>; // keys: runwayMonths, revenue, outflow, netCash, transactionCount
  reviewItemSignatures: string[]; // stable review-item keys (precomputed by caller)
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/workspace/import-history.ts
git commit -m "feat(workspace): ImportSnapshot type for D2 history"
```

### Task 1.2: WorkspaceSnapshot v2 + load migration

**Files:**
- Modify: `src/workspace/workspace-store.ts`
- Test: `src/workspace/workspace-store.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/workspace/workspace-store.test.ts`:

```ts
import { WORKSPACE_SNAPSHOT_VERSION } from "./workspace-store";

describe("workspace-store v2 migration", () => {
  it("creates v2 snapshots with an empty imports array", () => {
    const store = createInMemoryWorkspaceStore();
    const snap = store.snapshot();
    expect(snap.version).toBe(2);
    expect(snap.imports).toEqual([]);
  });

  it("migrates a v1 snapshot (no imports, version 1) on load", () => {
    const store = createInMemoryWorkspaceStore();
    // Cast: a real v1 file has no `imports` and version 1.
    store.load({ version: 1, categoryOverrides: {}, decisions: {} } as never);
    const snap = store.snapshot();
    expect(snap.version).toBe(WORKSPACE_SNAPSHOT_VERSION);
    expect(snap.imports).toEqual([]);
  });

  it("preserves an existing imports array on load", () => {
    const store = createInMemoryWorkspaceStore();
    const imp = {
      importedAt: "2026-01-01T00:00:00.000Z",
      sourceName: "x.csv",
      signatureSet: ["txn_a"],
      kpiSnapshot: { runwayMonths: 5 },
      reviewItemSignatures: [],
    };
    store.load({ version: 2, categoryOverrides: {}, decisions: {}, imports: [imp] });
    expect(store.snapshot().imports).toEqual([imp]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/workspace/workspace-store.test.ts`
Expected: FAIL (`version` is 1 / `imports` undefined).

- [ ] **Step 3: Implement v2 in `workspace-store.ts`**

Change the version constant and interface, and make clone/empty/load `imports`-aware:

```ts
import type { ClassificationOverride } from "../finance/classification-overrides";
import type { ImportSnapshot } from "./import-history";

export interface ExclusionDecision {
  excluded: boolean;
}

export const WORKSPACE_SNAPSHOT_VERSION = 2;

export interface WorkspaceSnapshot {
  version: number;
  categoryOverrides: Record<string, ClassificationOverride>;
  decisions: Record<string, ExclusionDecision>;
  imports: ImportSnapshot[];
}
```

Update `cloneSnapshot` to copy imports (deep enough for the flat-ish arrays):

```ts
function cloneSnapshot(snapshot: WorkspaceSnapshot): WorkspaceSnapshot {
  return {
    version: WORKSPACE_SNAPSHOT_VERSION,
    categoryOverrides: Object.fromEntries(
      Object.entries(snapshot.categoryOverrides).map(([s, o]) => [s, { ...o }]),
    ),
    decisions: Object.fromEntries(
      Object.entries(snapshot.decisions).map(([s, d]) => [s, { ...d }]),
    ),
    imports: (snapshot.imports ?? []).map((imp) => ({
      ...imp,
      signatureSet: [...imp.signatureSet],
      kpiSnapshot: { ...imp.kpiSnapshot },
      reviewItemSignatures: [...imp.reviewItemSignatures],
    })),
  };
}
```

Update `emptySnapshot` to include `imports: []`. `load` already routes through `cloneSnapshot`; because `cloneSnapshot` reads `snapshot.imports ?? []` and stamps `version`, a v1 input migrates automatically. Confirm `load` is `state = cloneSnapshot(snapshot);` (it is).

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/workspace/workspace-store.test.ts`
Expected: PASS. Then `npx vitest run` — existing D1 tests still green (the v1 literals in older tests now migrate to v2; if any test asserts `version` is 1, update it to `WORKSPACE_SNAPSHOT_VERSION`).

- [ ] **Step 5: Commit**

```bash
git add src/workspace/workspace-store.ts src/workspace/workspace-store.test.ts
git commit -m "feat(workspace): WorkspaceSnapshot v2 with imports + load migration"
```

### Task 1.3: project-file migrate v1→v2

**Files:**
- Modify: `src/workspace/project-file.ts`
- Test: `src/workspace/project-file.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/workspace/project-file.test.ts`:

```ts
import { BILLU_FILE_KIND } from "./project-file";

describe("project-file v1->v2 migration", () => {
  it("migrates a v1 snapshot file to v2 with empty imports", () => {
    const v1 = JSON.stringify({
      kind: BILLU_FILE_KIND,
      snapshot: { version: 1, categoryOverrides: { sig: { parent: "Food" } }, decisions: {} },
    });
    const result = parseProjectFile(v1);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.snapshot.version).toBe(2);
      expect(result.snapshot.imports).toEqual([]);
      expect(result.snapshot.categoryOverrides.sig).toEqual({ parent: "Food" });
    }
  });

  it("rejects a newer (unknown) version loudly", () => {
    const v3 = JSON.stringify({
      kind: BILLU_FILE_KIND,
      snapshot: { version: 3, categoryOverrides: {}, decisions: {}, imports: [] },
    });
    expect(parseProjectFile(v3).ok).toBe(false);
  });

  it("rejects a malformed imports array", () => {
    const bad = JSON.stringify({
      kind: BILLU_FILE_KIND,
      snapshot: { version: 2, categoryOverrides: {}, decisions: {}, imports: "nope" },
    });
    expect(parseProjectFile(bad).ok).toBe(false);
  });

  it("round-trips a v2 file with an import", () => {
    const v2 = JSON.stringify({
      kind: BILLU_FILE_KIND,
      snapshot: {
        version: 2,
        categoryOverrides: {},
        decisions: {},
        imports: [{
          importedAt: "2026-01-01T00:00:00.000Z", sourceName: "x.csv",
          signatureSet: ["txn_a"], kpiSnapshot: { runwayMonths: 5 }, reviewItemSignatures: [],
        }],
      },
    });
    const result = parseProjectFile(v2);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.snapshot.imports).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/workspace/project-file.test.ts`
Expected: FAIL (current code rejects version !== current and has no `imports` handling).

- [ ] **Step 3: Implement migration in `parseSnapshot`**

In `project-file.ts`, replace the version check and add imports validation + migration. Replace the body of `parseSnapshot` so it: accepts version 1 or 2 (reject anything else), validates `imports` only when present, and returns a v2 snapshot.

```ts
import {
  WORKSPACE_SNAPSHOT_VERSION,
  type ExclusionDecision,
  type WorkspaceSnapshot,
} from "./workspace-store";
import type { ImportSnapshot } from "./import-history";
import type { ClassificationOverride } from "../finance/classification-overrides";

const SUPPORTED_VERSIONS = [1, 2];

function isImportSnapshot(value: unknown): value is ImportSnapshot {
  if (!isPlainObject(value)) return false;
  return (
    typeof value.importedAt === "string" &&
    typeof value.sourceName === "string" &&
    Array.isArray(value.signatureSet) &&
    value.signatureSet.every((s) => typeof s === "string") &&
    isPlainObject(value.kpiSnapshot) &&
    Array.isArray(value.reviewItemSignatures) &&
    value.reviewItemSignatures.every((s) => typeof s === "string")
  );
}

function parseSnapshot(value: unknown): WorkspaceSnapshot | string {
  if (!isPlainObject(value)) return "snapshot must be an object";
  if (typeof value.version !== "number") return "snapshot.version must be a number";
  if (!SUPPORTED_VERSIONS.includes(value.version)) {
    return `unsupported snapshot version: ${value.version}`;
  }
  if (!("categoryOverrides" in value) || !isPlainObject(value.categoryOverrides)) {
    return "snapshot.categoryOverrides must be an object";
  }
  if (!("decisions" in value) || !isPlainObject(value.decisions)) {
    return "snapshot.decisions must be an object";
  }

  const categoryOverrides: Record<string, ClassificationOverride> = {};
  for (const [signature, override] of Object.entries(value.categoryOverrides)) {
    if (!isClassificationOverride(override)) {
      return `snapshot.categoryOverrides["${signature}"] has an invalid shape`;
    }
    categoryOverrides[signature] = override;
  }

  const decisions: Record<string, ExclusionDecision> = {};
  for (const [signature, decision] of Object.entries(value.decisions)) {
    if (!isExclusionDecision(decision)) {
      return `snapshot.decisions["${signature}"].excluded must be a boolean`;
    }
    decisions[signature] = decision;
  }

  // imports is v2+; absent in v1 (migrate to []).
  let imports: ImportSnapshot[] = [];
  if ("imports" in value && value.imports !== undefined) {
    if (!Array.isArray(value.imports) || !value.imports.every(isImportSnapshot)) {
      return "snapshot.imports must be an array of import records";
    }
    imports = value.imports as ImportSnapshot[];
  }

  // Migrate forward: always emit the current version.
  return { version: WORKSPACE_SNAPSHOT_VERSION, categoryOverrides, decisions, imports };
}
```

Update `cloneSnapshot` in `project-file.ts` to also copy `imports` (mirror the workspace-store clone):

```ts
imports: (snapshot.imports ?? []).map((imp) => ({
  ...imp,
  signatureSet: [...imp.signatureSet],
  kpiSnapshot: { ...imp.kpiSnapshot },
  reviewItemSignatures: [...imp.reviewItemSignatures],
})),
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/workspace/project-file.test.ts` → PASS. Then `npx vitest run` all green.

- [ ] **Step 5: Commit**

```bash
git add src/workspace/project-file.ts src/workspace/project-file.test.ts
git commit -m "feat(workspace): project-file v1->v2 migration + imports validation"
```

---

## Slice 2 (S2) — pure history/diff logic

### Task 2.1: `recordImport` (dedup + cap)

**Files:**
- Modify: `src/workspace/import-history.ts`
- Test: `src/workspace/import-history.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/workspace/import-history.test.ts
import { describe, it, expect } from "vitest";
import { recordImport, type ImportSnapshot } from "./import-history";

function snap(over: Partial<ImportSnapshot> & { signatureSet: string[] }): ImportSnapshot {
  return {
    importedAt: "2026-01-01T00:00:00.000Z",
    sourceName: "x.csv",
    kpiSnapshot: { runwayMonths: 5 },
    reviewItemSignatures: [],
    ...over,
  };
}

describe("recordImport", () => {
  it("appends a snapshot to empty history", () => {
    const out = recordImport([], snap({ signatureSet: ["a"] }));
    expect(out).toHaveLength(1);
  });

  it("does not mutate the input history", () => {
    const history: ImportSnapshot[] = [];
    recordImport(history, snap({ signatureSet: ["a"] }));
    expect(history).toHaveLength(0);
  });

  it("skips a no-op re-import with an identical signatureSet to the most recent", () => {
    const first = recordImport([], snap({ signatureSet: ["a", "b"] }));
    const second = recordImport(first, snap({ signatureSet: ["a", "b"], sourceName: "again.csv" }));
    expect(second).toHaveLength(1);
    expect(second[0].sourceName).toBe("x.csv"); // unchanged
  });

  it("appends when signatureSet differs from the most recent", () => {
    const first = recordImport([], snap({ signatureSet: ["a"] }));
    const second = recordImport(first, snap({ signatureSet: ["a", "b"] }));
    expect(second).toHaveLength(2);
  });

  it("caps to the most recent N, dropping oldest", () => {
    let history: ImportSnapshot[] = [];
    for (let i = 0; i < 30; i++) {
      history = recordImport(history, snap({ signatureSet: [`sig-${i}`] }), { cap: 24 });
    }
    expect(history).toHaveLength(24);
    expect(history[0].signatureSet).toEqual(["sig-6"]); // oldest 6 dropped
    expect(history[23].signatureSet).toEqual(["sig-29"]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/workspace/import-history.test.ts`
Expected: FAIL (`recordImport` not exported).

- [ ] **Step 3: Implement**

Append to `import-history.ts`:

```ts
export const DEFAULT_IMPORT_HISTORY_CAP = 24;

function sameSignatureSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function recordImport(
  history: readonly ImportSnapshot[],
  snapshot: ImportSnapshot,
  options: { cap?: number } = {},
): ImportSnapshot[] {
  const cap = options.cap ?? DEFAULT_IMPORT_HISTORY_CAP;
  const mostRecent = history[history.length - 1];
  if (mostRecent && sameSignatureSet(mostRecent.signatureSet, snapshot.signatureSet)) {
    return [...history];
  }
  const next = [...history, snapshot];
  return next.length > cap ? next.slice(next.length - cap) : next;
}
```

- [ ] **Step 4: Run tests** → PASS. `npx tsc --noEmit` → 0.

- [ ] **Step 5: Commit**

```bash
git add src/workspace/import-history.ts src/workspace/import-history.test.ts
git commit -m "feat(workspace): recordImport with dedup + retention cap"
```

### Task 2.2: `findComparableBaseline`

**Files:** Modify `import-history.ts`; Test `import-history.test.ts`

- [ ] **Step 1: Failing tests**

```ts
import { findComparableBaseline } from "./import-history";

describe("findComparableBaseline", () => {
  it("returns undefined when history is empty", () => {
    expect(findComparableBaseline([], ["a"])).toBeUndefined();
  });

  it("returns undefined when no snapshot shares a signature", () => {
    const history = [snap({ signatureSet: ["a", "b"] })];
    expect(findComparableBaseline(history, ["x", "y"])).toBeUndefined();
  });

  it("returns the most recent snapshot sharing >=1 signature", () => {
    const history = [
      snap({ signatureSet: ["a"], sourceName: "old.csv" }),
      snap({ signatureSet: ["a", "b"], sourceName: "mid.csv" }),
      snap({ signatureSet: ["z"], sourceName: "unrelated.csv" }),
    ];
    const baseline = findComparableBaseline(history, ["a", "c"]);
    expect(baseline?.sourceName).toBe("mid.csv");
  });
});
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement**

```ts
export function findComparableBaseline(
  history: readonly ImportSnapshot[],
  currentSignatureSet: readonly string[],
): ImportSnapshot | undefined {
  const current = new Set(currentSignatureSet);
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].signatureSet.some((sig) => current.has(sig))) return history[i];
  }
  return undefined;
}
```

- [ ] **Step 4: Run → PASS; tsc 0.**

- [ ] **Step 5: Commit**

```bash
git add src/workspace/import-history.ts src/workspace/import-history.test.ts
git commit -m "feat(workspace): findComparableBaseline by signature overlap"
```

### Task 2.3: `diffKpiSnapshots`

**Files:** Modify `import-history.ts`; Test `import-history.test.ts`

- [ ] **Step 1: Failing tests**

```ts
import { diffKpiSnapshots } from "./import-history";

describe("diffKpiSnapshots", () => {
  it("computes per-key delta and direction", () => {
    const deltas = diffKpiSnapshots({ runwayMonths: 7.2 }, { runwayMonths: 5.9 });
    expect(deltas).toEqual([
      { key: "runwayMonths", previous: 7.2, current: 5.9, delta: -1.3, direction: "down" },
    ]);
  });

  it("marks equal values as flat with zero delta", () => {
    const deltas = diffKpiSnapshots({ revenue: 100 }, { revenue: 100 });
    expect(deltas[0]).toMatchObject({ delta: 0, direction: "flat" });
  });

  it("uses null delta when either side is null", () => {
    const deltas = diffKpiSnapshots({ runwayMonths: null }, { runwayMonths: 5 });
    expect(deltas[0]).toMatchObject({ previous: null, current: 5, delta: null, direction: "flat" });
  });

  it("includes keys present in either snapshot", () => {
    const deltas = diffKpiSnapshots({ a: 1 }, { b: 2 });
    expect(deltas.map((d) => d.key).sort()).toEqual(["a", "b"]);
  });
});
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement**

```ts
export interface KpiDelta {
  key: string;
  previous: number | null;
  current: number | null;
  delta: number | null;
  direction: "up" | "down" | "flat";
}

export function diffKpiSnapshots(
  previous: Record<string, number | null>,
  current: Record<string, number | null>,
): KpiDelta[] {
  const keys = [...new Set([...Object.keys(previous), ...Object.keys(current)])];
  return keys.map((key) => {
    const prev = key in previous ? previous[key] : null;
    const curr = key in current ? current[key] : null;
    if (prev === null || curr === null) {
      return { key, previous: prev, current: curr, delta: null, direction: "flat" as const };
    }
    const delta = curr - prev;
    const direction = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
    return { key, previous: prev, current: curr, delta, direction };
  });
}
```

- [ ] **Step 4: Run → PASS; tsc 0.**

- [ ] **Step 5: Commit**

```bash
git add src/workspace/import-history.ts src/workspace/import-history.test.ts
git commit -m "feat(workspace): diffKpiSnapshots per-key deltas"
```

### Task 2.4: `diffReviewSignatures` + `compareToBaseline`

**Files:** Modify `import-history.ts`; Test `import-history.test.ts`

- [ ] **Step 1: Failing tests**

```ts
import { diffReviewSignatures, compareToBaseline } from "./import-history";

describe("diffReviewSignatures", () => {
  it("counts added and resolved review items", () => {
    expect(diffReviewSignatures(["x", "y"], ["y", "z"])).toEqual({ added: 1, resolved: 1 });
  });
  it("is all-added when previous is empty", () => {
    expect(diffReviewSignatures([], ["a", "b"])).toEqual({ added: 2, resolved: 0 });
  });
});

describe("compareToBaseline", () => {
  it("bundles txn, kpi, and review deltas against a baseline", () => {
    const baseline = snap({
      signatureSet: ["a", "b"], kpiSnapshot: { runwayMonths: 7 }, reviewItemSignatures: ["r1"],
    });
    const current = snap({
      signatureSet: ["a", "b", "c"], kpiSnapshot: { runwayMonths: 6 },
      reviewItemSignatures: ["r1", "r2"], sourceName: "new.csv",
    });
    const cmp = compareToBaseline(baseline, current);
    expect(cmp.addedTransactions).toBe(1);
    expect(cmp.removedTransactions).toBe(0);
    expect(cmp.review).toEqual({ added: 1, resolved: 0 });
    expect(cmp.kpiDeltas.find((d) => d.key === "runwayMonths")?.direction).toBe("down");
    expect(cmp.baseline).toBe(baseline);
  });
});
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement** (note: txn add/remove uses signature set membership directly — `signatureSet` arrays, not `SignedRow`, so we count by set difference here rather than calling `diffSignedLedgers`, which operates on `SignedRow[]`)

```ts
export interface ReviewSignatureDelta {
  added: number;
  resolved: number;
}

export function diffReviewSignatures(
  previous: readonly string[],
  current: readonly string[],
): ReviewSignatureDelta {
  const prev = new Set(previous);
  const curr = new Set(current);
  let added = 0;
  let resolved = 0;
  for (const sig of curr) if (!prev.has(sig)) added++;
  for (const sig of prev) if (!curr.has(sig)) resolved++;
  return { added, resolved };
}

export interface ImportComparison {
  baseline: ImportSnapshot;
  addedTransactions: number;
  removedTransactions: number;
  kpiDeltas: KpiDelta[];
  review: ReviewSignatureDelta;
}

export function compareToBaseline(
  baseline: ImportSnapshot,
  current: ImportSnapshot,
): ImportComparison {
  const prevSet = new Set(baseline.signatureSet);
  const currSet = new Set(current.signatureSet);
  let addedTransactions = 0;
  let removedTransactions = 0;
  for (const sig of currSet) if (!prevSet.has(sig)) addedTransactions++;
  for (const sig of prevSet) if (!currSet.has(sig)) removedTransactions++;
  return {
    baseline,
    addedTransactions,
    removedTransactions,
    kpiDeltas: diffKpiSnapshots(baseline.kpiSnapshot, current.kpiSnapshot),
    review: diffReviewSignatures(baseline.reviewItemSignatures, current.reviewItemSignatures),
  };
}
```

- [ ] **Step 4: Run → PASS; tsc 0.** Full `npx vitest run` green.

- [ ] **Step 5: Commit**

```bash
git add src/workspace/import-history.ts src/workspace/import-history.test.ts
git commit -m "feat(workspace): review-signature delta + compareToBaseline bundle"
```

---

## Slice 3 (S3) — store accessor + capture wiring **[integration]**

### Task 3.1: `WorkspaceStore.addImport` accessor

**Files:**
- Modify: `src/workspace/workspace-store.ts` (interface + in-memory impl)
- Modify: `src/workspace/indexeddb-workspace-store.ts` (write-through impl)
- Test: `src/workspace/workspace-store.test.ts`

- [ ] **Step 1: Failing test**

```ts
import type { ImportSnapshot } from "./import-history";

describe("workspace-store addImport", () => {
  const imp = (sig: string): ImportSnapshot => ({
    importedAt: "2026-01-01T00:00:00.000Z", sourceName: "x.csv",
    signatureSet: [sig], kpiSnapshot: { runwayMonths: 5 }, reviewItemSignatures: [],
  });

  it("appends an import to the snapshot", () => {
    const store = createInMemoryWorkspaceStore();
    store.addImport(imp("a"));
    expect(store.snapshot().imports).toHaveLength(1);
  });

  it("dedups and caps via recordImport", () => {
    const store = createInMemoryWorkspaceStore();
    store.addImport(imp("a"));
    store.addImport(imp("a")); // identical -> skipped
    expect(store.snapshot().imports).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run → FAIL** (`addImport` not on the interface).

- [ ] **Step 3: Add to interface + in-memory impl in `workspace-store.ts`**

Add to `WorkspaceStore`:

```ts
  addImport(snapshot: ImportSnapshot, options?: { cap?: number }): void;
```

Import `recordImport` at top: `import { recordImport, type ImportSnapshot } from "./import-history";`

Add to the object returned by `createInMemoryWorkspaceStore`:

```ts
    addImport(snapshot, options) {
      state.imports = recordImport(state.imports, snapshot, options);
    },
```

- [ ] **Step 4: Implement in `indexeddb-workspace-store.ts` write-through wrapper**

In `wrapWithWriteThrough`, add to the returned object (mutate mirror + persist):

```ts
    addImport(snapshot, options) {
      mirror.addImport(snapshot, options);
      enqueuePersist();
    },
```

- [ ] **Step 5: Run** `npx vitest run src/workspace/` → PASS; `npx tsc --noEmit` → 0.

- [ ] **Step 6: Commit**

```bash
git add src/workspace/workspace-store.ts src/workspace/indexeddb-workspace-store.ts src/workspace/workspace-store.test.ts
git commit -m "feat(workspace): WorkspaceStore.addImport accessor"
```

### Task 3.2: Capture an ImportSnapshot in `main.ts` **[integration]**

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Add imports** near the other workspace imports in `main.ts`:

```ts
import {
  compareToBaseline,
  findComparableBaseline,
  type ImportComparison,
  type ImportSnapshot
} from "./workspace/import-history";
import { reviewItemSignature } from "./workspace/persistence-bridge";
```

- [ ] **Step 2: Add module state** near `let currentReviewItems`:

```ts
let currentImportComparison: ImportComparison | null = null;
```

- [ ] **Step 3: Add a capture helper** (place after `activateImportResult`):

```ts
function captureImport(result: CsvImportResult, sourceName: string): void {
  if (!signatureIndex) return;
  const view = buildDashboardView({
    result,
    filters: viewState.filters,
    trendGrain: viewState.trendGrain,
    reviewPreset: viewState.reviewPreset,
    selectedTransactionId: viewState.selectedTransactionId,
    cashOnHand: readCashOnHand(),
    futureEventsText: readFutureEventsText(),
    overrides: classificationOverrides
  });
  const signatureSet = [...signatureIndex.idToSignature.values()];
  const reviewItemSignatures = currentReviewItems.map((item) =>
    reviewItemSignature(item, signatureIndex!)
  );
  const snapshot: ImportSnapshot = {
    importedAt: new Date().toISOString(),
    sourceName,
    signatureSet,
    kpiSnapshot: {
      runwayMonths: view.summary.cashHealth.runwayMonths,
      revenue: view.summary.revenue,
      outflow: view.summary.outflow,
      netCash: view.summary.netCash,
      transactionCount: view.summary.transactionCount
    },
    reviewItemSignatures
  };
  const baseline = findComparableBaseline(workspaceStore.snapshot().imports, signatureSet);
  currentImportComparison = baseline ? compareToBaseline(baseline, snapshot) : null;
  workspaceStore.addImport(snapshot);
}
```

- [ ] **Step 4: Call it from `activateImportResult`** — after the existing `renderImportResult(result, sourceName);` line at the end of `activateImportResult`, add:

```ts
  captureImport(result, sourceName);
  if (currentImportComparison) renderImportResult(result, sourceName); // re-render so the strip shows
```

(Capture must run after `renderImportResult` because it relies on `currentReviewItems`, which that render populates. The conditional re-render paints the strip when a comparison exists.)

- [ ] **Step 5: Verify build/typecheck**

Run: `npx tsc --noEmit` → 0. `npm run build` → green. (No new unit test here; behavior is covered by the S5 e2e. Do not assert via unit test — this is DOM/integration.)

- [ ] **Step 6: Commit**

```bash
git add src/main.ts
git commit -m "feat(workspace): capture ImportSnapshot + comparison on import [D2]"
```

---

## Slice 4 (S4) — welcome-back strip

### Task 4.1: Pure strip renderer

**Files:**
- Create: `src/ui/welcome-back-strip.ts`
- Test: `src/ui/welcome-back-strip.test.ts`

- [ ] **Step 1: Failing tests**

```ts
// src/ui/welcome-back-strip.test.ts
import { describe, it, expect } from "vitest";
import { renderWelcomeBackStrip } from "./welcome-back-strip";
import type { ImportComparison } from "../workspace/import-history";

const fmtMoney = (n: number) => `$${n.toFixed(0)}`;
const fmtRunway = (n: number | null) => (n === null ? "n/a" : `${n.toFixed(1)} months`);

function comparison(over: Partial<ImportComparison> = {}): ImportComparison {
  return {
    baseline: {
      importedAt: "2026-04-30T00:00:00.000Z", sourceName: "prev.csv",
      signatureSet: [], kpiSnapshot: { runwayMonths: 7.2 }, reviewItemSignatures: [],
    },
    addedTransactions: 4,
    removedTransactions: 0,
    kpiDeltas: [
      { key: "runwayMonths", previous: 7.2, current: 5.9, delta: -1.3, direction: "down" },
    ],
    review: { added: 1, resolved: 0 },
    ...over,
  };
}

describe("renderWelcomeBackStrip", () => {
  it("summarizes runway delta, added transactions, and new review items", () => {
    const html = renderWelcomeBackStrip(comparison(), { formatMoney: fmtMoney, formatRunway: fmtRunway });
    expect(html).toContain("Since your last import");
    expect(html).toContain("7.2 months");
    expect(html).toContain("5.9 months");
    expect(html).toContain("+4 transactions");
    expect(html).toContain("1 new"); // new review item
    expect(html).toContain('data-bw-welcome-strip');
    expect(html).toContain('data-bw-welcome-dismiss');
  });

  it("omits zero clauses (no added/removed/review)", () => {
    const html = renderWelcomeBackStrip(
      comparison({ addedTransactions: 0, removedTransactions: 0, review: { added: 0, resolved: 0 } }),
      { formatMoney: fmtMoney, formatRunway: fmtRunway }
    );
    expect(html).not.toContain("transactions");
    expect(html).not.toContain("new");
  });

  it("marks runway-down as attention (coral) and runway-up as positive (olive)", () => {
    const down = renderWelcomeBackStrip(comparison(), { formatMoney: fmtMoney, formatRunway: fmtRunway });
    expect(down).toContain("bw-welcome--attention");
    const up = renderWelcomeBackStrip(
      comparison({ kpiDeltas: [{ key: "runwayMonths", previous: 5, current: 7, delta: 2, direction: "up" }] }),
      { formatMoney: fmtMoney, formatRunway: fmtRunway }
    );
    expect(up).toContain("bw-welcome--positive");
  });
});
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement** (reuse `escapeHtml` from `./html`)

```ts
// src/ui/welcome-back-strip.ts
import { escapeHtml } from "./html";
import type { ImportComparison } from "../workspace/import-history";

interface StripFormatters {
  formatMoney: (value: number) => string;
  formatRunway: (value: number | null) => string;
}

function baselineDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "last import" : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function renderWelcomeBackStrip(
  comparison: ImportComparison,
  { formatRunway }: StripFormatters
): string {
  const runway = comparison.kpiDeltas.find((d) => d.key === "runwayMonths");
  const tone =
    runway?.direction === "down" || comparison.review.added > 0
      ? "bw-welcome--attention"
      : runway?.direction === "up"
        ? "bw-welcome--positive"
        : "bw-welcome--neutral";

  const clauses: string[] = [];
  if (runway && runway.previous !== null && runway.current !== null) {
    clauses.push(`runway ${escapeHtml(formatRunway(runway.previous))} → ${escapeHtml(formatRunway(runway.current))}`);
  }
  if (comparison.addedTransactions > 0) clauses.push(`+${comparison.addedTransactions} transactions`);
  if (comparison.removedTransactions > 0) clauses.push(`−${comparison.removedTransactions} removed`);
  if (comparison.review.added > 0) {
    clauses.push(`${comparison.review.added} new ${comparison.review.added === 1 ? "item" : "items"} to review`);
  }

  return `
    <section class="bw-welcome ${tone}" data-bw-welcome-strip role="status">
      <p class="bw-welcome__text">Since your last import (${escapeHtml(baselineDate(comparison.baseline.importedAt))}): ${clauses.join("; ")}.</p>
      <button type="button" class="bw-welcome__dismiss" data-bw-welcome-dismiss aria-label="Dismiss">×</button>
    </section>
  `;
}
```

- [ ] **Step 4: Run → PASS; tsc 0.**

- [ ] **Step 5: Add styles** in `src/styles.css` (append near other widgets — match DESIGN.md olive/coral; use existing color tokens if present, else literal):

```css
.bw-welcome { display:flex; align-items:center; justify-content:space-between; gap:1rem;
  padding:.6rem .9rem; border-radius:.6rem; margin-bottom:1rem; border:1px solid transparent; }
.bw-welcome__text { margin:0; font-size:.9rem; }
.bw-welcome__dismiss { background:none; border:none; cursor:pointer; font-size:1.1rem; line-height:1; }
.bw-welcome--positive { background:#eef3ea; border-color:#cfe0c3; }
.bw-welcome--attention { background:#fbeee9; border-color:#f0cdbf; }
.bw-welcome--neutral { background:#f1f1ee; border-color:#dcdcd6; }
```

- [ ] **Step 6: Commit**

```bash
git add src/ui/welcome-back-strip.ts src/ui/welcome-back-strip.test.ts src/styles.css
git commit -m "feat(ui): welcome-back strip renderer [D2]"
```

### Task 4.2: Wire the strip into the cockpit **[integration]**

**Files:** Modify `src/main.ts`

- [ ] **Step 1: Import the renderer**

```ts
import { renderWelcomeBackStrip } from "./ui/welcome-back-strip";
```

- [ ] **Step 2: Add dismiss state** near `let currentImportComparison`:

```ts
let welcomeStripDismissed = false;
```

- [ ] **Step 3: Render the strip** in `renderImportResult`, immediately after `results.innerHTML = renderDashboardResults({...});` insert the strip at the top of the results region and bind dismiss:

```ts
  if (currentImportComparison && !welcomeStripDismissed) {
    results.insertAdjacentHTML(
      "afterbegin",
      renderWelcomeBackStrip(currentImportComparison, { formatMoney, formatRunway })
    );
    results.querySelector<HTMLButtonElement>("[data-bw-welcome-dismiss]")?.addEventListener("click", () => {
      welcomeStripDismissed = true;
      results.querySelector("[data-bw-welcome-strip]")?.remove();
    });
  }
```

- [ ] **Step 4: Reset dismiss on a new activation** — in `activateImportResult`, before the first `renderImportResult`, add `welcomeStripDismissed = false;`. Also clear `currentImportComparison = null;` in the `clear` handler and `showImportError`.

- [ ] **Step 5: Verify** `npx tsc --noEmit` → 0; `npm run build` → green.

- [ ] **Step 6: Commit**

```bash
git add src/main.ts
git commit -m "feat(ui): render + dismiss welcome-back strip on re-import [D2]"
```

---

## Slice 5 (S5) — history browser panel + e2e

### Task 5.1: Pure history-panel renderer

**Files:**
- Create: `src/ui/import-history-panel.ts`
- Test: `src/ui/import-history-panel.test.ts`

- [ ] **Step 1: Failing tests**

```ts
// src/ui/import-history-panel.test.ts
import { describe, it, expect } from "vitest";
import { renderImportHistoryPanel } from "./import-history-panel";
import type { ImportSnapshot } from "../workspace/import-history";

const fmtRunway = (n: number | null) => (n === null ? "n/a" : `${n.toFixed(1)} mo`);

function snap(over: Partial<ImportSnapshot> & { sourceName: string }): ImportSnapshot {
  return {
    importedAt: "2026-04-30T00:00:00.000Z",
    signatureSet: ["a"], kpiSnapshot: { runwayMonths: 7, transactionCount: 10 },
    reviewItemSignatures: [], ...over,
  };
}

describe("renderImportHistoryPanel", () => {
  it("shows an empty state with no imports", () => {
    expect(renderImportHistoryPanel([], { formatRunway: fmtRunway })).toContain("No imports yet");
  });

  it("lists imports newest-first with source, runway and txn count", () => {
    const html = renderImportHistoryPanel(
      [snap({ sourceName: "jan.csv" }), snap({ sourceName: "feb.csv", kpiSnapshot: { runwayMonths: 6, transactionCount: 14 } })],
      { formatRunway: fmtRunway }
    );
    const feb = html.indexOf("feb.csv");
    const jan = html.indexOf("jan.csv");
    expect(feb).toBeGreaterThan(-1);
    expect(jan).toBeGreaterThan(feb); // newest (feb, last in array) listed first
    expect(html).toContain("7.0 mo");
    expect(html).toContain("6.0 mo");
  });
});
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement**

```ts
// src/ui/import-history-panel.ts
import { escapeHtml } from "./html";
import type { ImportSnapshot } from "../workspace/import-history";

interface PanelFormatters {
  formatRunway: (value: number | null) => string;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function renderImportHistoryPanel(
  imports: readonly ImportSnapshot[],
  { formatRunway }: PanelFormatters
): string {
  if (imports.length === 0) {
    return `<div class="bw-history"><p class="bw-history__empty">No imports yet.</p></div>`;
  }
  const rows = [...imports]
    .reverse()
    .map((imp) => {
      const runway = imp.kpiSnapshot.runwayMonths ?? null;
      const txns = imp.kpiSnapshot.transactionCount ?? null;
      return `
        <li class="bw-history__row">
          <span class="bw-history__date">${escapeHtml(fmtDate(imp.importedAt))}</span>
          <span class="bw-history__source">${escapeHtml(imp.sourceName)}</span>
          <span class="bw-history__txns">${txns === null ? "—" : `${txns} txns`}</span>
          <span class="bw-history__runway">${escapeHtml(formatRunway(runway))}</span>
        </li>`;
    })
    .join("");
  return `<div class="bw-history"><ul class="bw-history__list">${rows}</ul></div>`;
}
```

- [ ] **Step 4: Run → PASS; tsc 0.** Add minimal styles for `.bw-history*` in `styles.css` (list layout; match panel styling of the reference panel).

- [ ] **Step 5: Commit**

```bash
git add src/ui/import-history-panel.ts src/ui/import-history-panel.test.ts src/styles.css
git commit -m "feat(ui): import history panel renderer [D2]"
```

### Task 5.2: Wire the History button + panel **[integration]**

**Files:** Modify `src/ui/app-shell.ts`, `src/main.ts`

- [ ] **Step 1: Add the button + panel container** in `app-shell.ts` shell-actions (after `#reference-button`):

```ts
          <button id="history-button" type="button" aria-expanded="false" disabled>History</button>
```

And a panel section after the reference panel:

```ts
    <section id="history-panel" class="reference-panel" aria-label="Import history" hidden></section>
```

- [ ] **Step 2: Wire in `main.ts`** — add refs + import:

```ts
import { renderImportHistoryPanel } from "./ui/import-history-panel";
const historyButton = document.querySelector<HTMLButtonElement>("#history-button")!;
const historyPanel = document.querySelector<HTMLElement>("#history-panel")!;
let historyOpen = false;
```

Add a toggle handler near the reference button handler:

```ts
historyButton.addEventListener("click", () => {
  historyOpen = !historyOpen;
  historyButton.setAttribute("aria-expanded", String(historyOpen));
  historyPanel.hidden = !historyOpen;
  historyPanel.innerHTML = historyOpen
    ? renderImportHistoryPanel(workspaceStore.snapshot().imports, { formatRunway })
    : "";
});
```

- [ ] **Step 3: Enable the button** when an import is shown — in `setProjectActionsEnabled` add `historyButton.disabled = !enabled;` (so History enables/disables with the other workspace actions). Confirm it's disabled in `clear`/`showImportError` via the same helper.

- [ ] **Step 4: Verify** `npx tsc --noEmit` → 0; `npm run build` → green.

- [ ] **Step 5: Commit**

```bash
git add src/ui/app-shell.ts src/main.ts
git commit -m "feat(ui): history panel toggle button [D2]"
```

### Task 5.3: e2e — strip on re-import + history panel **[integration]**

**Files:** Create `e2e/import-history.spec.ts`

- [ ] **Step 1: Write the e2e**

```ts
import { expect, test, type Page } from "@playwright/test";

const AGENCY = "/sample-agency.csv";

async function importAgency(page: Page): Promise<void> {
  await page.locator(`[data-bw-sample-path="${AGENCY}"]`).click();
  await page.getByRole("button", { name: "Apply Mapping" }).click();
  await page.locator("#cash-on-hand").fill("50000");
  await expect(page.locator('[data-kpi="runway"]')).toBeVisible();
}

test("re-importing the same ledger shows the welcome-back strip", async ({ page }) => {
  await page.goto("/");
  await importAgency(page);
  // First import: no baseline -> no strip.
  await expect(page.locator("[data-bw-welcome-strip]")).toHaveCount(0);

  await page.waitForTimeout(600); // let the first ImportSnapshot persist
  await page.reload();
  await importAgency(page);

  // Second import of the same data shares signatures -> strip appears.
  await expect(page.locator("[data-bw-welcome-strip]")).toBeVisible();
  await expect(page.locator("[data-bw-welcome-strip]")).toContainText("Since your last import");

  // Dismiss works.
  await page.locator("[data-bw-welcome-dismiss]").click();
  await expect(page.locator("[data-bw-welcome-strip]")).toHaveCount(0);

  // History panel lists entries.
  await page.locator("#history-button").click();
  await expect(page.locator("#history-panel .bw-history__row")).not.toHaveCount(0);
});
```

- [ ] **Step 2: Run single-worker**

Run: `npx playwright test e2e/import-history.spec.ts --workers=1`
Expected: PASS (desktop + mobile). If flaky on the strip read, wrap the assertion in `expect.poll` / rely on `toBeVisible` auto-retry (the import capture re-renders async).

- [ ] **Step 3: Full suite gate**

Run: `npx tsc --noEmit` → 0; `npx vitest run` → all green; `npx playwright test --workers=1` → all green; `npm run build` → green. (Kill stray `node` processes before parallel runs — see prior handoff note.)

- [ ] **Step 4: Commit**

```bash
git add e2e/import-history.spec.ts
git commit -m "test(e2e): welcome-back strip on re-import + history panel [D2]"
```

---

## Self-review notes (resolved)

- **Spec coverage:** §3 data model → T1.1/T1.2; migration → T1.2/T1.3; §4 pure logic → T2.1–2.4; §5 capture → T3.1/T3.2; §6 strip → T4; §6 panel → T5; testing → unit per task + e2e T5.3. All covered.
- **Type consistency:** `ImportSnapshot`, `KpiDelta`, `ReviewSignatureDelta`, `ImportComparison`, `addImport(snapshot, options?)`, `recordImport(history, snapshot, options?)` used identically across tasks.
- **Note:** the txn add/removed counts in `compareToBaseline` use signature-set difference (we store `signatureSet: string[]`, not `SignedRow[]`), which is why `ledger-diff.diffSignedLedgers` is NOT called there — `diffSignedLedgers` stays the row-level primitive for any future row-detail view.
- **Migration softening:** `project-file` now accepts versions in `SUPPORTED_VERSIONS = [1,2]` and migrates to current; newer/unknown still rejected (per approved spec decision).
```
