import { describe, it, expect } from "vitest";
import { txnSignature } from "./txn-signature";
import type { TransactionRecord } from "../finance/types";

function baseRecord(over: Partial<TransactionRecord> = {}): TransactionRecord {
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

describe("txnSignature", () => {
  it("keeps identical-looking rows distinct via occurrenceIndex", () => {
    const record = baseRecord();
    expect(txnSignature(record, 0)).not.toBe(txnSignature(record, 1));
  });

  it("is stable across recategorization of mutable classification fields", () => {
    const base = baseRecord();
    const recategorized = baseRecord({
      head: "Revenue",
      parent: "Financing",
      subcategory: "Interest",
      counterparty: "Bank",
      flow: "revenue",
      signedNet: 5.5,
    });
    expect(txnSignature(base, 2)).toBe(txnSignature(recategorized, 2));
  });

  it("changes when each immutable import identity field changes", () => {
    const anchor = baseRecord({ sourceSheet: "Transactions" });
    const sig = txnSignature(anchor, 0);

    expect(txnSignature(baseRecord({ dateISO: "2026-01-16" }), 0)).not.toBe(sig);
    expect(txnSignature(baseRecord({ amount: 6 }), 0)).not.toBe(sig);
    expect(txnSignature(baseRecord({ description: "Different cafe" }), 0)).not.toBe(sig);
    expect(txnSignature(baseRecord({ account: "Amex" }), 0)).not.toBe(sig);
    expect(txnSignature(baseRecord({ sourceSheet: "OtherSheet" }), 0)).not.toBe(sig);
  });

  it("treats missing sourceSheet as explicit empty and stable", () => {
    const withoutSheet = baseRecord({ sourceSheet: undefined });
    const first = txnSignature(withoutSheet, 0);
    const second = txnSignature(withoutSheet, 0);
    expect(first).toBe(second);
    expect(first).not.toBe(txnSignature(baseRecord({ sourceSheet: "Sheet1" }), 0));
  });

  it("returns a txn_ prefixed deterministic id", () => {
    expect(txnSignature(baseRecord(), 0)).toMatch(/^txn_[0-9a-f]{16}$/);
  });
});