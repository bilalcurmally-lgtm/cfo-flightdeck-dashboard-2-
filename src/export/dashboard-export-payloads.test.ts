import { describe, expect, it } from "vitest";
import type { FinanceSummary } from "../finance/summary";
import type { CsvImportResult, TransactionRecord } from "../finance/types";
import {
  buildFilteredTransactionsCsvExport,
  buildReviewerExportReport,
  buildTransactionsCsvExport,
  buildTrendCsvExport,
  buildTrendSvgExport
} from "./dashboard-export-payloads";

describe("buildReviewerExportReport", () => {
  it("builds the full-import reviewer report from current export inputs", () => {
    const report = buildReviewerExportReport({
      sourceName: "sample-finance.csv",
      result: importResult(),
      cashOnHand: 2000,
      futureEventsText: "2026-04-01, -500, Tax payment\nsoon, nope, Mystery",
      trendGrain: "weekly",
      generatedAt: new Date("2026-04-26T12:00:00Z"),
      forecastStartDate: new Date("2026-03-30T00:00:00")
    });

    expect(report).toMatchObject({
      sourceName: "sample-finance.csv",
      generatedAt: "2026-04-26T12:00:00.000Z",
      import: {
        rawRows: 2,
        acceptedRows: 2,
        rejectedRows: 0
      },
      summary: {
        revenue: 1000,
        outflow: 250,
        netCash: 750,
        runwayMonths: 8
      },
      forecast: {
        averageWeeklyNet: 750,
        manualEvents: [{ dateISO: "2026-04-01", amount: -500, label: "Tax payment" }],
        rejectedManualEvents: ["Line 2: soon, nope, Mystery"]
      }
    });
  });
});

describe("dashboard text export builders", () => {
  const generatedAt = new Date("2026-04-26T00:00:00Z");

  it("builds transaction CSV export descriptors", () => {
    const result = importResult();

    expect(buildTransactionsCsvExport("Sample Finance.csv", result.records, generatedAt)).toMatchObject({
      filename: "sample-finance-normalized-transactions-2026-04-26.csv",
      mediaType: "text/csv;charset=utf-8",
      contents: expect.stringContaining("date,flow,account,head")
    });
    expect(buildFilteredTransactionsCsvExport("Sample Finance.csv", result.records, generatedAt)).toMatchObject({
      filename: "sample-finance-2026-04-26-filtered-transactions.csv",
      mediaType: "text/csv;charset=utf-8"
    });
  });

  it("builds trend CSV and SVG export descriptors", () => {
    expect(buildTrendCsvExport("Sample Finance.csv", summary(), "weekly", generatedAt)).toMatchObject({
      filename: "sample-finance-visible-weekly-trend-2026-04-26.csv",
      mediaType: "text/csv;charset=utf-8",
      contents: expect.stringContaining("period,revenue,outflow,netCash")
    });
    expect(
      buildTrendSvgExport({
        sourceName: "Sample Finance.csv",
        summary: summary(),
        trendGrain: "weekly",
        reviewPreset: "revenue",
        currency: "USD",
        generatedAt
      })
    ).toMatchObject({
      filename: "sample-finance-visible-weekly-trend-2026-04-26.svg",
      mediaType: "image/svg+xml;charset=utf-8",
      contents: expect.stringContaining("Weekly Trend")
    });
  });
});

function importResult(): CsvImportResult {
  return {
    rawRows: [
      { Date: "2026-03-02", Amount: "1000" },
      { Date: "2026-03-03", Amount: "-250" }
    ],
    records: [record("2026-03-02", "revenue", 1000), record("2026-03-03", "outflow", 250)],
    rejectedRows: [],
    mapping: { date: "Date", amount: "Amount" },
    dateFormat: "ymd"
  };
}

function summary(): FinanceSummary {
  return {
    revenue: 1000,
    outflow: 250,
    netCash: 750,
    transactionCount: 2,
    periodTrend: [{ period: "2026-03", revenue: 1000, outflow: 250, netCash: 750 }],
    topHeads: [],
    topSubcategories: [],
    accountBalances: [],
    warnings: [],
    cashHealth: {
      averageMonthlyOutflow: 250,
      runwayMonths: 8,
      largestTransaction: null,
      revenueConcentration: 1
    },
    diagnostics: { duplicateGroups: [], transferCandidates: [] }
  };
}

function record(dateISO: string, flow: TransactionRecord["flow"], amount: number): TransactionRecord {
  const date = new Date(`${dateISO}T00:00:00`);

  return {
    id: `${dateISO}-${flow}`,
    date,
    dateISO,
    periodDaily: dateISO,
    periodWeekly: "2026-03-02",
    periodMonthly: "2026-03",
    head: flow === "revenue" ? "Client" : "Software",
    parent: flow === "revenue" ? "Income" : "Operating Costs",
    subcategory: flow === "revenue" ? "Retainer" : "Tools",
    description: "Memo",
    counterparty: "Counterparty",
    account: "Operating",
    flow,
    amount,
    signedNet: flow === "revenue" ? amount : -amount,
    runningBalance: null
  };
}
