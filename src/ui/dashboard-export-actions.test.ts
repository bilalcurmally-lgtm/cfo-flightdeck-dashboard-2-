import { placeholderCashHealthLineage, placeholderSummaryLineage } from "../finance/audit-fixtures";
import { describe, expect, it } from "vitest";
import type { FinanceSummary } from "../finance/summary";
import type { CsvImportResult, TransactionRecord } from "../finance/types";
import {
  bindDashboardExportActions,
  buildTrendSvgExportInput,
  type DashboardExportActionRoot
} from "./dashboard-export-actions";

describe("bindDashboardExportActions", () => {
  it("wires transaction, visible transaction, trend, reviewer, and print actions", () => {
    const buttons = {
      "#export-reviewer": button(),
      "#export-transactions": button(),
      "#export-transactions-xlsx": button(),
      "#export-visible-transactions": button(),
      "#export-trend": button(),
      "#export-trend-svg": button(),
      "#print-report": button()
    };
    const textDownloads: string[] = [];
    const jsonDownloads: string[] = [];
    const blobDownloads: string[] = [];
    let printCount = 0;

    bindDashboardExportActions({
      root: root(buttons),
      status: { textContent: "" },
      visibleSummary: summary(),
      visibleRecords: [record()],
      getActiveImport: () => ({ result: importResult(), sourceName: "sample.csv" }),
      getCashOnHand: () => 5000,
      getFutureEventsText: () => "2026-05-01, 100, Client",
      getTrendGrain: () => "monthly",
      getReviewPreset: () => "all",
      getCurrency: () => "USD",
      downloads: {
        blob: (filename) => {
          blobDownloads.push(filename);
        },
        json: (filename) => {
          jsonDownloads.push(filename);
        },
        text: (filename) => {
          textDownloads.push(filename);
        }
      },
      print: () => {
        printCount += 1;
      },
      now: () => new Date("2026-05-04T12:00:00.000Z")
    });

    buttons["#export-reviewer"].fire("click");
    buttons["#export-transactions"].fire("click");
    buttons["#export-transactions-xlsx"].fire("click");
    buttons["#export-visible-transactions"].fire("click");
    buttons["#export-trend"].fire("click");
    buttons["#export-trend-svg"].fire("click");
    buttons["#print-report"].fire("click");

    expect(jsonDownloads).toEqual(["sample-review-summary-2026-05-04.json"]);
    expect(blobDownloads).toEqual(["sample-normalized-transactions-2026-05-04.xlsx"]);
    expect(textDownloads).toEqual([
      "sample-normalized-transactions-2026-05-04.csv",
      "sample-2026-05-04-filtered-transactions.csv",
      "sample-visible-monthly-trend-2026-05-04.csv",
      "sample-visible-monthly-trend-2026-05-04.svg"
    ]);
    expect(printCount).toBe(1);
  });
});

describe("buildTrendSvgExportInput", () => {
  it("uses the active import source name when available", () => {
    expect(
      buildTrendSvgExportInput({ result: importResult(), sourceName: "agency.csv" }, summary(), {
        trendGrain: "weekly",
        reviewPreset: "duplicates",
        currency: "PKR"
      })
    ).toMatchObject({
      sourceName: "agency.csv",
      trendGrain: "weekly",
      reviewPreset: "duplicates",
      currency: "PKR"
    });
  });
});

function root(buttons: Record<string, FakeButton>): DashboardExportActionRoot {
  return {
    querySelector: (selector: string) => buttons[selector] ?? null
  } as unknown as DashboardExportActionRoot;
}

interface FakeButton {
  disabled: boolean;
  addEventListener: (event: string, listener: () => void | Promise<void>) => void;
  fire: (event: string) => void;
}

function button(): FakeButton {
  const listeners = new Map<string, () => void | Promise<void>>();
  return {
    disabled: false,
    addEventListener: (event, listener) => {
      listeners.set(event, listener);
    },
    fire: (event) => {
      void listeners.get(event)?.();
    }
  };
}

function importResult(): CsvImportResult {
  const transaction = record();
  return {
    rawRows: [{ Date: transaction.dateISO, Amount: "100", Head: transaction.head }],
    records: [transaction],
    rejectedRows: [],
    mapping: { date: "Date", amount: "Amount", head: "Head" },
    dateFormat: "ymd"
  };
}

function record(): TransactionRecord {
  return {
    id: "txn-1",
    date: new Date("2026-05-04T00:00:00"),
    dateISO: "2026-05-04",
    periodDaily: "2026-05-04",
    periodWeekly: "2026-05-04",
    periodMonthly: "2026-05",
    head: "Client",
    parent: "Income",
    subcategory: "Retainer",
    description: "Design retainer",
    counterparty: "Client Co",
    account: "Checking",
    flow: "revenue",
    amount: 100,
    signedNet: 100,
    runningBalance: null
  };
}

function summary(): FinanceSummary {
  return {
    revenue: 100,
    outflow: 0,
    netCash: 100,
    transactionCount: 1,
    periodTrend: [{ period: "2026-05", revenue: 100, outflow: 0, netCash: 100 }],
    topHeads: [{ head: "Client", flow: "revenue", amount: 100, count: 1 }],
    topSubcategories: [],
    accountBalances: [{ account: "Checking", balance: 100, source: "netActivity" }],
    diagnostics: { duplicateGroups: [], transferCandidates: [] },
    warnings: [],
    lineage: placeholderSummaryLineage(),
    cashHealth: {
      lineage: placeholderCashHealthLineage(),
      averageMonthlyOutflow: 0,
      runwayMonths: null,
      largestTransaction: null,
      revenueConcentration: 1
    }
  };
}
