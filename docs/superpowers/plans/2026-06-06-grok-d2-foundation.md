# Grok Task Brief — D2 foundation: signature-based ledger diff (reviewer away ~30 min)

claude-opus is offline until the next session reset. These are NEW, isolated pure modules
(nothing imports them yet → zero blast radius), so source logic is fine here — but keep it
pure and TDD'd. I review + wire when I'm back.

## Why this is the next slice
D2 = "import history / what changed since last import." Every version of that feature needs
one primitive: given the PREVIOUS import's signatures and the CURRENT import's signatures,
classify each transaction as added / removed / retained. Signatures are reload-stable and now
golden-locked, so this diff is deterministic. Build the primitive; the UI/history-storage is
later and mine to design.

## Hard rules
- Stay in `src/workspace/`. Do NOT touch `main.ts`, `src/ui/`, or wire anything in.
- Reuse `SignedRow` from `./sign-ledger` and `signLedger` for tests. Do NOT modify
  `sign-ledger.ts` or `txn-signature.ts` (golden values must stay byte-identical).
- TDD: failing test first. `npx tsc --noEmit` (0) + `npx vitest run src/workspace/` green per slice.
- One commit per slice. If you find yourself needing UI/persistence/main.ts, STOP — that's mine.

---

## Slice 1 — `diffSignedLedgers` (the core primitive)
File: `src/workspace/ledger-diff.ts` (+ `ledger-diff.test.ts`).

```ts
import type { SignedRow } from "./sign-ledger";

export interface LedgerDiff {
  added: SignedRow[];     // current rows whose signature was NOT in previous
  removed: SignedRow[];   // previous rows whose signature is NOT in current
  retained: SignedRow[];  // current rows whose signature WAS in previous
}

export function diffSignedLedgers(
  previous: readonly SignedRow[],
  current: readonly SignedRow[],
): LedgerDiff;
```

- Signature is the identity key. Within one ledger signatures are unique (occurrence-indexed),
  so set membership by signature is well-defined.
- Order: `added` and `retained` follow `current` order; `removed` follows `previous` order.
- Pure, no mutation of inputs.

### Required tests (build records via `signLedger`, real signatures — no hand-faked hashes)
1. All-new (empty previous) → everything in `added`, nothing removed/retained.
2. Identical ledgers → everything `retained`, none added/removed.
3. One row added + one row removed between previous and current → classified correctly.
4. **Occurrence-aware:** previous has 2 identical rows (occ 0,1), current has 3 (occ 0,1,2)
   → the 3rd (occ 2) is `added`, the first two are `retained`. (This is the important one —
   it proves the diff respects occurrence indexing, not just raw txn identity.)
5. Order preservation for `added`/`retained` (current order) and `removed` (previous order).
6. Inputs are not mutated.

## Slice 2 — `summarizeLedgerDiff` (counts only — keep minimal)
Extend `ledger-diff.ts` (+ tests).

```ts
export interface LedgerDiffSummary {
  addedCount: number;
  removedCount: number;
  retainedCount: number;
  changed: boolean; // addedCount > 0 || removedCount > 0
}
export function summarizeLedgerDiff(diff: LedgerDiff): LedgerDiffSummary;
```

- Pure derivation from a `LedgerDiff`. No amount math, no formatting — counts + a `changed`
  flag only (anything richer is a design decision for later, not now).

### Required tests
1. Counts match a known diff.
2. `changed` is false only when both added and removed are empty (retained-only).

---

### Order & scope
Slice 1 → Slice 2 (2 depends on 1's types). Stop after slice 2. If you finish fast, that's
fine — do NOT start UI, history storage, or main.ts wiring; leave those for review.

### When I'm back
I review each commit: confirm it's isolated/pure, re-run tsc + full vitest, confirm
sign-ledger/txn-signature untouched (golden values intact), then plan the D2 wiring myself.
