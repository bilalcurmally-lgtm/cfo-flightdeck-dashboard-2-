# D2 — Import History + "What Changed Since Last Import" (Design)

**Date:** 2026-06-06
**Branch:** `codex/a1-audit-model`
**Status:** Approved design → ready for implementation plan
**Master plan ref:** `docs/designs/MASTER_PLAN_AUDITABLE_COCKPIT.md` §3.3 (ImportSnapshot,
"what changed"), §3.5 (welcome-back strip), Phase D2.

## 1. Goal & scope

Persist a history of imports and, on a recognized re-import, lead the cockpit with a calm,
dismissible "welcome-back" strip summarizing what changed since the last import — plus a
panel to browse past imports. Exit criterion (master plan): re-importing next month shows
*"Since your last import (Apr 30): runway 7.2 → 5.9 months; +4 transactions; 1 new item to
review."*

**In scope (full D2):** import-history persistence, capture-on-import, the welcome-back strip,
and a history browser panel (consecutive deltas).

**Out of scope (deferred):** comparing two arbitrary non-consecutive imports; per-dataset
timelines / multi-workspace; D3 saved rules; any change to the signature algorithm
(`txn-signature.ts` is golden-locked and untouched).

## 2. Decisions (locked)

1. **Storage:** extend `WorkspaceSnapshot` to **v2** with `imports: ImportSnapshot[]`. One
   IndexedDB store; history rides inside the `.billu.json` export. Migrate v1 → v2.
