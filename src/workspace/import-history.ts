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

export function findComparableBaseline(
  history: readonly ImportSnapshot[],
  currentSignatureSet: readonly string[],
): ImportSnapshot | undefined {
  const current = new Set(currentSignatureSet);
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].signatureSet.some((sig) => current.has(sig))) return history[i];
  }
  return undefined;
}

export interface KpiDelta {
  key: string;
  previous: number | null;
  current: number | null;
  delta: number | null;
  direction: "up" | "down" | "flat";
}

export function diffKpiSnapshots(
  previous: Record<string, number | null>,
  current: Record<string, number | null>,
): KpiDelta[] {
  const keys = [...new Set([...Object.keys(previous), ...Object.keys(current)])];
  return keys.map((key) => {
    const prev = key in previous ? previous[key] : null;
    const curr = key in current ? current[key] : null;
    if (prev === null || curr === null) {
      return { key, previous: prev, current: curr, delta: null, direction: "flat" as const };
    }
    const delta = curr - prev;
    const direction = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
    return { key, previous: prev, current: curr, delta, direction };
  });
}

export interface ReviewSignatureDelta {
  added: number;
  resolved: number;
}

export function diffReviewSignatures(
  previous: readonly string[],
  current: readonly string[],
): ReviewSignatureDelta {
  const prev = new Set(previous);
  const curr = new Set(current);
  let added = 0;
  let resolved = 0;
  for (const sig of curr) if (!prev.has(sig)) added++;
  for (const sig of prev) if (!curr.has(sig)) resolved++;
  return { added, resolved };
}

export interface ImportComparison {
  baseline: ImportSnapshot;
  addedTransactions: number;
  removedTransactions: number;
  kpiDeltas: KpiDelta[];
  review: ReviewSignatureDelta;
}

export function compareToBaseline(
  baseline: ImportSnapshot,
  current: ImportSnapshot,
): ImportComparison {
  const prevSet = new Set(baseline.signatureSet);
  const currSet = new Set(current.signatureSet);
  let addedTransactions = 0;
  let removedTransactions = 0;
  for (const sig of currSet) if (!prevSet.has(sig)) addedTransactions++;
  for (const sig of prevSet) if (!currSet.has(sig)) removedTransactions++;
  return {
    baseline,
    addedTransactions,
    removedTransactions,
    kpiDeltas: diffKpiSnapshots(baseline.kpiSnapshot, current.kpiSnapshot),
    review: diffReviewSignatures(baseline.reviewItemSignatures, current.reviewItemSignatures),
  };
}