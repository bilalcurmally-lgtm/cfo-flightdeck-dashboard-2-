import type { SignedRow } from "./sign-ledger";

export interface LedgerDiff {
  added: SignedRow[];
  removed: SignedRow[];
  retained: SignedRow[];
}

export function diffSignedLedgers(
  previous: readonly SignedRow[],
  current: readonly SignedRow[],
): LedgerDiff {
  const previousSignatures = new Set(previous.map((row) => row.signature));
  const currentSignatures = new Set(current.map((row) => row.signature));

  const added: SignedRow[] = [];
  const retained: SignedRow[] = [];

  for (const row of current) {
    if (previousSignatures.has(row.signature)) {
      retained.push(row);
    } else {
      added.push(row);
    }
  }

  const removed = previous.filter((row) => !currentSignatures.has(row.signature));

  return { added, removed, retained };
}