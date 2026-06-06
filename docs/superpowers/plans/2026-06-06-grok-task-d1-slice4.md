# Grok Task Brief — D1 Slice 4: IndexedDB-backed WorkspaceStore

**Agent:** grok-cli
**Branch:** `codex/a1-audit-model` (already checked out; do NOT branch or PR)
**Reviewers:** claude-opus + codex-desktop will each re-run tsc/vitest and review before commit.
**Scope discipline:** This is ONE pure-ish slice. Do not wire into `main.ts`. Do not
touch C1/C2 code. Do not add UI. If you think you need to, stop and post in the room.

---

## Goal
A durable `WorkspaceStore` implementation backed by IndexedDB, sitting behind the
**existing, unchanged** `WorkspaceStore` interface in `src/workspace/workspace-store.ts`
so that C1/C2 call sites never import IndexedDB and keep their synchronous API.

## The exact contract you implement
Implement the existing interface verbatim — do not edit `workspace-store.ts`:

```ts
export interface WorkspaceStore {
  getCategoryOverride(signature: string): ClassificationOverride | undefined;
  setCategoryOverride(signature: string, override: ClassificationOverride): void;
  clearCategoryOverride(signature: string): void;
  getDecision(signature: string): ExclusionDecision | undefined;
  setDecision(signature: string, decision: ExclusionDecision): void;
  clearDecision(signature: string): void;
  snapshot(): WorkspaceSnapshot;
  load(snapshot: WorkspaceSnapshot): void;
}
```

Reuse `WorkspaceSnapshot`, `WORKSPACE_SNAPSHOT_VERSION`, `ExclusionDecision`,
and the existing clone/empty helpers' *behavior* (deep-copy isolation) — match the
in-memory store's copy semantics exactly so the two implementations are interchangeable.

## File to create
`src/workspace/indexeddb-workspace-store.ts`

### Design (the async-boundary trick)
The interface is **synchronous**; IndexedDB is **async**. Resolve this with a
mirror-on-open pattern:

```ts
export interface DurableWorkspaceStore {
  store: WorkspaceStore;
  durable: boolean; // false when we fell back to in-memory
}

export function createIndexedDbWorkspaceStore(
  options?: { factory?: IDBFactory; dbName?: string },
): Promise<DurableWorkspaceStore>;
```

- On open: load the persisted `WorkspaceSnapshot` into an in-memory mirror
  (reuse `createInMemoryWorkspaceStore(snapshot)`).
- `get*` / `snapshot` serve **synchronously** from the mirror.
- `set* / clear* / load` mutate the mirror synchronously, then **write through** to
  IndexedDB (fire-and-forget or a small serialized queue — a single chained promise
  is fine; do not block the caller, do not lose writes ordering).
- Persist the whole snapshot under one key (simplest correct thing) — keyed by a
  constant; one object store. No need for per-signature rows in this slice.

### Degradation (must never throw on open)
- If `indexedDB` is unavailable (private browsing / no factory / open errors / quota),
  resolve to `{ store: createInMemoryWorkspaceStore(), durable: false }`.
- Never throw out of `createIndexedDbWorkspaceStore`. Never throw from `set*` on a
  write-through failure — swallow + (optionally) flip an internal degraded flag.

## Tests
`src/workspace/indexeddb-workspace-store.test.ts` (vitest).

**Do NOT add `fake-indexeddb`** — it is not a dependency and we are keeping zero new
runtime deps. Instead use the **injected `factory`** option:
- Write a minimal in-test fake `IDBFactory` (or a tiny hand-rolled async key-value
  shim that satisfies just the calls you make) and pass it via `options.factory`.
  Keep the fake in the test file, not in `src/`.
- Required cases:
  1. **Round-trip / durability:** create store with fake factory → `setCategoryOverride`
     + `setDecision` → await write-through → create a SECOND store over the SAME fake
     backing data → values are present (proves persistence across "reopen").
  2. **Deep-copy isolation:** mutating an object returned by `getCategoryOverride`
     does not change stored state (match in-memory store semantics).
  3. **Degradation:** open with no/blocked factory → resolves `{ durable: false }`,
     backed by a working in-memory store, never throws.
  4. **Write-through failure is swallowed:** a factory whose write rejects must not
     throw out of `setDecision`; the in-memory mirror still reflects the value.

## Verify before you hand back (paste output in the room task)
```
npx tsc --noEmit
npx vitest run src/workspace/
```
Both must be green. Report counts.

## Out of scope (do NOT do — these are later slices)
- Slice 5: wiring into `main.ts`, signLedger re-hydration, e2e reload test. NOT this slice.
- Slice 6: `.billu.json` export/import. NOT this slice.
- Any change to `workspace-store.ts`, `txn-signature.ts`, `sign-ledger.ts`, C1/C2, UI.

## Optional carry-over cleanup (only if trivial, otherwise skip)
- Add a one-line guard comment on `cloneSnapshot` noting it assumes flat value types.

When done: post the verify output + the new file paths in the room task and ping
claude-opus for review.
