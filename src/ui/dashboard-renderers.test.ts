import { placeholderCashHealthLineage, placeholderSummaryLineage } from "../finance/audit-fixtures";
import { describe, expect, it } from "vitest";
import type { CsvImportResult, TransactionRecord } from "../finance/types";
import {
  renderAccountBalances,
  renderDiagnostics,
  renderAppbarLoadAction,
  renderPreImportPanel,
  renderSubcategories,
  renderTopHeads,
  renderTransactionDetail
} from "./dashboard-renderers";

describe("renderPreImportPanel", () => {
  it("renders the three first-run load paths and sample path shortcuts", () => {
    const html = renderPreImportPanel([
      { label: "Freelancer", path: "/sample-freelancer.csv" },
      { label: "Agency", path: "/sample-agency.csv" }
    ]);

    expect(html).toContain('data-bw-action="import-file"');
    expect(html).toContain('data-bw-action="load-excel-demo"');
    expect(html).toContain('data-bw-action="load-sample-csv"');
    expect(html).toContain('data-bw-sample-path="/sample-freelancer.csv"');
    expect(html).toContain('data-bw-sample-path="/sample-agency.csv"');
  });

  it("escapes dynamic sample labels and paths", () => {
    const html = renderPreImportPanel([{ label: "<Bad>", path: "/sample?a=<x>" }]);

    expect(html).toContain("&lt;Bad&gt;");
    expect(html).toContain("/sample?a=&lt;x&gt;");
    expect(html).not.toContain("<Bad>");
  });
});

describe("renderAppbarLoadAction", () => {
  it("renders a compact import action for the persistent shell", () => {
    const html = renderAppbarLoadAction();

    expect(html).toContain('data-bw-action="import-file"');
    expect(html).toContain("Load new file");
  });
});

describe("renderTransactionDetail", () => {
  it("shows normalized fields and the matching raw source row", () => {
    const html = renderTransactionDetail(record("2026-03-01T00:00:00.000Z-1"), result(), money);

    expect(html).toContain("<dt>Date</dt>");
    expect(html).toContain("<dd>2026-03-02</dd>");
    expect(html).toContain("<dt>Amount</dt>");
    expect(html).toContain("<dd>$49</dd>");
    expect(html).toContain("<h3>Raw Row</h3>");
    expect(html).toContain("<dt>Bank Memo</dt>");
    expect(html).toContain("<dd>Second raw row</dd>");
  });

  it("escapes raw row values before rendering", () => {
    const html = renderTransactionDetail(record("2026-03-01T00:00:00.000Z-0"), result(), money);

    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });

  it("prompts the user to select a row when no record is active", () => {
    expect(renderTransactionDetail(null, result(), money)).toContain("Select a transaction row");
  });
});

describe("summary drilldowns", () => {
  it("renders head, account, and subcategory totals as filter drilldown buttons", () => {
    expect(renderTopHeads([{ head: "Software", flow: "outflow", amount: 49, count: 1 }], money)).toContain(
      'data-drilldown-head="Software"'
    );
    expect(renderAccountBalances([{ account: "Checking", balance: 100, source: "netActivity" }], money)).toContain(
      'data-drilldown-account="Checking"'
    );
    expect(
      renderSubcategories(
        [{ head: "Software", subcategory: "Hosting", flow: "outflow", amount: 49, count: 1 }],
        money
      )
    ).toContain('data-drilldown-subcategory="Hosting"');
  });
});

describe("renderDiagnostics", () => {
  it("renders duplicate and transfer diagnostics as transaction review actions", () => {
    const html = renderDiagnostics(
      {
        revenue: 100,
        outflow: 100,
        netCash: 0,
        transactionCount: 2,
        periodTrend: [],
        topHeads: [],
        topSubcategories: [],
        accountBalances: [],
        warnings: [],
        lineage: placeholderSummaryLineage(),
        cashHealth: {
          lineage: placeholderCashHealthLineage(),
          averageMonthlyOutflow: 0,
          runwayMonths: null,
          largestTransaction: null,
          revenueConcentration: 0
        },
        diagnostics: {
          duplicateGroups: [{ key: "dup", records: [record("dup-1"), record("dup-2")] }],
          transferCandidates: [
            {
              dateISO: "2026-03-02",
              amount: 100,
              fromAccount: "Checking",
              toAccount: "Savings",
              outflowId: "out-1",
              revenueId: "in-1"
            }
          ]
        }
      },
      money
    );

    expect(html).toContain('data-transaction-id="dup-1"');
    expect(html).toContain('data-transaction-id="out-1"');
    expect(html).toContain('data-transaction-id="in-1"');
  });
});

function money(value: number): string {
  return `$${value}`;
}

function result(): CsvImportResult {
  return {
    rawRows: [
      { "Bank Memo": "<script>" },
      { "Bank Memo": "Second raw row" }
    ],
    records: [],
    rejectedRows: [],
    mapping: { date: "Date", amount: "Amount" },
    dateFormat: "ymd"
  };
}

function record(id: string): TransactionRecord {
  return {
    id,
    date: new Date("2026-03-02T00:00:00"),
    dateISO: "2026-03-02",
    periodDaily: "2026-03-02",
    periodWeekly: "2026-03-02",
    periodMonthly: "2026-03",
    head: "Software",
    parent: "Operating Costs",
    subcategory: "Design",
    description: "Design tools",
    counterparty: "Figma",
    account: "Credit Card",
    flow: "outflow",
    amount: 49,
    signedNet: -49,
    runningBalance: -49
  };
}
