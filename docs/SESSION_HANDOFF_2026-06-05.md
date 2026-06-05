# Session Handoff — 2026-06-05

## Summary
Big multi-agent session. Shipped **C2 (Focused Category Review)** end-to-end with
all review findings fixed, then stood up the **D1 persistence foundation** (3 pure
slices) via a new agent (grok-cli) on trial, with Claude + Codex reviewing every
slice. Everything is green and committed on `codex/a1-audit-model`; nothing pushed,
no PR yet.

## Git state
- Branch: `codex/a1-audit-model`
- Tip: **`c46fba2`**
- Working tree clean except untracked `.claude/`, `mcps/` (pre-existing, unrelated).
- Not pushed / no PR.

## Verification (at tip)
- `npx tsc --noEmit` → 0
- `npx vitest run` → **287 passed** (63 files)
- `npx playwright test e2e/lineage-drawer.spec.ts` → **6 passed** (desktop + mobile)
- `npm run build` → green

## What shipped this session

### C2 — Focused Category Review (Claude, inline)
Recategorize transactions (Type + Group) → cockpit re-derives live; non-operating
money (Internal/Financing) is reported in its own tile, never silently zeroed.
Reuse-exclusion architecture: in-session override `Map<id,{flow?,parent?}>` rewrites
records before math; non-op rows leave **operating** KPIs via the existing
`withReviewExclusions` path but **stay in the export**.
Commits `2535ff4`..`e24d511` (+ docs `29dc388`).

**C2 review fixes** (Codex review, room msgs 000023/000034):
- `8181de3` — P2.1: full CSV/XLSX transaction exports now apply Type/Group overrides
  via `getFullExportRecords` (reviewer JSON path already did). Regression test added.
- `5157fff` — P2.2 + residual: category queue keeps any **override-carrying** row
  visible (acted=true) even after the override removes its only review reason, so
  **Reset is always reachable**. Regression test added.

### D1 — persistence foundation (grok-cli, trial; Claude+Codex reviewed each slice)
All pure, no IndexedDB/UI/wiring yet. Lives in `src/workspace/`.
- `txn-signature.ts` (slice 1, task-000004) — `txnSignature(record, occurrenceIndex)`:
  FNV-1a double-hash (64-bit) over IMMUTABLE identity (dateISO + amount + description
  + account + sourceSheet + occurrenceIndex). `Pick<>` input type structurally bars
  mutable classification fields. `immutableTxnKey()` = same fields, no index (dedup key).
- `sign-ledger.ts` (slice 2, task-000005) — `signLedger(records)`: occurrence-indexed
  signatures for a full ledger; order preserved; reuses `txnSignature`.
- `workspace-store.ts` (slice 3, task-000006) — `WorkspaceSnapshot {version,
  categoryOverrides, decisions}` keyed by signature; `WorkspaceStore` facade
  (get/set/clear + snapshot/load with deep-copy isolation); `createInMemoryWorkspaceStore()`.
  Reuses C2's `ClassificationOverride` — the literal C2→D1 bridge.
- Commits: `a65ee33` (plan doc), `db63da7` (slices 1+2), `c46fba2` (slice 3).
- NOTE: uses `record.description` as the raw-description stand-in (TransactionRecord
  has no `rawDescription`).

## Multi-agent workflow (new this session)
Agent Room MCP at `http://127.0.0.1:8787` (roomDir `D:\projects\.agent-room`).
Agents: **claude-opus** (me — review + integration + commits), **codex-desktop**
(planning + independent review), **grok-cli** (implementation, on trial — PASSED:
3 clean slices, scope-disciplined, responsive to review). Owner posts as `user`.
Loop: Codex/Claude plan a small pure slice → cut a room task for Grok → Grok
implements + self-verifies → Claude + Codex each independently review (re-run
tsc/vitest) → Claude commits crediting Grok. Both reviewers reached KEEP on all
three D1 slices.

## Non-blocking follow-ups noted (not yet done)
- `workspace-store.cloneSnapshot` assumes flat value types (true today) — add a
  comment / revisit if values gain nested fields.
- `signLedger`/`txnSignature`: `immutableTxnKey` and `canonicalPayload` duplicate the
  field list; consider having the payload build on the key to prevent drift.
- A 3-identical-rows occurrence test + a direct nested-field mutation test would
  tighten coverage.

## Next-session priorities
See `docs/superpowers/plans/2026-06-06-d1-continuation-plan.md`. In short:
1. **D1 slice 4** — IndexedDB-backed `WorkspaceStore` behind the SAME facade (async
   boundary, `workspaceStore` accessor, degrade to in-memory + warn on unavailable).
2. **D1 slice 5** — wire it into `main.ts`: persist C2 `classificationOverrides` +
   C1 review decisions by `signLedger` signature; restore on reload (the real
   "exclude/recategorize → reload → still there" exit criterion).
3. **D1 slice 6** — `.billu.json` export/import with loud corrupt-file rejection.
4. Then decide PR for `codex/a1-audit-model` (C1 + C2 + D1).
