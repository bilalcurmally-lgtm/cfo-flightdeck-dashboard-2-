import { describe, expect, it } from "vitest";
import type { TransactionRecord } from "../finance/types";
import { buildTransactionsCsv, transactionsCsvFilename } from "./transactions-csv";

describe("buildTransactionsCsv", () => {
  it("exports normalized transaction rows", () => {
    expect(buildTransactionsCsv([record()])).toBe(
      [
        "date,flow,account,head,parent,subcategory,description,counterparty,amount,signedNet,runningBalance",
        '2026-03-01,outflow,Checking,Software,Operating Costs,Design,"Tool, with comma",Adobe,220,-220,1800'
      ].join("\n")
    );
  });
});

describe("transactionsCsvFilename", () => {
  it("creates a stable safe filename", () => {
    expect(transactionsCsvFilename("Sample Finance.csv", new Date("2026-04-26T00:00:00Z"))).toBe(
      "sample-finance-normalized-transactions-2026-04-26.csv"
    );
  });
});

function record(): TransactionRecord {
  return {
    id: "2026-03-01-0",
    date: new Date("2026-03-01T00:00:00"),
    dateISO: "2026-03-01",
    periodDaily: "2026-03-01",
    periodWeekly: "2026-02-23",
    periodMonthly: "2026-03",
    head: "Software",
    parent: "Operating Costs",
    subcategory: "Design",
    description: "Tool, with comma",
    counterparty: "Adobe",
    account: "Checking",
    flow: "outflow",
    amount: 220,
    signedNet: -220,
    runningBalance: 1800
  };
}
