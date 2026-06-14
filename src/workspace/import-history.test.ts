import { describe, it, expect } from "vitest";
import {
  compareToBaseline,
  diffKpiSnapshots,
  diffReviewSignatures,
  findComparableBaseline,
  recordImport,
  type ImportSnapshot,
} from "./import-history";

function snap(over: Partial<ImportSnapshot> & { signatureSet: string[] }): ImportSnapshot {
  return {
    importedAt: "2026-01-01T00:00:00.000Z",
    sourceName: "x.csv",
    kpiSnapshot: { runwayMonths: 5 },
    reviewItemSignatures: [],
    ...over,
  };
}

describe("recordImport", () => {
  it("appends a snapshot to empty history", () => {
    const out = recordImport([], snap({ signatureSet: ["a"] }));
    expect(out).toHaveLength(1);
  });

  it("does not mutate the input history", () => {
    const history: ImportSnapshot[] = [];
    recordImport(history, snap({ signatureSet: ["a"] }));
    expect(history).toHaveLength(0);
  });

  it("skips a no-op re-import with an identical signatureSet to the most recent", () => {
    const first = recordImport([], snap({ signatureSet: ["a", "b"] }));
    const second = recordImport(first, snap({ signatureSet: ["a", "b"], sourceName: "again.csv" }));
    expect(second).toHaveLength(1);
    expect(second[0].sourceName).toBe("x.csv");
  });

  it("appends when signatureSet differs from the most recent", () => {
    const first = recordImport([], snap({ signatureSet: ["a"] }));
    const second = recordImport(first, snap({ signatureSet: ["a", "b"] }));
    expect(second).toHaveLength(2);
  });

  it("caps to the most recent N, dropping oldest", () => {
    let history: ImportSnapshot[] = [];
    for (let i = 0; i < 30; i++) {
      history = recordImport(history, snap({ signatureSet: [`sig-${i}`] }), { cap: 24 });
    }
    expect(history).toHaveLength(24);
    expect(history[0].signatureSet).toEqual(["sig-6"]);
    expect(history[23].signatureSet).toEqual(["sig-29"]);
  });
});

describe("findComparableBaseline", () => {
  it("returns undefined when history is empty", () => {
    expect(findComparableBaseline([], ["a"])).toBeUndefined();
  });

  it("returns undefined when no snapshot shares a signature", () => {
    const history = [snap({ signatureSet: ["a", "b"] })];
    expect(findComparableBaseline(history, ["x", "y"])).toBeUndefined();
  });

  it("returns the most recent snapshot sharing >=1 signature", () => {
    const history = [
      snap({ signatureSet: ["a"], sourceName: "old.csv" }),
      snap({ signatureSet: ["a", "b"], sourceName: "mid.csv" }),
      snap({ signatureSet: ["z"], sourceName: "unrelated.csv" }),
    ];
    const baseline = findComparableBaseline(history, ["a", "c"]);
    expect(baseline?.sourceName).toBe("mid.csv");
  });
});

describe("diffKpiSnapshots", () => {
  it("computes per-key delta and direction", () => {
    const deltas = diffKpiSnapshots({ runwayMonths: 7.2 }, { runwayMonths: 5.9 });
    expect(deltas).toHaveLength(1);
    expect(deltas[0]).toMatchObject({
      key: "runwayMonths",
      previous: 7.2,
      current: 5.9,
      direction: "down",
    });
    expect(deltas[0].delta).toBeCloseTo(-1.3, 10);
  });

  it("marks equal values as flat with zero delta", () => {
    const deltas = diffKpiSnapshots({ revenue: 100 }, { revenue: 100 });
    expect(deltas[0]).toMatchObject({ delta: 0, direction: "flat" });
  });

  it("uses null delta when either side is null", () => {
    const deltas = diffKpiSnapshots({ runwayMonths: null }, { runwayMonths: 5 });
    expect(deltas[0]).toMatchObject({ previous: null, current: 5, delta: null, direction: "flat" });
  });

  it("includes keys present in either snapshot", () => {
    const deltas = diffKpiSnapshots({ a: 1 }, { b: 2 });
    expect(deltas.map((d) => d.key).sort()).toEqual(["a", "b"]);
  });
});

describe("diffReviewSignatures", () => {
  it("counts added and resolved review items", () => {
    expect(diffReviewSignatures(["x", "y"], ["y", "z"])).toEqual({ added: 1, resolved: 1 });
  });
  it("is all-added when previous is empty", () => {
    expect(diffReviewSignatures([], ["a", "b"])).toEqual({ added: 2, resolved: 0 });
  });
});

describe("compareToBaseline", () => {
  it("bundles txn, kpi, and review deltas against a baseline", () => {
    const baseline = snap({
      signatureSet: ["a", "b"],
      kpiSnapshot: { runwayMonths: 7 },
      reviewItemSignatures: ["r1"],
    });
    const current = snap({
      signatureSet: ["a", "b", "c"],
      kpiSnapshot: { runwayMonths: 6 },
      reviewItemSignatures: ["r1", "r2"],
      sourceName: "new.csv",
    });
    const cmp = compareToBaseline(baseline, current);
    expect(cmp.addedTransactions).toBe(1);
    expect(cmp.removedTransactions).toBe(0);
    expect(cmp.review).toEqual({ added: 1, resolved: 0 });
    expect(cmp.kpiDeltas.find((d) => d.key === "runwayMonths")?.direction).toBe("down");
    expect(cmp.baseline).toBe(baseline);
  });
});