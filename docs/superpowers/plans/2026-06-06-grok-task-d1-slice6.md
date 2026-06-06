# Grok Task Brief — D1 Slice 6 (PURE part): `.billu.json` project file

**Agent:** grok-cli
**Branch:** `codex/a1-audit-model` (already checked out; do NOT branch or PR)
**Reviewers:** claude-opus reviews (re-runs tsc/vitest) before commit.

## ⚠️ Scope boundary — READ FIRST
This is the **PURE serialization/validation module ONLY**. **Do NOT touch `main.ts`.**
Claude is editing `main.ts` for slice 5 (persistence wiring) at the same time — if you
edit `main.ts` we collide. The export/import **button wiring** is explicitly Claude's
follow-up, NOT this task. You stay entirely inside `src/workspace/`.

## Goal
A portable, privacy-safe `.billu.json` artifact: serialize a `WorkspaceSnapshot` to a
JSON string, and parse + VALIDATE one back, rejecting corrupt/edited/incompatible files
LOUDLY (by returning an error result) so a caller can preserve current state.

## File to create
`src/workspace/project-file.ts`

### API
```ts
import type { WorkspaceSnapshot } from "./workspace-store";

export const BILLU_FILE_KIND = "billu-workspace";

// What lands in the .billu.json file. Wrap the snapshot so we can evolve the
// envelope independently of the snapshot version.
export interface BilluProjectFile {
  kind: typeof BILLU_FILE_KIND;
  snapshot: WorkspaceSnapshot;
}

export function serializeProjectFile(snapshot: WorkspaceSnapshot): string;

export type ParseProjectFileResult =
  | { ok: true; snapshot: WorkspaceSnapshot }
  | { ok: false; error: string };

// MUST NOT throw on bad input — return { ok:false, error } instead.
export function parseProjectFile(text: string): ParseProjectFileResult;
```

### Validation rules (parse)
Reject (return `{ ok:false, error }`, never throw) when ANY of:
- not valid JSON
- top-level not an object, or `kind !== BILLU_FILE_KIND`
- `snapshot` missing / not an object
- `snapshot.version` not a number, OR not equal to `WORKSPACE_SNAPSHOT_VERSION`
  (import the constant — reject unknown/future versions loudly for now)
- `snapshot.categoryOverrides` or `snapshot.decisions` missing / not a plain object
- (defensive) any `decisions[*].excluded` not a boolean

On success, return a **deep-copied** snapshot (do not hand back aliases into the parsed
JSON object graph — match the deep-copy discipline of the in-memory store).

`serializeProjectFile` should pretty-print (2-space) for human-diffable files.

## Tests — `src/workspace/project-file.test.ts` (vitest)
1. **Round-trip:** snapshot with both overrides + decisions → serialize → parse →
   `{ ok:true }` and deep-equals the original.
2. **Isolation:** mutating the parsed result does not affect a second parse of the same
   text (proves deep copy).
3. **Corrupt JSON** (`"{ not json"`) → `{ ok:false }`, error mentions JSON/parse.
4. **Wrong kind** / missing kind → `{ ok:false }`.
5. **Version mismatch** (e.g. `version: 999`) → `{ ok:false }`.
6. **Malformed shape** (categoryOverrides is an array / decisions missing) → `{ ok:false }`.
7. **Never throws:** each bad-input case asserted via `expect(() => parse(...)).not.toThrow()`.

## Verify before handing back (paste output)
```
npx tsc --noEmit
npx vitest run src/workspace/
```
Both green; report counts.

## Out of scope (do NOT do)
- ANY edit to `main.ts` (buttons, file picker, download trigger) — that's Claude's.
- Any change to `workspace-store.ts`, `indexeddb-workspace-store.ts`, signLedger, C1/C2.
- Browser File/Blob/download APIs — keep this module pure string-in/string-out.

When done: paste verify output + the new file paths and ping claude-opus.
