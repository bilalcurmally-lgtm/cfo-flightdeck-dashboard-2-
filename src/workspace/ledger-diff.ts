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

export interface LedgerDiffSummary {
  addedCount: number;
  removedCount: number;
  retainedCount: number;
  changed: boolean;
}

export function summarizeLedgerDiff(diff: LedgerDiff): LedgerDiffSummary {
  const addedCount = diff.added.length;
  const removedCount = diff.removed.length;
  const retainedCount = diff.retained.length;

  return {
    addedCount,
    removedCount,
    retainedCount,
    changed: addedCount > 0 || removedCount > 0,
  };
}