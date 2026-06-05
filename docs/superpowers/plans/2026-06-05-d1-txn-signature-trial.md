# D1 Trial — Transaction Signature Foundation

> **Owner:** Grok CLI implementation, Claude + Codex review.
> **Scope:** Pure workspace foundation only. No IndexedDB, no UI, no persistence wiring.
> **Base:** `codex/a1-audit-model` after C2, but fix the two C2 P2 review findings before using C2 as a merge base for broader D1 work.

## Goal

Implement the stable transaction signature function required by master plan section 3.3 so future D1 persistence can key review decisions and category overrides to re-imported rows.

This is intentionally the smallest useful D1 slice:
- one pure module under `src/workspace/`
- one focused test file
- no browser storage
- no app wiring
- no changes to imports, exports, C1, or C2 UI

## Ground Truth

Master plan section 3.3 says:

```ts
function txnSignature(r: TransactionRecord, occurrenceIndex: number): string
// = hash(dateISO + amount + rawDescription + account + sourceSheet + occurrenceIndex)
```

Current source reality:
- `TransactionRecord` lives in `src/finance/types.ts`.
- It has `dateISO`, `amount`, `description`, `account`, optional `sourceSheet`, `head`, `parent`, `subcategory`, `counterparty`, `flow`, and `signedNet`.
- It does **not** have `rawDescription`.
- C2 recategorization mutates `flow` and `parent`; future category edits may mutate `head` / `counterparty`, so signatures must not use mutable classification fields.

For this slice, use `record.description` as the current raw/import description stand-in. Do **not** use `head`, `parent`, `subcategory`, `counterparty`, `flow`, or `signedNet`.

## Required API

Create `src/workspace/txn-signature.ts`:

```ts
import type { TransactionRecord } from "../finance/types";

export function txnSignature(
  record: Pick<TransactionRecord, "dateISO" | "amount" | "description" | "account" | "sourceSheet">,
  occurrenceIndex: number
): string;
```

Allowed output format:
- deterministic string
- stable across platforms
- should include a short prefix such as `txn_`
- hash algorithm may be simple and local, but must be deterministic and tested
- no new runtime dependency

## Tests

Create `src/workspace/txn-signature.test.ts`.

Minimum tests:

1. **Identical-looking rows stay distinct**
   - Build two records with the same `dateISO`, `amount`, `description`, `account`, and `sourceSheet`.
   - Call `txnSignature(record, 0)` and `txnSignature(record, 1)`.
   - Expect different signatures.

2. **Signature is stable across recategorization**
   - Build a base record.
   - Build a modified copy changing only `head`, `parent`, `subcategory`, `counterparty`, `flow`, and `signedNet`.
   - Call both with the same occurrence index.
   - Expect the same signature.

3. **Signature changes when immutable import identity changes**
   - Change `dateISO`, `amount`, `description`, `account`, or `sourceSheet` one at a time.
   - Expect a different signature for each.

4. **Missing source sheet is explicit and stable**
   - A record with `sourceSheet: undefined` should produce the same signature every run.
   - It should differ from the same row with `sourceSheet: "Sheet1"`.

## Suggested Implementation Shape

Use a canonical JSON payload so delimiters cannot collide:

```ts
const payload = JSON.stringify({
  dateISO: record.dateISO,
  amount: record.amount,
  description: record.description,
  account: record.account,
  sourceSheet: record.sourceSheet ?? "",
  occurrenceIndex
});
```

Then hash that payload with a small deterministic function in the same module. If using Web Crypto would make tests async or browser-specific, avoid it for this slice.

## Verification

Run:

```powershell
npx tsc --noEmit
npx vitest run src/workspace/txn-signature.test.ts
```

Optional:

```powershell
npm test
```

## Acceptance

This trial is worth keeping if:
- tests pass without touching UI/app wiring
- signatures ignore mutable classification fields
- occurrence index makes duplicate-looking rows distinct
- no new dependencies are added
- the module is small enough for Claude + Codex to review quickly

## Do Not Do

- Do not implement IndexedDB.
- Do not create a workspace store.
- Do not persist C1/C2 decisions yet.
- Do not wire signatures into import flow yet.
- Do not use `head`, `parent`, `subcategory`, `counterparty`, `flow`, or `signedNet` in the signature.
- Do not invent a `rawDescription` field in `TransactionRecord` for this slice.
