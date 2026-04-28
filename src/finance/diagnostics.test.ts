import { describe, expect, it } from "vitest";
import { analyzeImportDiagnostics } from "./diagnostics";
import type { TransactionRecord } from "./types";

describe("analyzeImportDiagnostics", () => {
  it("detects exact duplicate transaction candidates", () => {
    const diagnostics = analyzeImportDiagnostics([
      record("a", "2026-03-05", "outflow", "Checking", "Software", "Tools", 220),
      record("b", "2026-03-05", "outflow", "Checking", "Software", "Tools", 220),
      record("c", "2026-03-05", "outflow", "Checking", "Software", "Other tools", 220)
    ]);

    expect(diagnostics.duplicateGroups).toHaveLength(1);
    expect(diagnostics.duplicateGroups[0].records.map((item) => item.id)).toEqual(["a", "b"]);
  });

  it("detects same-day equal-and-opposite transfer candidates across accounts", () => {
    const diagnostics = analyzeImportDiagnostics([
      record("out", "2026-03-10", "outflow", "Checking", "Transfer", "Move to savings", 500),
      record("in", "2026-03-10", "revenue", "Savings", "Transfer", "Move from checking", 500)
    ]);

    expect(diagnostics.transferCandidates).toEqual([
      {
        dateISO: "2026-03-10",
        amount: 500,
        fromAccount: "Checking",
        toAccount: "Savings",
        outflowId: "out",
        revenueId: "in"
      }
    ]);
  });
});

function record(
  id: string,
  dateISO: string,
  flow: TransactionRecord["flow"],
  account: string,
  head: string,
  description: string,
  amount: number
): TransactionRecord {
  return {
    id,
    date: new Date(`${dateISO}T00:00:00`),
    dateISO,
    periodDaily: dateISO,
    periodWeekly: dateISO,
    periodMonthly: dateISO.slice(0, 7),
    head,
    parent: "Group",
    subcategory: "Unassigned Subcategory",
    description,
    counterparty: "Unassigned Counterparty",
    account,
    flow,
    amount,
    signedNet: flow === "revenue" ? amount : -amount,
    runningBalance: null
  };
}
