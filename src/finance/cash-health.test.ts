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

  it("returns null runway when there is no cash or burn", () => {
    expect(calculateCashHealth([record("2026-03-01", "revenue", "Client A", 1000)], 0)).toMatchObject({
      averageMonthlyOutflow: 0,
      runwayMonths: null
    });
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
