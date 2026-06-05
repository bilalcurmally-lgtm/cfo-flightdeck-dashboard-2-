# D1 Continuation Plan — persistence + wiring (next session)

> Context: D1 foundation is committed on `codex/a1-audit-model` (tip `c46fba2`):
> `txnSignature` + `signLedger` + in-memory `workspaceStore` facade, all pure,
> reviewed + KEEP'd by Claude and Codex. This plan continues D1 toward the real
> "exclude/recategorize → reload → it persists" exit criterion (master plan §3.3).
> Same multi-agent loop: small pure-ish slices → Grok implements → Claude + Codex
> review → Claude commits. Keep each slice independently shippable + tested.

## Slice 4 — IndexedDB-backed WorkspaceStore (behind the existing facade)
**Goal:** a durable `WorkspaceStore` implementation; UI/app still never imports IDB.
- `src/workspace/indexeddb-workspace-store.ts`: implement the EXISTING `WorkspaceStore`
  interface against IndexedDB. The async boundary is the catch — propose
  `createIndexedDbWorkspaceStore(): Promise<WorkspaceStore>` that loads the persisted
  snapshot into an in-memory mirror on open, serves get/set/clear synchronously from
  the mirror, and writes through to IDB on mutation (fire-and-forget or queued). This
  keeps the synchronous facade the C2/C1 call sites expect.
- Degradation: if IndexedDB is unavailable (private browsing / quota), fall back to
  `createInMemoryWorkspaceStore()` + a visible warning flag on the returned store
  (e.g. `{ store, durable: false }`). Never throw on open.
- Tests: use `fake-indexeddb` ONLY if already a dep; otherwise inject an IDB factory
  so the store is testable without a browser (preferred — keep zero new runtime deps;
  a dev dep is acceptable if the team agrees). Round-trip: set → reopen → value present.
- DO NOT wire into main.ts yet.

## Slice 5 — wire persistence into the app (the real exit criterion)
**Goal:** C2 overrides + C1 decisions survive reload.
- In `main.ts`, on import: compute `signLedger(result.records)` → `id → signature` map.
  Replace the in-session `classificationOverrides` (keyed by record.id) reads/writes so
  they persist via `workspaceStore.setCategoryOverride(signature, …)`, and on render
  re-hydrate the id-keyed map from the store by signature. Same for C1 review decisions
  (`reviewExcludedItemIds`) → `setDecision(signature, {excluded})`.
- Restore on load: when an import's signatures match stored entries, re-apply overrides
  + decisions automatically (master plan "re-import behavior").
- Exit criterion (must demonstrate): recategorize an owner draw → reload the page →
  the recategorization (and any review exclusions) are still applied; runway reflects them.
- Tests: a unit test around the id↔signature re-hydration; an e2e that reloads and
  asserts persistence (Playwright `page.reload()`).

## Slice 6 — `.billu.json` project file (export/import)
**Goal:** portable, privacy-safe durable artifact.
- `src/workspace/project-file.ts`: serialize `WorkspaceSnapshot` → `.billu.json`;
  parse + VALIDATE on import (version + shape); reject corrupt/edited files LOUDLY and
  preserve current state (master plan §3.5 shadow path). Wire export/import buttons.
- Tests: round-trip; corrupted-file rejection keeps current state.

## After D1
- Decide PR for `codex/a1-audit-model` (C1 + C2 + D1) vs continue stacking.
- Master plan Phase D2 (import history / "what changed") and D3 (saved rules) follow.

## Carry-over non-blocking cleanups (optional, fold into a slice)
- `workspace-store.cloneSnapshot` assumes flat value types — add a guard comment.
- `txn-signature`: have `canonicalPayload` build on `immutableTxnKey` to prevent field drift.
- Add a 3-identical-rows occurrence test; a direct nested-field mutation test for snapshot copy.
