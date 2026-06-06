import type { TransactionRecord } from "../finance/types";
import type { ClassificationOverride } from "../finance/classification-overrides";
import type { ReviewDrawerItem } from "../ui/review-drawer";
import type { WorkspaceStore } from "./workspace-store";
import { signLedger } from "./sign-ledger";

/**
 * Maps in-session record ids to their reload-stable transaction signatures.
 * Record ids are regenerated on every import; signatures are not — so all
 * persistence is keyed by signature, and this index is the only bridge between
 * the two.
 */
export interface SignatureIndex {
  idToSignature: Map<string, string>;
}

export function buildSignatureIndex(records: readonly TransactionRecord[]): SignatureIndex {
  const idToSignature = new Map<string, string>();
  for (const { id, signature } of signLedger(records)) {
    idToSignature.set(id, signature);
  }
  return { idToSignature };
}

/**
 * A reload-stable key for a review drawer item. The item's own `id` embeds
 * volatile record ids (e.g. `transfer:out-1:rev-1`), so instead we key on the
 * SIGNATURES of its underlying rows (sorted, order-independent) plus its kind.
 * Items with no rows (e.g. `rejected:rows`) fall back to a stable kind-only key.
 */
export function reviewItemSignature(item: ReviewDrawerItem, index: SignatureIndex): string {
  const signatures = item.rowIds
    .map((id) => index.idToSignature.get(id))
    .filter((signature): signature is string => signature !== undefined)
    .sort();
  return `review:${item.kind}:${signatures.join("|")}`;
}

export function restoreOverrides(
  store: WorkspaceStore,
  index: SignatureIndex,
): Map<string, ClassificationOverride> {
  const restored = new Map<string, ClassificationOverride>();
  for (const [id, signature] of index.idToSignature) {
    const override = store.getCategoryOverride(signature);
    if (override) restored.set(id, override);
  }
  return restored;
}

export function restoreReviewExclusions(
  store: WorkspaceStore,
  items: readonly ReviewDrawerItem[],
  index: SignatureIndex,
): Set<string> {
  const excludedItemIds = new Set<string>();
  for (const item of items) {
    const decision = store.getDecision(reviewItemSignature(item, index));
    if (decision?.excluded) excludedItemIds.add(item.id);
  }
  return excludedItemIds;
}

export function persistOverride(
  store: WorkspaceStore,
  index: SignatureIndex,
  id: string,
  override: ClassificationOverride,
): void {
  const signature = index.idToSignature.get(id);
  if (signature) store.setCategoryOverride(signature, override);
}

export function clearPersistedOverride(
  store: WorkspaceStore,
  index: SignatureIndex,
  id: string,
): void {
  const signature = index.idToSignature.get(id);
  if (signature) store.clearCategoryOverride(signature);
}

export function persistReviewDecision(
  store: WorkspaceStore,
  index: SignatureIndex,
  item: ReviewDrawerItem,
  excluded: boolean,
): void {
  store.setDecision(reviewItemSignature(item, index), { excluded });
}
