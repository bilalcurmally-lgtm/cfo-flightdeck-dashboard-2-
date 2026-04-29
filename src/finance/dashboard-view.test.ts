import { describe, expect, it } from "vitest";
import { DEFAULT_FILTERS } from "./filters";
import { buildDashboardView } from "./dashboard-view";
import type { CsvImportResult, TransactionRecord } from "./types";

describe("buildDashboardView", () => {
  it("filters records, applies review preset, and chooses the first visible transaction", () => {
    const view = buildDashboardView({
      result: importResult([
        record("r1", "revenue", "Client", 1000),
        record("o1", "outflow", "Software", 100),
        record("o2", "outflow", "Meals", 50)
      ]),
      filters: { ...DEFAULT_FILTERS, flow: "outflow" },
      trendGrain: "monthly",
      reviewPreset: "outflow",
      selectedTransactionId: "missing",
      cashOnHand: 500,
      futureEventsText: "2026-04-15, -25, domain renewal"
    });

    expect(view.baseFilteredRecords.map((item) => item.id)).toEqual(["o1", "o2"]);
    expect(view.filteredRecords.map((item) => item.id)).toEqual(["o1", "o2"]);
    expect(view.selectedTransactionId).toBe("o1");
    expect(view.selectedRecord?.id).toBe("o1");
    expect(view.summary.outflow).toBe(150);
    expect(view.forecast.events).toEqual([
      { dateISO: "2026-04-15", amount: -25, label: "domain renewal" }
    ]);
  });

  it("keeps an already-visible selected transaction", () => {
    const view = buildDashboardView({
      result: importResult([
        record("r1", "revenue", "Client", 1000),
        record("o1", "outflow", "Software", 100)
      ]),
      filters: DEFAULT_FILTERS,
      trendGrain: "monthly",
      reviewPreset: "all",
      selectedTransactionId: "o1",
      cashOnHand: 0,
      futureEventsText: ""
    });

    expect(view.selectedTransactionId).toBe("o1");
  });
});

function importResult(records: TransactionRecord[]): CsvImportResult {
  return {
    rawRows: [],
    records,
    rejectedRows: [],
    mapping: { date: "Date", amount: "Amount" },
    dateFormat: "ymd"
  };
}

function record(
  id: string,
  flow: TransactionRecord["flow"],
  head: string,
  amount: number
): TransactionRecord {
  return {
    id,
    date: new Date("2026-03-01T00:00:00"),
    dateISO: "2026-03-01",
    periodDaily: "2026-03-01",
    periodWeekly: "2026-02-23",
    periodMonthly: "2026-03",
    head,
    parent: "Group",
    subcategory: "Subcategory",
    description: "Description",
    counterparty: "Counterparty",
    account: "Checking",
    flow,
    amount,
    signedNet: flow === "revenue" ? amount : -amount,
    runningBalance: null
  };
}
