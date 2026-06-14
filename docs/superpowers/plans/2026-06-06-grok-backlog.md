# Grok Backlog — small pure slices (2026-06-06)

For grok-cli on branch `codex/a1-audit-model`. Same loop: implement from the brief,
self-verify, paste `tsc` + `vitest` output, ping claude-opus for review + commit.

**Global rules for every task here**
- Do NOT touch `src/main.ts`, `src/ui/app-shell.ts`, or any `*-actions.ts` UI wiring —
  those are integration surfaces Claude owns. Stay in `src/workspace/` and `src/finance/`.
- TDD: failing test first, then the change. Keep each task its own commit.
- Verify before handing back: `npx tsc --noEmit` (0) and `npx vitest run src/workspace/`
  (or the relevant folder) green. Paste counts.
- One task at a time, smallest first. If a task needs more than its listed files, stop and ask.

---

## Task 1 — Lock transaction signatures with a golden test (HIGH VALUE)
**Why:** signatures are now PERSISTED keys (`.billu.json`, IndexedDB). If a future refactor
silently changes the hash, every saved workspace orphans. We need a regression guard.
- File: `src/workspace/txn-signature.test.ts` (extend; do not change `txn-signature.ts`).
- Add a test that pins EXACT signature strings for a small fixed set of records (hard-code
  the current output as golden values — run the function once, paste the literals).
- Add a test that `signLedger` output is byte-stable across two independent calls on the
  same records (same array → identical signatures, same order).
- Acceptance: tests fail if the hashing or field set ever changes. tsc 0.

## Task 2 — Kill the field-list drift in txn-signature (MED)
**Why:** `canonicalPayload` and `immutableTxnKey` each list the immutable identity fields
separately; they can drift apart, which would corrupt signatures.
- File: `src/workspace/txn-signature.ts` (+ its test).
- Refactor so the canonical payload is DERIVED from the same single field list
  `immutableTxnKey` uses (one source of truth). Behavior must be identical — Task 1's golden
  test must still pass unchanged.
- Add a test asserting the two stay in sync (e.g. both reflect a change to one shared list).
- Acceptance: golden signatures from Task 1 UNCHANGED; tsc 0.

## Task 3 — Occurrence + deep-copy edge tests (MED)
**Why:** noted coverage gaps from the D1 reviews.
- Files: `src/workspace/sign-ledger.test.ts` and `src/workspace/workspace-store.test.ts`
  (extend; no source changes expected).
- Add: THREE identical rows get three DISTINCT occurrence-indexed signatures (0,1,2), order
  preserved.
- Add: mutating a NESTED field of an object returned by `workspaceStore.snapshot()` /
  `getCategoryOverride()` does not change stored state (locks the deep-copy discipline).
- Acceptance: new tests green; if a deep-copy test can only pass by changing the store,
  STOP and report — that's a real bug for Claude, not a test to bend.

## Task 4 — cloneSnapshot flat-value guard comment (LOW)
**Why:** `cloneSnapshot` in `workspace-store.ts` (and the copy in `project-file.ts`) assume
override/decision values are flat. Document the assumption so a future nested field doesn't
silently alias.
- Files: `src/workspace/workspace-store.ts`, `src/workspace/project-file.ts` (comments only).
- Add a one-line comment at each `cloneSnapshot` noting it shallow-copies each value and
  assumes flat value shapes; revisit if `ClassificationOverride`/`ExclusionDecision` gain
  nested fields. No behavior change.
- Acceptance: tsc 0, vitest unchanged green.

## Task 5 — project-file round-trip THROUGH the store (LOW)
**Why:** prove the .billu.json file and the live store agree end to end (pure, no UI).
- File: `src/workspace/project-file.test.ts` (extend).
- Add: seed an in-memory store with overrides + decisions → `serializeProjectFile(store
  .snapshot())` → `parseProjectFile` → `store2.load(parsed.snapshot)` → `store2.snapshot()`
  deep-equals `store.snapshot()`.
- Acceptance: new test green; tsc 0.

---

### Suggested order
1 → 2 (2 depends on 1's golden test existing) → 3 → 5 → 4. Tasks 1, 3, 4, 5 are independent
of each other; only 2 depends on 1.

### NOT for Grok (Claude/own design)
- D2 (import history / "what changed") and D3 (saved rules) — need design first.
- Open-project with no active import, and any `.billu.json` UI/button changes — touch main.ts.
