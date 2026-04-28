import { describe, expect, it } from "vitest";
import { DEFAULT_FILTERS, filterTransactions, optionValues } from "./filters";
import type { TransactionRecord } from "./types";

function record(partial: Partial<TransactionRecord>): TransactionRecord {
  const dateISO = partial.dateISO ?? "2026-03-01";

  return {
    id: partial.id ?? dateISO,
    date: new Date(`${dateISO}T00:00:00Z`),
    dateISO,
    periodDaily: dateISO,
    periodWeekly: partial.periodWeekly ?? dateISO,
    periodMonthly: partial.periodMonthly ?? dateISO.slice(0, 7),
    head: partial.head ?? "Client Work",
    parent: partial.parent ?? "Income",
    subcategory: partial.subcategory ?? "Retainer",
    description: partial.description ?? "Invoice",
    counterparty: partial.counterparty ?? "Client A",
    account: partial.account ?? "Checking",
    flow: partial.flow ?? "revenue",
    amount: partial.amount ?? 100,
    signedNet: partial.signedNet ?? 100,
    runningBalance: partial.runningBalance ?? null
  };
}

describe("filterTransactions", () => {
  const records = [
    record({ id: "1", dateISO: "2026-03-01", flow: "revenue", account: "Checking" }),
    record({ id: "2", dateISO: "2026-03-10", flow: "outflow", account: "Credit Card", head: "Software" }),
    record({ id: "3", dateISO: "2026-03-20", flow: "revenue", account: "Savings", counterparty: "Client B" })
  ];

  it("applies categorical filters", () => {
    expect(filterTransactions(records, { ...DEFAULT_FILTERS, flow: "revenue" }).map((item) => item.id)).toEqual([
      "1",
      "3"
    ]);
    expect(filterTransactions(records, { ...DEFAULT_FILTERS, account: "Credit Card" }).map((item) => item.id)).toEqual([
      "2"
    ]);
  });

  it("applies inclusive date range filters", () => {
    expect(
      filterTransactions(records, { ...DEFAULT_FILTERS, dateFrom: "2026-03-05", dateTo: "2026-03-20" }).map(
        (item) => item.id
      )
    ).toEqual(["2", "3"]);
  });
});

describe("optionValues", () => {
  it("returns sorted unique values for a filter field", () => {
    expect(
      optionValues(
        [
          record({ account: "Savings" }),
          record({ account: "Checking" }),
          record({ account: "Savings" })
        ],
        "account"
      )
    ).toEqual(["Checking", "Savings"]);
  });
});
