import { describe, expect, it } from "vitest";
import { calculateCashHealth } from "./cash-health";
import type { TransactionRecord } from "./types";

describe("calculateCashHealth", () => {
  it("calculates average monthly outflow and runway from cash on hand", () => {
    const records = [
      record("2026-03-01", "outflow", "Software", 300),
      record("2026-03-05", "outflow", "Rent", 700),
      record("2026-04-01", "outflow", "Software", 500),
      record("2026-04-05", "revenue", "Client A", 2000)
    ];

    expect(calculateCashHealth(records, 3000)).toMatchObject({
      averageMonthlyOutflow: 750,
      runwayMonths: 4,
      revenueConcentration: 1
    });
  });

  it("emits runway lineage with cash assumption and monthly outflow buckets", () => {
    const records = [
      record("2026-03-01", "outflow", "Software", 300),
      record("2026-03-05", "outflow", "Rent", 700),
      record("2026-04-01", "outflow", "Software", 500),
      record("2026-04-05", "revenue", "Client A", 2000)
    ];

    const health = calculateCashHealth(records, 3000);

    expect(health.lineage!.averageMonthlyOutflow).toMatchObject({
      metric: "averageMonthlyOutflow",
      value: 750,
      formulaText: "Average monthly outflow = monthly outflow total / month count"
    });
    expect(health.lineage!.runwayMonths).toMatchObject({
      metric: "runwayMonths",
      value: 4,
      formulaText: "Runway = cash on hand / average monthly outflow",
      assumptions: [
        {
          label: "Cash on hand",
          value: 3000,
          source: "user-entered"
        }
      ]
    });
    expect(health.lineage!.runwayMonths.derived?.children?.map((child) => child.label)).toEqual([
      "Cash on hand",
      "Average monthly outflow"
    ]);
    expect(health.lineage!.runwayMonths.derived?.children?.[1].children?.map((child) => child.label)).toEqual([
      "2026-03 outflow",
      "2026-04 outflow"
    ]);
  });

  it("returns null runway when there is no cash or burn", () => {
    const health = calculateCashHealth([record("2026-03-01", "revenue", "Client A", 1000)], 0);

    expect(health).toMatchObject({
      averageMonthlyOutflow: 0,
      runwayMonths: null
    });
    expect(health.lineage!.runwayMonths).toMatchObject({
      metric: "runwayMonths",
      value: null
    });
    expect(health.lineage!.runwayMonths.derived).toBeDefined();
  });

  it("calculates revenue concentration by head", () => {
    const records = [
      record("2026-03-01", "revenue", "Client A", 800),
      record("2026-03-02", "revenue", "Client B", 200),
      record("2026-03-03", "outflow", "Software", 100)
    ];

    expect(calculateCashHealth(records, 1000).revenueConcentration).toBe(0.8);
  });
});

function record(
  dateISO: string,
  flow: TransactionRecord["flow"],
  head: string,
  amount: number
): TransactionRecord {
  return {
    id: `${dateISO}-${head}`,
    date: new Date(`${dateISO}T00:00:00`),
    dateISO,
    periodDaily: dateISO,
    periodWeekly: dateISO,
    periodMonthly: dateISO.slice(0, 7),
    head,
    parent: "Group",
    subcategory: "Unassigned Subcategory",
    description: "Memo",
    counterparty: "Unassigned Counterparty",
    account: "Operating",
    flow,
    amount,
    signedNet: flow === "revenue" ? amount : -amount,
    runningBalance: null
  };
}
