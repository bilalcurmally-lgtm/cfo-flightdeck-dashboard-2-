# Session Handoff — 2026-06-06

## Summary
Multi-agent session continuing D1 (persistence). Shipped the **entire D1
persistence path** — IndexedDB-backed store (slice 4), main.ts persistence
wiring with the real reload exit criterion (slice 5), and the `.billu.json`
project-file module (slice 6). All three reviewed and committed on
`codex/a1-audit-model`. Agent Room was offline (Codex reworking it), so Grok was
briefed via doc files instead of room tasks; Claude reviewed + committed each
slice (re-running tsc/vitest/e2e independently).

## Git state
- Branch: `codex/a1-audit-model`, **tip `d2239fa`**.
- New commits this session (oldest→newest):
  - `bb66e12` feat(workspace): IndexedDB-backed WorkspaceStore (D1 slice 4) — Grok
  - `60a22de` feat(workspace): .billu.json project file serialize/parse (slice 6) — Grok
  - `067412d` feat(workspace): persist C2 overrides + C1 decisions across reload (slice 5) — Claude
  - `d2239fa` feat(workspace): wire .billu.json export/import buttons (slice 6 follow-up) — Claude
- NOT pushed since `bb66e12`. No PR yet.
- Untracked `mcps/` (pre-existing, unrelated) left alone.

## Verification (at tip `d2239fa`)
- `npx tsc --noEmit` → 0
- `npx vitest run` → **309 passed** (67 files)
- `npx playwright test --workers=1` → **10 passed** (desktop + mobile)
- `npm run build` → green
- NOTE: the e2e suite is resource-sensitive. Orphaned `npm run dev` / Chromium
  processes from repeated runs will exhaust resources and crash parallel workers
  ("browser has been closed"). Kill stray `node` processes between full runs.
  Single-worker (`--workers=1`) is the reliable fallback and passes deterministically.

## What shipped this session

### D1 slice 4 — IndexedDB-backed WorkspaceStore (Grok, `bb66e12`)
`src/workspace/indexeddb-workspace-store.ts`. `createIndexedDbWorkspaceStore({factory?,
dbName?}) → {store, durable}`. Mirror-on-open + serialized write-through behind the
SAME synchronous `WorkspaceStore` facade; degrades to in-memory (`durable:false`) on
no/blocked IDB or write failure, never throws. Tests use an injected fake IDBFactory
(no new dep).

### D1 slice 6 — `.billu.json` project file (Grok, `60a22de`)
`src/workspace/project-file.ts`. `serializeProjectFile` (pretty 2-space) +
`parseProjectFile` → `{ok,snapshot}|{ok,error}`, never throws; validates `kind`,
`WORKSPACE_SNAPSHOT_VERSION`, object shapes, `decisions[*].excluded` boolean; deep-copies
on success. **Now wired to UI** — see slice 6 follow-up below.

### D1 slice 6 follow-up — Save/Open project buttons (Claude, `d2239fa`)
`src/ui/project-file-actions.ts` (`bindProjectFileActions`, unit-tested with injected
deps; uses a `getStore()` getter so it tracks the in-memory→durable store swap). Header
buttons `#save-project` / `#open-project` + hidden `#project-file` input in `app-shell.ts`.
Save → `serializeProjectFile(store.snapshot())` → `.billu.json` download. Open → read →
`parseProjectFile` → on ok `store.load()` + re-activate the import so restored state
re-applies; on error a LOUD status message with the workspace left intact. Buttons enabled
only while a dashboard import is shown (mirrors Clear). e2e `project-file.spec.ts`:
recategorize → Save → reset → Open restores the override from the file.

### D1 slice 5 — persistence wiring + exit criterion (Claude, `067412d`)
- `src/workspace/persistence-bridge.ts` (pure, unit-tested): `buildSignatureIndex`
  (record-id → reload-stable signature), `reviewItemSignature` (stable key from SORTED
  rowId signatures — NOT the volatile `transfer:out-1:rev-1` composite id),
  `restoreOverrides` / `restoreReviewExclusions` / `persistOverride` /
  `clearPersistedOverride` / `persistReviewDecision`.
- `src/main.ts`: async store init (`workspaceStore` starts in-memory, upgraded to the
  durable IDB store; `storeReady` gates restore). `activateImportResult()` runs once per
  confirmed import — signs the ledger, restores persisted overrides + review exclusions,
  then renders. Cockpit callbacks (recategorize / reset / review toggle) write through by
  signature. Clear button drops the in-session index but LEAVES persisted signatures so a
  re-import restores.
- `e2e/persistence-reload.spec.ts`: recategorize → reload → re-import the same sample →
  the override re-applies by signature (runway reproduces, non-op tile returns). The real
  master-plan §3.3 exit criterion, green on desktop + mobile.

### Design note worth remembering
Review-drawer item ids embed volatile record ids and so are NOT signature-stable. Slice 5
keys review decisions on a derived signature of the item's underlying rows (sorted), which
is why exclusions survive reload even though the synthetic item id changes. C1 review
exclusions for `rejected:rows` (no rowIds) persist under a stable kind-only key.

## Next-session priorities
**D1 is COMPLETE** (slices 1–6 + UI wiring). Remaining:
1. **Decide PR** for `codex/a1-audit-model` (C1 + C2 + D1 slices 1–6) vs keep stacking.
   Branch not pushed since `bb66e12` — `git push` before opening a PR.
2. Master-plan D2 (import history / "what changed") and D3 (saved rules) follow.
3. Optional polish: a `.billu.json` Import that works with NO active import yet (currently
   Save/Open enable only once a ledger is shown); fold the carry-over cleanups noted in the
   d1-continuation-plan (cloneSnapshot guard comment; canonicalPayload built on immutableTxnKey).

## Multi-agent workflow
Loop held even with the room offline: Claude/Codex spec a small slice → Grok implements
from a doc brief (`docs/superpowers/plans/2026-06-06-grok-task-d1-slice4.md`,
`...-slice6.md`) → Claude reviews (re-runs tsc/vitest/e2e) → Claude commits crediting Grok.
Grok now 5/5 clean slices, scope-disciplined (stayed out of main.ts on slice 6 as briefed).

---

## D2 Slice 2 — pure import-history logic (Grok, 2026-06-06 evening)

### Git state (S2)
- Branch: `codex/a1-audit-model`, **tip `0c1f66e`** (pushed).
- S2 commits (oldest→newest):
  - `727b33f` feat(workspace): recordImport with dedup + retention cap
  - `40159bf` feat(workspace): findComparableBaseline by signature overlap
  - `3013628` feat(workspace): diffKpiSnapshots per-key deltas
  - `0c1f66e` feat(workspace): review-signature delta + compareToBaseline bundle

### Verification (S2 tip)
- `npx tsc --noEmit` → 0
- `npx vitest run src/workspace/` → **8 files, 74 tests** passed

### What shipped
- `src/workspace/import-history.ts`: `recordImport`, `findComparableBaseline`,
  `diffKpiSnapshots`, `diffReviewSignatures`, `compareToBaseline` (+ types).
- `src/workspace/import-history.test.ts`: 15 unit tests.
- One FP tweak: `diffKpiSnapshots` runway test uses `toBeCloseTo(-1.3)` (JS float
  `5.9 - 7.2` ≠ `-1.3` with strict equality).

### Next-session priorities (D2)
1. **S3 (integration, Claude-opus):** `WorkspaceStore.addImport` + `main.ts` capture wiring.
2. **S4 (Grok brief):** welcome-back strip renderer.
3. Golden txn signatures in `txn-signature.test.ts` still byte-identical — confirm on review.
