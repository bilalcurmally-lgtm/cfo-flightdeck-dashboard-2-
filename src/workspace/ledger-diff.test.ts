import { describe, it, expect } from "vitest";
import type { TransactionRecord } from "../finance/types";
import { signLedger } from "./sign-ledger";
import { diffSignedLedgers } from "./ledger-diff";

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

describe("diffSignedLedgers", () => {
  it("classifies every current row as added when previous is empty", () => {
    const current = signLedger([rec({ id: "a" }), rec({ id: "b", amount: 12 })]);

    const diff = diffSignedLedgers([], current);

    expect(diff.added).toEqual(current);
    expect(diff.removed).toEqual([]);
    expect(diff.retained).toEqual([]);
  });

  it("classifies every row as retained when ledgers are identical", () => {
    const records = [rec({ id: "a" }), rec({ id: "b", amount: 12 })];
    const previous = signLedger(records);
    const current = signLedger(records);

    const diff = diffSignedLedgers(previous, current);

    expect(diff.retained).toEqual(current);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
  });

  it("classifies one added and one removed row between imports", () => {
    const previous = signLedger([
      rec({ id: "a", amount: 1, description: "kept" }),
      rec({ id: "b", amount: 2, description: "gone" }),
    ]);
    const current = signLedger([
      rec({ id: "x", amount: 1, description: "kept" }),
      rec({ id: "y", amount: 3, description: "new" }),
    ]);

    const diff = diffSignedLedgers(previous, current);

    expect(diff.retained.map((row) => row.signature)).toEqual([current[0].signature]);
    expect(diff.added.map((row) => row.signature)).toEqual([current[1].signature]);
    expect(diff.removed.map((row) => row.signature)).toEqual([previous[1].signature]);
  });

  it("treats a third occurrence of identical rows as added while retaining the first two", () => {
    const template = rec();
    const previous = signLedger([rec({ id: "a" }), rec({ id: "b" })]);
    const current = signLedger([rec({ id: "a" }), rec({ id: "b" }), rec({ id: "c" })]);

    const diff = diffSignedLedgers(previous, current);

    expect(diff.retained).toEqual([current[0], current[1]]);
    expect(diff.added).toEqual([current[2]]);
    expect(diff.removed).toEqual([]);
    expect(diff.added[0].signature).toBe(signLedger([template, template, template])[2].signature);
  });

  it("preserves current order for added and retained and previous order for removed", () => {
    const previous = signLedger([
      rec({ id: "p1", dateISO: "2026-01-01", amount: 1 }),
      rec({ id: "p2", dateISO: "2026-01-02", amount: 2 }),
      rec({ id: "p3", dateISO: "2026-01-03", amount: 3 }),
    ]);
    const current = signLedger([
      rec({ id: "c2", dateISO: "2026-01-02", amount: 2 }),
      rec({ id: "c4", dateISO: "2026-01-04", amount: 4 }),
      rec({ id: "c1", dateISO: "2026-01-01", amount: 1 }),
    ]);

    const diff = diffSignedLedgers(previous, current);

    expect(diff.retained.map((row) => row.id)).toEqual(["c2", "c1"]);
    expect(diff.added.map((row) => row.id)).toEqual(["c4"]);
    expect(diff.removed.map((row) => row.id)).toEqual(["p3"]);
  });

  it("does not mutate input ledgers", () => {
    const previous = signLedger([rec({ id: "a" })]);
    const current = signLedger([rec({ id: "b" })]);
    const previousBefore = structuredClone(previous);
    const currentBefore = structuredClone(current);

    diffSignedLedgers(previous, current);

    expect(previous).toEqual(previousBefore);
    expect(current).toEqual(currentBefore);
  });
});