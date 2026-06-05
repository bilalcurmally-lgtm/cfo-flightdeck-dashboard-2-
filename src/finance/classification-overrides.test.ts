import { describe, it, expect } from "vitest";
import { applyClassificationOverrides } from "./classification-overrides";
import type { TransactionRecord } from "./types";

export function rec(over: Partial<TransactionRecord>): TransactionRecord {
  return {
    id: "t1", date: new Date("2026-01-01T00:00:00Z"), dateISO: "2026-01-01",
    periodDaily: "2026-01-01", periodWeekly: "2026-W01", periodMonthly: "2026-01",
    head: "Misc", parent: "Operating Costs", subcategory: "", description: "d",
    counterparty: "c", account: "main", flow: "outflow", amount: 5000,
    signedNet: -5000, runningBalance: null, ...over,
  };
}

describe("applyClassificationOverrides", () => {
  it("returns a new array, originals untouched", () => {
    const records = [rec({ id: "a" })];
    const out = applyClassificationOverrides(records, new Map());
    expect(out).not.toBe(records);
    expect(out[0]).toEqual(records[0]);
  });
  it("overrides parent only", () => {
    const out = applyClassificationOverrides([rec({ id: "a" })], new Map([["a", { parent: "Financing" }]]));
    expect(out[0].parent).toBe("Financing");
    expect(out[0].flow).toBe("outflow");
    expect(out[0].signedNet).toBe(-5000);
  });
  it("recomputes signedNet on outflow->revenue flip", () => {
    const out = applyClassificationOverrides([rec({ id: "a", flow: "outflow", amount: 5000, signedNet: -5000 })], new Map([["a", { flow: "revenue" }]]));
    expect(out[0].signedNet).toBe(5000);
  });
  it("recomputes signedNet on revenue->outflow flip", () => {
    const out = applyClassificationOverrides([rec({ id: "a", flow: "revenue", amount: 5000, signedNet: 5000 })], new Map([["a", { flow: "outflow" }]]));
    expect(out[0].signedNet).toBe(-5000);
  });
  it("ignores absent ids", () => {
    const out = applyClassificationOverrides([rec({ id: "a" })], new Map([["ghost", { flow: "revenue" }]]));
    expect(out[0]).toEqual(rec({ id: "a" }));
  });
});
