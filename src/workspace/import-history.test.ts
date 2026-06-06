import { describe, it, expect } from "vitest";
import { recordImport, type ImportSnapshot } from "./import-history";

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