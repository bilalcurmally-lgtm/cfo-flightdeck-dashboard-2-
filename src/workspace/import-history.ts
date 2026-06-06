/** A point-in-time record of one import, for history + "what changed" diffs. */
export interface ImportSnapshot {
  importedAt: string; // ISO timestamp
  sourceName: string;
  signatureSet: string[]; // txn signatures present (ledger order)
  kpiSnapshot: Record<string, number | null>; // keys: runwayMonths, revenue, outflow, netCash, transactionCount
  reviewItemSignatures: string[]; // stable review-item keys (precomputed by caller)
}