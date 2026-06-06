# Grok Offline Batch — 2026-06-06 (reviewer away ~50 min)

claude-opus is offline until the session resets. Work through these **in order**, each as
its own commit, then I review the whole batch at once.

## Hard rules for THIS batch (reviewer offline)
- **TEST-ONLY or COMMENTS-ONLY.** Do NOT change any source logic in `.ts` files
  (no edits to function bodies, signatures, control flow). Comments are fine for Task 4.
- If a test can only pass by changing source logic, **STOP** — that's a real bug. Leave a
  note in the commit/checkpoint and move to the next task. Do NOT bend the test or "fix"
  the source while I'm away.
- Stay in `src/workspace/`. Do NOT touch `src/main.ts`, `src/ui/`, or `src/finance/`.
- Each task: TDD where it makes sense, `npx tsc --noEmit` (0) + `npx vitest run src/workspace/`
  green before moving on. Commit per task with a clear message. Branch is `codex/a1-audit-model`.
- The golden signature values in `txn-signature.test.ts` must remain byte-identical — never edit them.

---

## Task 5 — project-file round-trip THROUGH the store (test only)
File: `src/workspace/project-file.test.ts` (extend).
- Seed an in-memory store (`createInMemoryWorkspaceStore`) with BOTH a category override and
  a decision → `serializeProjectFile(store.snapshot())` → `parseProjectFile` →
  `store2.load(parsed.snapshot)` → `store2.snapshot()` deep-equals `store.snapshot()`.
- Acceptance: new test green; tsc 0.

## Task 4 — cloneSnapshot flat-value guard comments (comments only)
Files: `src/workspace/workspace-store.ts`, `src/workspace/project-file.ts`.
- Add a one-line comment at each `cloneSnapshot` noting it shallow-copies each value and
  assumes FLAT value shapes (`ClassificationOverride` / `ExclusionDecision`); revisit if those
  gain nested fields. **No behavior change** — comments only.
- Acceptance: tsc 0, full `vitest run src/workspace/` unchanged-green.

## Task 6 — persistence-bridge reviewItemSignature edge tests (test only)
File: `src/workspace/persistence-bridge.test.ts` (extend).
- Empty rowIds (the `rejected:rows` shape, `kind: "rejected"`, `rowIds: []`) → a stable
  kind-only key (`review:rejected:`), identical across two independent index builds.
- Two items of the same kind but DISJOINT rows → DIFFERENT signatures.
- An item whose rowIds are NOT in the index → the unresolved ids are filtered out (document
  the current behavior with a test; if it throws instead of filtering, that's a bug to surface).
- Acceptance: new tests green; tsc 0.

## Task 7 — project-file ignores unknown top-level snapshot keys (test only)
File: `src/workspace/project-file.test.ts` (extend).
- A valid file whose `snapshot` carries an EXTRA unknown top-level key (e.g. `futureField: 1`)
  → `parseProjectFile` returns `{ ok: true }` and the parsed snapshot contains ONLY
  `version`, `categoryOverrides`, `decisions` (extra key dropped).
- Acceptance: test green; tsc 0. If the extra key is preserved instead of dropped, do NOT
  change source — record it as a finding for review.

## Task 8 — indexeddb-store clear + load write-through tests (test only)
File: `src/workspace/indexeddb-workspace-store.test.ts` (extend; reuse the existing in-test
fake IDBFactory — do NOT add `fake-indexeddb`).
- clear: set an override → await persistence → `clearCategoryOverride` → await → reopen a
  second store over the same fake backing data → the override is GONE.
- load: set state A → `load(snapshotB)` → await → reopen → reflects snapshot B, not A.
- Acceptance: new tests green; tsc 0.

---

### Order & independence
5 → 4 → 6 → 7 → 8. All are independent (none depends on another's review). Do as many as you
get through; whatever's done when claude-opus returns gets reviewed as a batch.

### When I'm back
I'll review each commit: confirm test-only/comments-only, re-run tsc + vitest, check the golden
values are untouched, and read any "bug to surface" notes you left. Then squash-free per-task
commits stay as-is (already crediting you).
