import { describe, expect, it } from "vitest";
import type { ImportIssue, TransactionRecord } from "./types";
import { summarizeTransactions } from "./summary";

describe("summarizeTransactions", () => {
  it("summarizes totals, monthly trend, and top heads", () => {
    const records = [
      record("2026-03-01", "revenue", "Client Retainer", 4200),
      record("2026-03-05", "outflow", "Software", 220),
      record("2026-03-10", "outflow", "Software", 80),
      record("2026-04-01", "revenue", "Consulting", 900)
    ];

    const summary = summarizeTransactions(records, [], 600);

    expect(summary).toMatchObject({
      revenue: 5100,
      outflow: 300,
      netCash: 4800,
      transactionCount: 4,
      periodTrend: [
        { period: "2026-03", revenue: 4200, outflow: 300, netCash: 3900 },
        { period: "2026-04", revenue: 900, outflow: 0, netCash: 900 }
      ],
      topHeads: [
        { head: "Client Retainer", flow: "revenue", amount: 4200, count: 1 },
        { head: "Consulting", flow: "revenue", amount: 900, count: 1 },
        { head: "Software", flow: "outflow", amount: 300, count: 2 }
      ],
      accountBalances: [{ account: "Operating", balance: 4800, source: "netActivity" }],
      topSubcategories: [],
      diagnostics: {
        duplicateGroups: [],
        transferCandidates: []
      },
      cashHealth: {
        averageMonthlyOutflow: 300,
        runwayMonths: 2
      }
    });
  });

  it("surfaces import quality warnings", () => {
    const rejectedRows: ImportIssue[] = [
      { rowNumber: 3, reason: "Invalid amount", row: { Amount: "nope" } }
    ];
    const summary = summarizeTransactions(
      [record("2026-03-01", "revenue", "Unassigned Head", 100, "Unassigned")],
      rejectedRows
    );

    expect(summary.warnings).toEqual([
      { level: "warning", message: "1 row rejected during import." },
      { level: "info", message: "1 row missing a category/head." },
      { level: "info", message: "1 row missing a description." },
      { level: "info", message: "1 row missing a vendor/customer." },
      { level: "warning", message: "100% of revenue comes from one head." },
      { level: "info", message: "Largest transaction is Unassigned Head at 100." }
    ]);
  });

  it("can summarize trends by day or week", () => {
    const records = [
      record("2026-03-02", "revenue", "Client Retainer", 100),
      record("2026-03-03", "outflow", "Software", 25),
      record("2026-03-10", "outflow", "Software", 50)
    ];

    expect(summarizeTransactions(records, [], 0, "daily").periodTrend).toEqual([
      { period: "2026-03-02", revenue: 100, outflow: 0, netCash: 100 },
      { period: "2026-03-03", revenue: 0, outflow: 25, netCash: -25 },
      { period: "2026-03-10", revenue: 0, outflow: 50, netCash: -50 }
    ]);
    expect(summarizeTransactions(records, [], 0, "weekly").periodTrend).toEqual([
      { period: "2026-03-02", revenue: 100, outflow: 25, netCash: 75 },
      { period: "2026-03-09", revenue: 0, outflow: 50, netCash: -50 }
    ]);
  });

  it("warns when no records are imported", () => {
    expect(summarizeTransactions([]).warnings).toEqual([
      { level: "warning", message: "No valid transaction rows were imported." }
    ]);
  });

  it("surfaces zero amount rows for review", () => {
    const summary = summarizeTransactions([
      record("2026-03-01", "revenue", "Adjustment", 0, "Zero row", "Operating")
    ]);

    expect(summary.warnings).toEqual(
      expect.arrayContaining([
        { level: "info", message: "1 row imported with a zero amount." }
      ])
    );
  });

  it("uses latest imported running balance when available", () => {
    const summary = summarizeTransactions([
      record("2026-03-01", "revenue", "Sales", 1000, "Memo", "Checking", 1200),
      record("2026-03-03", "outflow", "Software", 100, "Memo", "Checking", 1100),
      record("2026-03-02", "outflow", "Meals", 50, "Memo", "Savings")
    ]);

    expect(summary.accountBalances).toEqual([
      { account: "Checking", balance: 1100, source: "runningBalance" },
      { account: "Savings", balance: -50, source: "netActivity" }
    ]);
  });

  it("summarizes assigned subcategories", () => {
    const summary = summarizeTransactions([
      record("2026-03-01", "outflow", "Software", 100, "Memo", "Checking", null, "Design"),
      record("2026-03-02", "outflow", "Software", 200, "Memo", "Checking", null, "Design"),
      record("2026-03-03", "outflow", "Meals", 50, "Memo", "Checking", null, "Client")
    ]);

    expect(summary.topSubcategories).toEqual([
      { head: "Software", subcategory: "Design", flow: "outflow", amount: 300, count: 2 },
      { head: "Meals", subcategory: "Client", flow: "outflow", amount: 50, count: 1 }
    ]);
  });

  it("includes duplicate and transfer diagnostics in quality warnings", () => {
    const summary = summarizeTransactions([
      record("2026-03-01", "outflow", "Software", 100, "Tools", "Checking"),
      record("2026-03-01", "outflow", "Software", 100, "Tools", "Checking"),
      record("2026-03-02", "outflow", "Transfer", 500, "Move to savings", "Checking"),
      record("2026-03-02", "revenue", "Transfer", 500, "Move from checking", "Savings")
    ]);

    expect(summary.diagnostics.duplicateGroups).toHaveLength(1);
    expect(summary.diagnostics.transferCandidates).toHaveLength(1);
    expect(summary.warnings).toEqual(
      expect.arrayContaining([
        { level: "warning", message: "1 possible duplicate group found." },
        { level: "info", message: "1 possible transfer found." }
      ])
    );
  });
});

function record(
  dateISO: string,
  flow: TransactionRecord["flow"],
  head: string,
  amount: number,
  description = "Memo",
  account = "Operating",
  runningBalance: number | null = null,
  subcategory = "Unassigned Subcategory",
  counterparty = "Unassigned Counterparty"
): TransactionRecord {
  const signedNet = flow === "revenue" ? amount : -amount;

  return {
    id: `${dateISO}-${head}`,
    date: new Date(`${dateISO}T00:00:00`),
    dateISO,
    periodDaily: dateISO,
    periodWeekly: weeklyPeriod(dateISO),
    periodMonthly: dateISO.slice(0, 7),
    head,
    parent: "Group",
    subcategory,
    description,
    counterparty,
    account,
    flow,
    amount,
    signedNet,
    runningBalance
  };
}

function weeklyPeriod(dateISO: string): string {
  const date = new Date(`${dateISO}T00:00:00`);
  const day = date.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}
