import { describe, expect, it } from "vitest";
import type { ForecastResult } from "../finance/forecast";
import type { FinanceSummary } from "../finance/summary";
import type { CsvImportResult, TransactionRecord } from "../finance/types";
import { buildReviewerReport, reviewerReportFilename } from "./reviewer-report";

describe("buildReviewerReport", () => {
  it("builds an auditable local reviewer payload", () => {
    const generatedAt = new Date("2026-04-26T12:00:00Z");
    const report = buildReviewerReport(
      "sample-finance.csv",
      importResult(),
      summary(),
      forecast(),
      generatedAt
    );

    expect(report).toMatchObject({
      sourceName: "sample-finance.csv",
      generatedAt: "2026-04-26T12:00:00.000Z",
      privacy: "Generated locally in the browser. Transaction data is not uploaded by default.",
      import: {
        rawRows: 1,
        acceptedRows: 1,
        rejectedRows: 0,
        dateFormat: "ymd",
        mapping: { date: "Date", amount: "Amount" }
      },
      summary: {
        revenue: 1000,
        outflow: 250,
        netCash: 750,
        averageMonthlyOutflow: 250,
        runwayMonths: 4,
        revenueConcentration: 1
      },
      qualitySignals: ["100% of revenue comes from one head."],
      accountBalances: [{ account: "Operating", balance: 750, source: "netActivity" }],
      topSubcategories: [{ head: "Client A", subcategory: "Retainer", flow: "revenue", amount: 1000, count: 1 }],
      diagnostics: { duplicateGroups: [], transferCandidates: [] },
      forecast: {
        averageWeeklyNet: 750,
        manualEvents: [{ dateISO: "2026-05-01", amount: 500, label: "Client payment" }],
        rejectedManualEvents: []
      }
    });
  });

  it("summarizes accepted rows by source worksheet when provenance is available", () => {
    const result = importResult();
    result.records = [
      { ...record(), id: "jan-1", sourceSheet: "Jan 2026" },
      { ...record(), id: "jan-2", sourceSheet: "Jan 2026" },
      { ...record(), id: "feb-1", sourceSheet: "Feb 2026" },
      { ...record(), id: "csv-1", sourceSheet: undefined }
    ];

    const report = buildReviewerReport(
      "northstar.xlsx",
      result,
      summary(),
      forecast(),
      new Date("2026-04-26T12:00:00Z")
    );

    expect(report.import.sourceSheets).toEqual([
      { name: "Jan 2026", acceptedRows: 2 },
      { name: "Feb 2026", acceptedRows: 1 }
    ]);
  });

  it("adds a compact diagnostic summary for reviewer triage", () => {
    const duplicateA = { ...record(), id: "dup-a" };
    const duplicateB = { ...record(), id: "dup-b" };
    const transferOut = { ...record(), id: "transfer-out", flow: "outflow" as const, signedNet: -1000 };
    const transferIn = { ...record(), id: "transfer-in" };

    const report = buildReviewerReport(
      "sample-finance.csv",
      importResult(),
      {
        ...summary(),
        diagnostics: {
          duplicateGroups: [{ key: "same-row", records: [duplicateA, duplicateB] }],
          transferCandidates: [
            {
              dateISO: "2026-03-01",
              amount: 1000,
              fromAccount: "Operating",
              toAccount: "Savings",
              outflowId: transferOut.id,
              revenueId: transferIn.id
            }
          ]
        }
      },
      forecast(),
      new Date("2026-04-26T12:00:00Z")
    );

    expect(report.diagnosticSummary).toEqual({
      duplicateGroups: 1,
      duplicateRecords: 2,
      transferCandidates: 1,
      transferRecords: 2
    });
  });
});

describe("reviewerReportFilename", () => {
  it("creates a stable safe filename", () => {
    expect(reviewerReportFilename("Sample Finance.csv", new Date("2026-04-26T00:00:00Z"))).toBe(
      "sample-finance-review-summary-2026-04-26.json"
    );
  });
});

function importResult(): CsvImportResult {
  return {
    rawRows: [{ Date: "2026-03-01", Amount: "1000" }],
    records: [record()],
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
    transactionCount: 1,
    periodTrend: [{ period: "2026-03", revenue: 1000, outflow: 250, netCash: 750 }],
    topHeads: [{ head: "Client A", flow: "revenue", amount: 1000, count: 1 }],
    topSubcategories: [{ head: "Client A", subcategory: "Retainer", flow: "revenue", amount: 1000, count: 1 }],
    accountBalances: [{ account: "Operating", balance: 750, source: "netActivity" }],
    warnings: [{ level: "warning", message: "100% of revenue comes from one head." }],
    cashHealth: {
      averageMonthlyOutflow: 250,
      runwayMonths: 4,
      largestTransaction: record(),
      revenueConcentration: 1
    },
    diagnostics: { duplicateGroups: [], transferCandidates: [] }
  };
}

function forecast(): ForecastResult {
  return {
    averageWeeklyNet: 750,
    events: [{ dateISO: "2026-05-01", amount: 500, label: "Client payment" }],
    rejectedEvents: [],
    weeks: [{ weekStartISO: "2026-04-27", baselineNet: 750, eventNet: 500, projectedCash: 1250 }]
  };
}

function record(): TransactionRecord {
  return {
    id: "2026-03-01-0",
    date: new Date("2026-03-01T00:00:00"),
    dateISO: "2026-03-01",
    periodDaily: "2026-03-01",
    periodWeekly: "2026-02-23",
    periodMonthly: "2026-03",
    head: "Client A",
    parent: "Income",
    subcategory: "Retainer",
    description: "Invoice",
    counterparty: "Client A",
    account: "Operating",
    flow: "revenue",
    amount: 1000,
    signedNet: 1000,
    runningBalance: null
  };
}
