import { describe, expect, it } from "vitest";
import { DEFAULT_FILTERS } from "../finance/filters";
import type { ForecastResult } from "../finance/forecast";
import type { CsvImportResult, TransactionRecord } from "../finance/types";
import type { FinanceSummary } from "../finance/summary";
import {
  renderCashHealthPanel,
  renderCurrencyOptions,
  renderDashboardFilterPanel,
  renderDetailGrid,
  renderDiagnosticsPanel,
  renderExportPanel,
  renderForecastPanel,
  renderInsightGrid,
  renderSettingsPanel,
  renderSummaryGrid
} from "./dashboard-sections";

describe("renderDashboardFilterPanel", () => {
  it("renders filter controls, active preset text, and diagnostic preset counts", () => {
    const html = renderDashboardFilterPanel({
      records: [
        record("r1", "revenue", "Checking", "Client"),
        record("o1", "outflow", "Credit Card", "Software")
      ],
      filteredRecordCount: 1,
      activeFilters: { ...DEFAULT_FILTERS, flow: "revenue", dateFrom: "2026-03-01" },
      activeTrendGrain: "weekly",
      activeReviewPreset: "duplicates",
      duplicateGroupCount: 2,
      transferCandidateCount: 0
    });

    expect(html).toContain('id="filter-title"');
    expect(html).toContain('data-filter-key="flow"');
    expect(html).toContain('value="2026-03-01"');
    expect(html).toContain('value="weekly" selected');
    expect(html).toContain("1 of 2 records shown");
    expect(html).toContain("possible duplicates");
    expect(html).toContain("Duplicates (2)");
    expect(html).toContain("Transfers (0)");
    expect(html).toContain('data-review-preset="transfers"');
    expect(html).toContain("disabled");
  });
});

describe("renderExportPanel", () => {
  it("renders all supported export actions", () => {
    const html = renderExportPanel();

    expect(html).toContain('id="export-transactions"');
    expect(html).toContain('id="export-visible-transactions"');
    expect(html).toContain('id="export-reviewer"');
    expect(html).toContain('id="export-trend"');
    expect(html).toContain('id="export-trend-svg"');
    expect(html).toContain('id="export-trend-png"');
  });
});

describe("renderSummaryGrid", () => {
  it("renders headline metrics using the provided money formatter", () => {
    const html = renderSummaryGrid(summary(), money);

    expect(html).toContain("Records");
    expect(html).toContain("<strong>3</strong>");
    expect(html).toContain("$1200");
    expect(html).toContain("$300");
    expect(html).toContain("$900");
  });
});

describe("renderCashHealthPanel", () => {
  it("renders cash input and runway metrics", () => {
    const html = renderCashHealthPanel(summary(), 5000, money, (months) => `${months} months`);

    expect(html).toContain('id="cash-on-hand"');
    expect(html).toContain('value="5000"');
    expect(html).toContain("Avg Monthly Burn");
    expect(html).toContain("2 months");
    expect(html).toContain("75%");
  });
});

describe("renderSettingsPanel", () => {
  it("renders currency options and reset control", () => {
    const html = renderSettingsPanel('<option value="USD">USD</option>');

    expect(html).toContain('id="currency-select"');
    expect(html).toContain('<option value="USD">USD</option>');
    expect(html).toContain('id="reset-settings"');
  });
});

describe("renderCurrencyOptions", () => {
  it("renders supported currencies and marks the selected currency", () => {
    const html = renderCurrencyOptions("PKR");

    expect(html).toContain('value="PKR" selected');
    expect(html).toContain('value="USD"');
  });
});

describe("renderForecastPanel", () => {
  it("renders future events input and forecast output", () => {
    const html = renderForecastPanel(forecast(), "2026-04-15, -1200, quarterly tax", money);

    expect(html).toContain('id="forecast-title"');
    expect(html).toContain('id="future-events"');
    expect(html).toContain("quarterly tax");
    expect(html).toContain("$100 avg weekly net");
  });
});

describe("renderInsightGrid", () => {
  it("renders trend, head, account, subcategory, and warning sections", () => {
    const html = renderInsightGrid(summary(), "weekly", money);

    expect(html).toContain("Weekly Trend");
    expect(html).toContain("Top Heads");
    expect(html).toContain("Account Balances");
    expect(html).toContain("Subcategories");
    expect(html).toContain("Data Quality");
  });
});

describe("renderDiagnosticsPanel", () => {
  it("renders duplicate and transfer diagnostics", () => {
    const html = renderDiagnosticsPanel(summary(), money);

    expect(html).toContain("Duplicate & Transfer Checks");
    expect(html).toContain("0 duplicate, 0 transfer");
  });
});

describe("renderDetailGrid", () => {
  it("renders transaction preview, selected detail, and rejected row quality", () => {
    const selectedRecord = record("row-0", "revenue", "Checking", "Client");
    const html = renderDetailGrid(csvImportResult(selectedRecord), [selectedRecord], selectedRecord.id, selectedRecord, money);

    expect(html).toContain("Transaction Preview");
    expect(html).toContain("Transaction Detail");
    expect(html).toContain("Import Quality");
    expect(html).toContain("1 shown");
    expect(html).toContain("YMD dates");
  });
});

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

function summary(): FinanceSummary {
  return {
    revenue: 1200,
    outflow: 300,
    netCash: 900,
    transactionCount: 3,
    periodTrend: [{ period: "2026-W09", revenue: 1200, outflow: 300, netCash: 900 }],
    topHeads: [{ head: "Client", flow: "revenue", amount: 1200, count: 1 }],
    topSubcategories: [{ head: "Software", subcategory: "Tools", flow: "outflow", amount: 300, count: 1 }],
    accountBalances: [{ account: "Checking", balance: 900, source: "netActivity" }],
    diagnostics: {
      duplicateGroups: [],
      transferCandidates: []
    },
    warnings: [],
    cashHealth: {
      averageMonthlyOutflow: 300,
      runwayMonths: 2,
      largestTransaction: null,
      revenueConcentration: 0.75
    }
  };
}

function money(value: number): string {
  return `$${value}`;
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
    rejectedRows: [{ rowNumber: 2, reason: "Missing amount", row: { Date: "2026-03-02" } }],
    mapping: { date: "Date", amount: "Amount", head: "Head" },
    dateFormat: "ymd"
  };
}
