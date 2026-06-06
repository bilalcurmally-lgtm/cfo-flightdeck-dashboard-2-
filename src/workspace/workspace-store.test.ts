import { describe, it, expect } from "vitest";
import {
  WORKSPACE_SNAPSHOT_VERSION,
  createInMemoryWorkspaceStore,
  type WorkspaceSnapshot,
} from "./workspace-store";

const SIG_A = "txn_aaaaaaaaaaaaaaaa";
const SIG_B = "txn_bbbbbbbbbbbbbbbb";

describe("createInMemoryWorkspaceStore", () => {
  it("round-trips category overrides and returns undefined for unknown signatures", () => {
    const store = createInMemoryWorkspaceStore();
    expect(store.getCategoryOverride(SIG_A)).toBeUndefined();

    store.setCategoryOverride(SIG_A, { parent: "Financing", flow: "revenue" });
    expect(store.getCategoryOverride(SIG_A)).toEqual({ parent: "Financing", flow: "revenue" });

    store.clearCategoryOverride(SIG_A);
    expect(store.getCategoryOverride(SIG_A)).toBeUndefined();
    expect(store.getCategoryOverride(SIG_B)).toBeUndefined();
  });

  it("round-trips exclusion decisions and returns undefined for unknown signatures", () => {
    const store = createInMemoryWorkspaceStore();
    expect(store.getDecision(SIG_B)).toBeUndefined();

    store.setDecision(SIG_B, { excluded: true });
    expect(store.getDecision(SIG_B)).toEqual({ excluded: true });

    store.clearDecision(SIG_B);
    expect(store.getDecision(SIG_B)).toBeUndefined();
  });

  it("restores full state via snapshot and load on a fresh store", () => {
    const store = createInMemoryWorkspaceStore();
    store.setCategoryOverride(SIG_A, { parent: "Operating Costs" });
    store.setDecision(SIG_B, { excluded: false });

    const snap = store.snapshot();
    const fresh = createInMemoryWorkspaceStore();
    fresh.load(snap);

    expect(fresh.getCategoryOverride(SIG_A)).toEqual({ parent: "Operating Costs" });
    expect(fresh.getDecision(SIG_B)).toEqual({ excluded: false });
    expect(fresh.snapshot()).toEqual(snap);
  });

  it("deep-copies on snapshot and load so caller mutations do not affect the store", () => {
    const store = createInMemoryWorkspaceStore();
    store.setCategoryOverride(SIG_A, { parent: "Food" });
    store.setDecision(SIG_B, { excluded: true });

    const snap = store.snapshot();
    snap.categoryOverrides[SIG_A] = { parent: "Mutated" };
    snap.decisions[SIG_B] = { excluded: false };
    expect(store.getCategoryOverride(SIG_A)).toEqual({ parent: "Food" });
    expect(store.getDecision(SIG_B)).toEqual({ excluded: true });

    const incoming: WorkspaceSnapshot = {
      version: WORKSPACE_SNAPSHOT_VERSION,
      categoryOverrides: { [SIG_A]: { flow: "outflow" } },
      decisions: { [SIG_B]: { excluded: false } },
      imports: [],
    };
    store.load(incoming);
    incoming.categoryOverrides[SIG_A] = { parent: "After load" };
    incoming.decisions[SIG_B] = { excluded: true };
    expect(store.getCategoryOverride(SIG_A)).toEqual({ flow: "outflow" });
    expect(store.getDecision(SIG_B)).toEqual({ excluded: false });
  });

  it("isolates nested mutations on getCategoryOverride results from stored state", () => {
    const store = createInMemoryWorkspaceStore();
    store.setCategoryOverride(SIG_A, { parent: "Food", flow: "outflow" });

    const override = store.getCategoryOverride(SIG_A);
    expect(override).toBeDefined();
    override!.parent = "Mutated parent";
    override!.flow = "revenue";

    expect(store.getCategoryOverride(SIG_A)).toEqual({ parent: "Food", flow: "outflow" });
  });

  it("isolates nested mutations on snapshot fields from stored state", () => {
    const store = createInMemoryWorkspaceStore();
    store.setCategoryOverride(SIG_A, { parent: "Food", flow: "outflow" });
    store.setDecision(SIG_B, { excluded: true });

    const snap = store.snapshot();
    snap.categoryOverrides[SIG_A]!.parent = "Mutated parent";
    snap.categoryOverrides[SIG_A]!.flow = "revenue";
    snap.decisions[SIG_B]!.excluded = false;

    expect(store.getCategoryOverride(SIG_A)).toEqual({ parent: "Food", flow: "outflow" });
    expect(store.getDecision(SIG_B)).toEqual({ excluded: true });
  });

  it("seeds from initial snapshot", () => {
    const initial: WorkspaceSnapshot = {
      version: WORKSPACE_SNAPSHOT_VERSION,
      categoryOverrides: { [SIG_A]: { parent: "Seed" } },
      decisions: { [SIG_B]: { excluded: true } },
      imports: [],
    };
    const store = createInMemoryWorkspaceStore(initial);
    expect(store.getCategoryOverride(SIG_A)).toEqual({ parent: "Seed" });
    expect(store.getDecision(SIG_B)).toEqual({ excluded: true });

    initial.categoryOverrides[SIG_A] = { parent: "Mutated seed" };
    expect(store.getCategoryOverride(SIG_A)).toEqual({ parent: "Seed" });
  });
});

describe("workspace-store v2 migration", () => {
  it("creates v2 snapshots with an empty imports array", () => {
    const store = createInMemoryWorkspaceStore();
    const snap = store.snapshot();
    expect(snap.version).toBe(2);
    expect(snap.imports).toEqual([]);
  });

  it("migrates a v1 snapshot (no imports, version 1) on load", () => {
    const store = createInMemoryWorkspaceStore();
    store.load({ version: 1, categoryOverrides: {}, decisions: {} } as never);
    const snap = store.snapshot();
    expect(snap.version).toBe(WORKSPACE_SNAPSHOT_VERSION);
    expect(snap.imports).toEqual([]);
  });

  it("preserves an existing imports array on load", () => {
    const store = createInMemoryWorkspaceStore();
    const imp = {
      importedAt: "2026-01-01T00:00:00.000Z",
      sourceName: "x.csv",
      signatureSet: ["txn_a"],
      kpiSnapshot: { runwayMonths: 5 },
      reviewItemSignatures: [],
    };
    store.load({ version: 2, categoryOverrides: {}, decisions: {}, imports: [imp] });
    expect(store.snapshot().imports).toEqual([imp]);
  });
});