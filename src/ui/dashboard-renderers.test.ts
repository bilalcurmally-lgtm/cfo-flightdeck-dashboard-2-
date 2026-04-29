import { describe, expect, it } from "vitest";
import type { CsvImportResult, TransactionRecord } from "../finance/types";
import { renderTransactionDetail } from "./dashboard-renderers";

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
