/** A point-in-time record of one import, for history + "what changed" diffs. */
export interface ImportSnapshot {
  importedAt: string; // ISO timestamp
  sourceName: string;
  signatureSet: string[]; // txn signatures present (ledger order)
  kpiSnapshot: Record<string, number | null>; // keys: runwayMonths, revenue, outflow, netCash, transactionCount
  reviewItemSignatures: string[]; // stable review-item keys (precomputed by caller)
}

export const DEFAULT_IMPORT_HISTORY_CAP = 24;

function sameSignatureSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function recordImport(
  history: readonly ImportSnapshot[],
  snapshot: ImportSnapshot,
  options: { cap?: number } = {},
): ImportSnapshot[] {
  const cap = options.cap ?? DEFAULT_IMPORT_HISTORY_CAP;
  const mostRecent = history[history.length - 1];
  if (mostRecent && sameSignatureSet(mostRecent.signatureSet, snapshot.signatureSet)) {
    return [...history];
  }
  const next = [...history, snapshot];
  return next.length > cap ? next.slice(next.length - cap) : next;
}