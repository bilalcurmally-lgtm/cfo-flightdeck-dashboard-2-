import { describe, it, expect } from "vitest";
import type { TransactionRecord } from "../finance/types";
import type { ReviewDrawerItem } from "../ui/review-drawer";
import { createInMemoryWorkspaceStore } from "./workspace-store";
import {
  buildSignatureIndex,
  reviewItemSignature,
  restoreOverrides,
  restoreReviewExclusions,
  persistOverride,
  clearPersistedOverride,
  persistReviewDecision,
} from "./persistence-bridge";

function record(partial: Partial<TransactionRecord> & { id: string }): TransactionRecord {
  return {
    dateISO: "2026-01-01",
    amount: 100,
    description: "desc",
    account: "acct",
    sourceSheet: "sheet",
    flow: "outflow",
    head: "Operating Costs",
    parent: "Operating Costs",
    ...partial,
  } as TransactionRecord;
}

function reviewItem(partial: Partial<ReviewDrawerItem> & { id: string }): ReviewDrawerItem {
  return {
    kind: "duplicate",
    title: "t",
    body: "b",
    rowIds: [],
    confidence: "medium",
    excluded: false,
    ...partial,
  } as ReviewDrawerItem;
}

describe("persistence-bridge", () => {
  it("builds an id->signature index where identical rows get distinct signatures", () => {
    const a = record({ id: "id-a" });
    const b = record({ id: "id-b" }); // identical immutable identity to a
    const index = buildSignatureIndex([a, b]);
    const sigA = index.idToSignature.get("id-a");
    const sigB = index.idToSignature.get("id-b");
    expect(sigA).toBeTruthy();
    expect(sigB).toBeTruthy();
    expect(sigA).not.toBe(sigB); // occurrence index distinguishes them
  });

  it("derives a reload-stable review-item signature from rowId signatures, not record ids", () => {
    const r1 = record({ id: "out-1", amount: 50, description: "transfer out" });
    const r2 = record({ id: "rev-1", amount: 50, description: "transfer in" });
    const indexA = buildSignatureIndex([r1, r2]);
    // Same data re-imported with DIFFERENT record ids (the real reload scenario).
    const indexB = buildSignatureIndex([
      record({ id: "fresh-9", amount: 50, description: "transfer out" }),
      record({ id: "fresh-7", amount: 50, description: "transfer in" }),
    ]);
    const itemA = reviewItem({ id: "transfer:out-1:rev-1", kind: "transfer", rowIds: ["out-1", "rev-1"] });
    const itemB = reviewItem({ id: "transfer:fresh-9:fresh-7", kind: "transfer", rowIds: ["fresh-9", "fresh-7"] });
    expect(reviewItemSignature(itemA, indexA)).toBe(reviewItemSignature(itemB, indexB));
  });

  it("review-item signature is order-independent across rowIds", () => {
    const r1 = record({ id: "a", amount: 10, description: "x" });
    const r2 = record({ id: "b", amount: 20, description: "y" });
    const index = buildSignatureIndex([r1, r2]);
    const forward = reviewItemSignature(reviewItem({ id: "i", rowIds: ["a", "b"] }), index);
    const reversed = reviewItemSignature(reviewItem({ id: "i", rowIds: ["b", "a"] }), index);
    expect(forward).toBe(reversed);
  });

  it("restores overrides into an id-keyed map by signature", () => {
    const records = [record({ id: "id-a" })];
    const index = buildSignatureIndex(records);
    const store = createInMemoryWorkspaceStore();
    persistOverride(store, index, "id-a", { parent: "Financing", flow: "revenue" });

    // Reload: same data, NEW id.
    const reloaded = [record({ id: "new-a" })];
    const reloadedIndex = buildSignatureIndex(reloaded);
    const restored = restoreOverrides(store, reloadedIndex);
    expect(restored.get("new-a")).toEqual({ parent: "Financing", flow: "revenue" });
  });

  it("clearPersistedOverride removes a persisted override", () => {
    const index = buildSignatureIndex([record({ id: "id-a" })]);
    const store = createInMemoryWorkspaceStore();
    persistOverride(store, index, "id-a", { parent: "Financing" });
    clearPersistedOverride(store, index, "id-a");
    expect(restoreOverrides(store, index).has("id-a")).toBe(false);
  });

  it("restores review exclusions by mapping stored decisions back to current item ids", () => {
    const records = [
      record({ id: "out-1", amount: 50, description: "transfer out" }),
      record({ id: "rev-1", amount: 50, description: "transfer in" }),
    ];
    const index = buildSignatureIndex(records);
    const store = createInMemoryWorkspaceStore();
    const item = reviewItem({ id: "transfer:out-1:rev-1", kind: "transfer", rowIds: ["out-1", "rev-1"] });
    persistReviewDecision(store, index, item, true);

    // Reload: same data, fresh ids -> fresh synthetic item id.
    const reloaded = [
      record({ id: "z9", amount: 50, description: "transfer out" }),
      record({ id: "z7", amount: 50, description: "transfer in" }),
    ];
    const reloadedIndex = buildSignatureIndex(reloaded);
    const reloadedItem = reviewItem({ id: "transfer:z9:z7", kind: "transfer", rowIds: ["z9", "z7"] });
    const restored = restoreReviewExclusions(store, [reloadedItem], reloadedIndex);
    expect(restored.has("transfer:z9:z7")).toBe(true);
  });

  it("uses a stable kind-only key for rejected items with empty rowIds", () => {
    const indexA = buildSignatureIndex([record({ id: "a" })]);
    const indexB = buildSignatureIndex([record({ id: "b", amount: 200 })]);
    const item = reviewItem({ id: "rejected:rows", kind: "rejected", rowIds: [] });

    expect(reviewItemSignature(item, indexA)).toBe("review:rejected:");
    expect(reviewItemSignature(item, indexB)).toBe("review:rejected:");
    expect(reviewItemSignature(item, indexA)).toBe(reviewItemSignature(item, indexB));
  });

  it("assigns different signatures to same-kind items with disjoint rows", () => {
    const index = buildSignatureIndex([
      record({ id: "a", amount: 10, description: "alpha" }),
      record({ id: "b", amount: 20, description: "beta" }),
    ]);
    const itemA = reviewItem({ id: "duplicate:a", kind: "duplicate", rowIds: ["a"] });
    const itemB = reviewItem({ id: "duplicate:b", kind: "duplicate", rowIds: ["b"] });

    expect(reviewItemSignature(itemA, index)).not.toBe(reviewItemSignature(itemB, index));
  });

  it("filters unresolved rowIds out of review-item signatures instead of throwing", () => {
    const index = buildSignatureIndex([record({ id: "known", amount: 50, description: "present" })]);
    const mixed = reviewItem({ id: "transfer:mixed", kind: "transfer", rowIds: ["known", "missing"] });
    const knownOnly = reviewItem({ id: "transfer:known", kind: "transfer", rowIds: ["known"] });

    expect(() => reviewItemSignature(mixed, index)).not.toThrow();
    expect(reviewItemSignature(mixed, index)).toBe(reviewItemSignature(knownOnly, index));
  });

  it("does not restore exclusions for items whose decision is excluded:false", () => {
    const index = buildSignatureIndex([record({ id: "out-1", amount: 50, description: "x" })]);
    const store = createInMemoryWorkspaceStore();
    const item = reviewItem({ id: "duplicate:k", kind: "duplicate", rowIds: ["out-1"] });
    persistReviewDecision(store, index, item, false);
    expect(restoreReviewExclusions(store, [item], index).has("duplicate:k")).toBe(false);
  });
});
