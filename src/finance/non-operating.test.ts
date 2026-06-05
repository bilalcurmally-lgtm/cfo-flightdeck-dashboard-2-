import { describe, it, expect } from "vitest";
import { summarizeNonOperating } from "./non-operating";
import { rec } from "./classification-overrides.test";

describe("summarizeNonOperating", () => {
  it("totals signedNet and splits in/out", () => {
    const s = summarizeNonOperating([
      rec({ id: "fin", flow: "revenue", parent: "Financing", amount: 5000, signedNet: 5000 }),
      rec({ id: "int", flow: "outflow", parent: "Internal", amount: 2000, signedNet: -2000 }),
    ]);
    expect(s.total).toBe(3000);
    expect(s.revenueIn).toBe(5000);
    expect(s.outflowOut).toBe(2000);
    expect(s.rows.map((r) => r.id)).toEqual(["fin", "int"]);
  });
  it("is empty for no rows", () => {
    const s = summarizeNonOperating([]);
    expect(s).toEqual({ total: 0, revenueIn: 0, outflowOut: 0, rows: [] });
  });
});
