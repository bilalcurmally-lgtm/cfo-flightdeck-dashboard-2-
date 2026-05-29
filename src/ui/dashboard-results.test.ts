import { placeholderCashHealthLineage, placeholderSummaryLineage } from "../finance/audit-fixtures";
import { describe, expect, it } from "vitest";
import { DEFAULT_FILTERS } from "../finance/filters";
import type { ForecastResult } from "../finance/forecast";
import type { CsvImportResult, TransactionRecord } from "../finance/types";
import type { DashboardViewData } from "../finance/dashboard-view";
import type { FinanceSummary } from "../finance/summary";
import { renderDashboardResults } from "./dashboard-results";

describe("renderDashboardResults", () => {
  it("assembles the dashboard panels from view data", () => {
    const selectedRecord = record("row-1", "revenue", "Checking", "Client");
    const result = csvImportResult(selectedRecord);
    const html = renderDashboardResults({
      result,
      sourceName: "sample.csv",
      view: dashboardView(selectedRecord),
      activeFilters: { ...DEFAULT_FILTERS, flow: "revenue" },
      activeTrendGrain: "weekly",
      activeReviewPreset: "duplicates",
      reviewPresetLabel: "Possible duplicates",
      currencyOptionsHtml: '<option value="USD" selected>USD</option>',
      cashOnHand: 5000,
      formatMoney: (value) => `$${value}`,
      formatRunway: (months) => `${months} months`
    });

    expect(html).toContain("sample.csv");
    expect(html).toContain('aria-label="Cockpit summary"');
    expect(html.indexOf('aria-label="Cockpit summary"')).toBeLessThan(
      html.indexOf('id="filter-title"')
    );
    expect(html).toContain("1 of 1 record shown");
    expect(html).toContain("Cash Health");
    expect(html).toContain('id="export-trend-png"');
    expect(html).toContain("Possible duplicates");
    expect(html).toContain('id="currency-select"');
    expect(html).toContain("13-Week Forecast");
    expect(html).toContain("Duplicate & Transfer Checks");
    expect(html).toContain("Transaction Detail");
  });
});

function dashboardView(selectedRecord: TransactionRecord): DashboardViewData {
  const summaryValue = summary(selectedRecord);
  return {
    baseFilteredRecords: [selectedRecord],
    baseSummary: summaryValue,
    filteredRecords: [selectedRecord],
    summary: summaryValue,
    selectedTransactionId: selectedRecord.id,
    selectedRecord,
    futureEventsText: "2026-04-15, -1200, quarterly tax",
    forecast: forecast()
  };
}

function record(
  id: string,
  flow: TransactionRecord["flow"],
  account: string,
  head: string
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
    account,
    flow,
    amount: 100,
    signedNet: flow === "revenue" ? 100 : -100,
    runningBalance: null
  };
}

function summary(selectedRecord: TransactionRecord): FinanceSummary {
  return {
    revenue: 1200,
    outflow: 300,
    netCash: 900,
    transactionCount: 1,
    periodTrend: [{ period: "2026-W09", revenue: 1200, outflow: 300, netCash: 900 }],
    topHeads: [{ head: "Client", flow: "revenue", amount: 1200, count: 1 }],
    topSubcategories: [
      { head: "Software", subcategory: "Tools", flow: "outflow", amount: 300, count: 1 }
    ],
    accountBalances: [{ account: "Checking", balance: 900, source: "netActivity" }],
    diagnostics: {
      duplicateGroups: [{ key: "same date and amount", records: [selectedRecord] }],
      transferCandidates: []
    },
    warnings: [],
    lineage: placeholderSummaryLineage(),
    cashHealth: {
      lineage: placeholderCashHealthLineage(),
      averageMonthlyOutflow: 300,
      runwayMonths: 2,
      largestTransaction: null,
      revenueConcentration: 0.75
    }
  };
}

function forecast(): ForecastResult {
  return {
    averageWeeklyNet: 100,
    events: [],
    rejectedEvents: [],
    weeks: [{ weekStartISO: "2026-04-13", baselineNet: 100, eventNet: 0, projectedCash: 1100 }]
  };
}

function csvImportResult(selectedRecord: TransactionRecord): CsvImportResult {
  return {
    rawRows: [{ Date: "2026-03-01", Amount: "100", Head: "Client" }],
    records: [selectedRecord],
    rejectedRows: [],
    mapping: { date: "Date", amount: "Amount", head: "Head" },
    dateFormat: "ymd"
  };
}