2. **Recognition:** one global timeline. The strip shows when the current import shares **≥1
   txn signature** with the most recent prior snapshot (it's the same ledger continued). Zero
   overlap → append the snapshot but show no strip (fresh dataset).
3. **Retention:** cap at the **24** most recent snapshots; drop oldest on overflow.

## 3. Data model

```ts
// src/workspace/import-history.ts
export interface ImportSnapshot {
  importedAt: string;                          // ISO timestamp at import
  sourceName: string;                          // e.g. "sample-agency.csv"
  signatureSet: string[];                      // txn signatures (from signLedger), order = ledger order
  kpiSnapshot: Record<string, number | null>;  // see KPI keys below
  reviewItemSignatures: string[];              // stable review-item keys (reuse persistence-bridge.reviewItemSignature)
}

// KPI keys captured (stable string keys):
//   "runwayMonths" (number | null), "revenue", "outflow", "netCash", "transactionCount"
```

`WorkspaceSnapshot` (v2):
```ts
export const WORKSPACE_SNAPSHOT_VERSION = 2;
export interface WorkspaceSnapshot {
  version: number;
  categoryOverrides: Record<string, ClassificationOverride>;
  decisions: Record<string, ExclusionDecision>;
  imports: ImportSnapshot[];   // NEW in v2; [] when absent
}
```

### Migration
- `createInMemoryWorkspaceStore` / `cloneSnapshot` / `emptySnapshot`: always produce v2 with
  `imports` present (default `[]`).
- `WorkspaceStore.load(snapshot)`: normalize a v1 (or `imports`-less) snapshot by defaulting
  `imports: []` and stamping `version: 2`. Never throw on a v1 input.
- `project-file.ts.parseProjectFile`: **migrate** known-older versions (v1 → v2 with
  `imports: []`) instead of rejecting; still reject **newer/unknown** versions loudly and
  still reject malformed shapes. `imports` (when present) must be an array of objects with the
  required field types or the file is rejected.

## 4. Pure logic — `src/workspace/import-history.ts`

All pure, fully unit-tested, no IO/DOM. Builds on `diffSignedLedgers` (`ledger-diff.ts`).

```ts
const DEFAULT_IMPORT_HISTORY_CAP = 24;

// Append a new snapshot. Dedup: if signatureSet equals the most recent snapshot's, return
// history unchanged (a no-op re-import adds nothing). Otherwise append, then trim to the last
// `cap`. Pure — returns a new array.
export function recordImport(
  history: readonly ImportSnapshot[],
  snapshot: ImportSnapshot,
  options?: { cap?: number },
): ImportSnapshot[];

// Most recent prior snapshot sharing >=1 signature with `currentSignatureSet`; undefined if none.
export function findComparableBaseline(
  history: readonly ImportSnapshot[],
  currentSignatureSet: readonly string[],
): ImportSnapshot | undefined;

export interface KpiDelta {
  key: string;
  previous: number | null;
  current: number | null;
  delta: number | null;            // null when either side is null
  direction: "up" | "down" | "flat";
}
export function diffKpiSnapshots(
  previous: Record<string, number | null>,
  current: Record<string, number | null>,
): KpiDelta[];

export interface ReviewSignatureDelta { added: number; resolved: number; }
export function diffReviewSignatures(
  previous: readonly string[],
  current: readonly string[],
): ReviewSignatureDelta;

// Bundle the cockpit needs to render the strip. Combines diffSignedLedgers + diffKpiSnapshots
// + diffReviewSignatures against the comparable baseline.
export interface ImportComparison {
  baseline: ImportSnapshot;        // the prior snapshot we compared against
  addedTransactions: number;
  removedTransactions: number;
  kpiDeltas: KpiDelta[];
  review: ReviewSignatureDelta;
}
export function compareToBaseline(
  baseline: ImportSnapshot,
  current: ImportSnapshot,
): ImportComparison;
```

## 5. Capture (integration — `main.ts`)

In `activateImportResult` (runs once per confirmed import), after the first render produces
the view:
1. Build the `ImportSnapshot`: `signatureSet` from the existing `signatureIndex` (the ledger's
   signatures), `kpiSnapshot` from `view.summary` (+ `cashHealth.runwayMonths`),
   `reviewItemSignatures` from `currentReviewItems` mapped through
   `reviewItemSignature(item, signatureIndex)`, `importedAt` = now, `sourceName`.
2. `findComparableBaseline(store.snapshot().imports, signatureSet)` → if found, compute
   `compareToBaseline` and hand it to the strip renderer; else no strip.
3. Persist via the new `workspaceStore.addImport(newSnap, { cap: 24 })` accessor (see §8) — the
   caller never hand-merges the imports array.

KPIs are captured at import time (the value shown on first render). Subsequent cash-on-hand /
override edits do not rewrite the stored snapshot — history records the import as it landed.

## 6. UI

### Welcome-back strip — `src/ui/welcome-back-strip.ts`
- Pure render: `renderWelcomeBackStrip(comparison, { formatMoney, formatRunway }) → string`.
- Rendered above the cockpit ONLY when a comparison exists. Dismissible (a close control;
  dismissal is view-state only, not persisted).
- Tone per DESIGN.md: **olive** for improving deltas (e.g. runway up), **coral** for attention
  (runway down, or new review items). Mixed → neutral container with per-figure coloring.
- Copy: `Since your last import (<baseline date>): runway X → Y months; +N transactions[; −M
  removed]; K new to review.` Omit clauses that are zero.

### History browser — `src/ui/import-history-panel.ts`
- Header toggle button `#history-button` ("History") in `app-shell.ts` shell-actions, opening a
  panel (same pattern as the Formulas reference panel). Enabled whenever `imports.length > 0`.
- Pure render listing snapshots newest-first: date, source, transaction count, runway; each row
  shows its delta vs the entry **before it** (consecutive). No arbitrary two-way compare in v1.
- Read-only. No selection state beyond open/closed.

## 7. Implementation slices (multi-agent loop)

- **S1 (Grok, pure):** `WorkspaceSnapshot` v2 + migration in `workspace-store.ts`; `project-file.ts`
  v1→v2 migrate-not-reject. Tests: v2 round-trip; v1 `.billu.json` loads with `imports: []`;
  newer/unknown version still rejected; existing D1 tests still green.
- **S2 (Grok, pure):** `import-history.ts` — `recordImport` (dedup + cap), `findComparableBaseline`,
  `diffKpiSnapshots`, `diffReviewSignatures`, `compareToBaseline`. Heavy unit tests incl.
  cap/dedup/zero-overlap/occurrence edges.
- **S3 (Claude, integration):** capture in `main.ts activateImportResult`; persist via store.
- **S4 (split):** `welcome-back-strip.ts` (Grok pure render + test) → Claude wires render above
  cockpit + dismiss.
- **S5 (split):** `import-history-panel.ts` (Grok pure render + test) → Claude wires header
  toggle + panel; e2e: re-import the same sample shows the strip with a non-zero txn delta;
  History panel lists ≥2 entries after two imports.

## 8. Interfaces, error handling, testing

- **Store accessor:** add `WorkspaceStore.addImport(snapshot, {cap})` that applies `recordImport`
  to the internal state, so callers never hand-merge the imports array. Keep `snapshot()`/`load()`
  v2-aware. (Alternative: callers compose via `load` — accessor preferred for encapsulation.)
- **Degradation:** if persistence is unavailable (in-memory fallback / quota), history simply
  doesn't survive reload; the strip still works within the session. Never throw on capture.
- **Corrupt/edited `.billu.json`:** unchanged D1 contract — reject loudly, keep current state;
  now also reject a malformed `imports` array.
- **Testing:** pure modules via vitest (S1, S2, S4, S5 renders). Integration via the existing
  e2e harness (`page.reload()` already proven). Golden signature values remain untouched.

## 9. Risks / notes

- `.billu.json` size grows with history × signatureSet; the cap (24) bounds it. Acceptable.
- Recognition is "≥1 shared signature with the most recent prior snapshot." A user alternating
  between two unrelated files will see a strip only when consecutive imports overlap — correct.
- **Decision (locked):** the capture site (`main.ts`) precomputes `reviewItemSignatures` via
  `persistence-bridge.reviewItemSignature` and stores them on the `ImportSnapshot`.
  `import-history.ts` therefore stays dependency-free — it only ever consumes `string[]`
  signature arrays, never the bridge or DOM. This keeps the pure module trivially testable.
