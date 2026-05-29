import { describe, expect, it } from "vitest";
import { deriveAuditedCockpit } from "../finance/audit-derive";
import { summarizeTransactions } from "../finance/summary";
import type { TransactionRecord } from "../finance/types";
import { renderLineageDrawer, type LineageFormatters } from "./lineage-drawer";

const formatters: LineageFormatters = {
  formatMoney: (value) => `$${value.toLocaleString("en-US")}`,
  formatRunway: (months) => (months === null ? "n/a" : `${months.toFixed(1)} mo`)
};

function audited(records: TransactionRecord[], cashOnHand: number) {
  const summary = summarizeTransactions(records, [], cashOnHand);
  return deriveAuditedCockpit({ summary, records, rejectedRows: [] });
}

describe("renderLineageDrawer", () => {
  it("renders the revenue archetype as a contributing-rows table", () => {
    const records = [
      record("r1", "2026-03-01", "revenue", "Client A", 2000),
      record("r2", "2026-03-15", "revenue", "Client B", 500),
      record("o1", "2026-03-03", "outflow", "Software", 300)
    ];
    const html = renderLineageDrawer(audited(records, 5000).lineage.revenue, formatters);

    expect(html).toContain("Contributing rows (2)");
    expect(html).toContain("Client A");
    expect(html).toContain("Client B");
    expect(html).toContain("$2,000");
    // revenue is a direct archetype: no calc tree
    expect(html).not.toContain("How it is calculated");
    // outflow rows must not leak into revenue evidence
    expect(html).not.toContain("Software");
  });

  it("renders the runway archetype as a calc tree with the cash-on-hand assumption", () => {
    const records = [
      record("r1", "2026-03-01", "revenue", "Client A", 4000),
      record("o1", "2026-03-03", "outflow", "Rent", 1000),
      record("o2", "2026-04-03", "outflow", "Rent", 1000)
    ];
    const html = renderLineageDrawer(audited(records, 6000).lineage.runwayMonths, formatters);

    expect(html).toContain("How it is calculated");
    // headline runway uses the months formatter, not money
    expect(html).toContain("6.0 mo");
    // assumption is the user-entered cash on hand, money-formatted
    expect(html).toContain("Assumptions");
    expect(html).toContain("Cash on hand");
    expect(html).toContain("$6,000");
    expect(html).toContain("user-entered");
    // tree descendants (money) are present
    expect(html).toContain("Average monthly outflow");
  });

  it("shows the net-cash subtraction tree with both children", () => {
    const records = [
      record("r1", "2026-03-01", "revenue", "Client A", 2000),
      record("o1", "2026-03-03", "outflow", "Rent", 1200)
    ];
    const html = renderLineageDrawer(audited(records, 5000).lineage.netCash, formatters);

    expect(html).toContain("How it is calculated");
    expect(html).toContain("Revenue");
    expect(html).toContain("Outflow");
    // subtract op marker
    expect(html).toContain("−");
  });

  it("renders explicit empty states for an empty import", () => {
    const result = audited([], 0);
    const revenueHtml = renderLineageDrawer(result.lineage.revenue, formatters);
    const runwayHtml = renderLineageDrawer(result.lineage.runwayMonths, formatters);

    expect(revenueHtml).toContain("No contributing rows in the current import.");
    // null runway falls back to the months formatter's null branch
    expect(runwayHtml).toContain("n/a");
  });

  it("escapes untrusted row content", () => {
    const records = [record("r1", "2026-03-01", "revenue", "<script>alert(1)</script>", 100)];
    const html = renderLineageDrawer(audited(records, 1000).lineage.revenue, formatters);

    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

function record(
  id: string,
  dateISO: string,
  flow: TransactionRecord["flow"],
  head: string,
  amount: number
): TransactionRecord {
  return {
    id,
    date: new Date(`${dateISO}T00:00:00`),
    dateISO,
    periodDaily: dateISO,
    periodWeekly: dateISO,
    periodMonthly: dateISO.slice(0, 7),
    head,
    parent: "Group",
    subcategory: "Subcategory",
    description: "Memo",
    counterparty: "Counterparty",
    account: "Operating",
    flow,
    amount,
    signedNet: flow === "revenue" ? amount : -amount,
    runningBalance: null
  };
}
