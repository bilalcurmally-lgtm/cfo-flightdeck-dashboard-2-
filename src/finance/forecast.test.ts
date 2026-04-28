import { describe, expect, it } from "vitest";
import { build13WeekForecast, parseFutureCashEvents } from "./forecast";
import { startOfWeek, toIsoDate } from "./date";
import type { TransactionRecord } from "./types";

describe("build13WeekForecast", () => {
  it("projects 13 weeks from cash, historical weekly net, and manual events", () => {
    const result = build13WeekForecast(
      [
        record("2026-03-02", "revenue", 1000),
        record("2026-03-03", "outflow", 250),
        record("2026-03-09", "outflow", 250)
      ],
      2000,
      [{ dateISO: "2026-04-01", amount: -500, label: "Tax payment" }],
      new Date("2026-03-30T00:00:00")
    );

    expect(result.averageWeeklyNet).toBe(250);
    expect(result.weeks).toHaveLength(13);
    expect(result.weeks[0]).toEqual({
      weekStartISO: "2026-03-30",
      baselineNet: 250,
      eventNet: -500,
      projectedCash: 1750
    });
    expect(result.weeks[1].projectedCash).toBe(2000);
  });

  it("returns a flat forecast when there is no history or cash", () => {
    const result = build13WeekForecast([], 0, [], new Date("2026-03-30T00:00:00"));

    expect(result.averageWeeklyNet).toBe(0);
    expect(result.weeks[0].projectedCash).toBe(0);
  });
});

describe("parseFutureCashEvents", () => {
  it("parses date, amount, and label lines", () => {
    expect(parseFutureCashEvents("2026-04-01, -500, Tax payment")).toEqual({
      events: [{ dateISO: "2026-04-01", amount: -500, label: "Tax payment" }],
      rejectedEvents: []
    });
  });

  it("reports invalid event lines", () => {
    expect(parseFutureCashEvents("soon, nope, Mystery")).toEqual({
      events: [],
      rejectedEvents: ["Line 1: soon, nope, Mystery"]
    });
  });
});

function record(dateISO: string, flow: TransactionRecord["flow"], amount: number): TransactionRecord {
  const date = new Date(`${dateISO}T00:00:00`);

  return {
    id: `${dateISO}-${flow}-${amount}`,
    date,
    dateISO,
    periodDaily: dateISO,
    periodWeekly: toIsoDate(startOfWeek(date)),
    periodMonthly: dateISO.slice(0, 7),
    head: flow === "revenue" ? "Sales" : "Costs",
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
