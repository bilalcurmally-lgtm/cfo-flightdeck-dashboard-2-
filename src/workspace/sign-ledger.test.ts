import { describe, it, expect } from "vitest";
import { signLedger } from "./sign-ledger";
import type { TransactionRecord } from "../finance/types";

function rec(over: Partial<TransactionRecord> = {}): TransactionRecord {
  return {
    id: "t1",
    date: new Date("2026-01-15T00:00:00Z"),
    dateISO: "2026-01-15",
    periodDaily: "2026-01-15",
    periodWeekly: "2026-W03",
    periodMonthly: "2026-01",
    head: "Food",
    parent: "Operating Costs",
    subcategory: "Coffee",
    description: "Cafe receipt",
    counterparty: "Blue Bottle",
    account: "Chase Checking",
    flow: "outflow",
    amount: 5.5,
    signedNet: -5.5,
    runningBalance: null,
    ...over,
  };
}

describe("signLedger", () => {
  it("assigns distinct signatures to identical-looking rows via occurrenceIndex", () => {
    const records = [rec({ id: "a" }), rec({ id: "b" })];
    const signed = signLedger(records);
    expect(signed[0].signature).not.toBe(signed[1].signature);
    expect(signed[0].id).toBe("a");
    expect(signed[1].id).toBe("b");
  });

  it("is deterministic across repeated signings", () => {
    const records = [rec({ id: "a" }), rec({ id: "b", amount: 12 })];
    const first = signLedger(records);
    const second = signLedger(records);
    expect(second).toEqual(first);
  });

  it("keeps signatures stable when only classification fields change", () => {
    const base = [rec({ id: "a" }), rec({ id: "b", amount: 9 })];
    const recategorized = base.map((row) =>
      rec({
        ...row,
        head: "Revenue",
        parent: "Financing",
        subcategory: "Interest",
        counterparty: "Bank",
        flow: "revenue",
        signedNet: Math.abs(row.amount),
      }),
    );
    const baseSigs = signLedger(base).map((row) => row.signature);
    const recategorizedSigs = signLedger(recategorized).map((row) => row.signature);
    expect(recategorizedSigs).toEqual(baseSigs);
  });

  it("preserves order and length and distinct rows get distinct signatures", () => {
    const records = [
      rec({ id: "first", dateISO: "2026-01-01", amount: 1 }),
      rec({ id: "second", dateISO: "2026-01-02", amount: 2 }),
      rec({ id: "third", dateISO: "2026-01-03", amount: 3 }),
    ];
    const signed = signLedger(records);
    expect(signed).toHaveLength(3);
    expect(signed.map((row) => row.id)).toEqual(["first", "second", "third"]);
    const signatures = signed.map((row) => row.signature);
    expect(new Set(signatures).size).toBe(3);
  });
});