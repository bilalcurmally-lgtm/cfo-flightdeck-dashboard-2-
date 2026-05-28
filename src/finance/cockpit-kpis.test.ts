import { describe, expect, it } from "vitest";
import type { FinanceSummary } from "./summary";
import type { TransactionRecord } from "./types";
import { deriveCockpit } from "./cockpit-kpis";

describe("deriveCockpit", () => {
  it("passes through summary totals instead of recomputing them", () => {
    const cockpit = deriveCockpit({
      summary: summary({ revenue: 1200, outflow: 450, netCash: 750 }),
      records: [record("r1", "revenue"), record("o1", "outflow")],
      rejectedRows: []
    });

    expect(cockpit.revenue).toBe(1200);
    expect(cockpit.outflow).toBe(450);
    expect(cockpit.netCash).toBe(750);
  });

  it("counts rows by flow because record amounts are positive magnitudes", () => {
    const cockpit = deriveCockpit({
      summary: summary(),
      records: [
        record("r1", "revenue", 100),
        record("r2", "revenue", 200),
        record("o1", "outflow", 300)
      ],
      rejectedRows: []
    });

    expect(cockpit.inflowCount).toBe(2);
    expect(cockpit.outflowCount).toBe(1);
  });

  it("uses cash health runway and burn from the existing summary", () => {
    const cockpit = deriveCockpit({
      summary: summary({
        runwayMonths: 5,
        averageMonthlyOutflow: 900
      }),
      records: [record("r1", "revenue")],
      rejectedRows: []
    });

    expect(cockpit.runwayMonths).toBe(5);
    expect(cockpit.averageMonthlyOutflow).toBe(900);
    expect(cockpit.runwayTone).toBe("watch");
  });

  it("classifies runway tone at the cockpit thresholds", () => {
    expect(
      deriveCockpit({ summary: summary({ runwayMonths: 9 }), records: [], rejectedRows: [] }).runwayTone
    ).toBe("healthy");
    expect(
      deriveCockpit({ summary: summary({ runwayMonths: 3 }), records: [], rejectedRows: [] }).runwayTone
    ).toBe("watch");
    expect(
      deriveCockpit({ summary: summary({ runwayMonths: 2.9 }), records: [], rejectedRows: [] }).runwayTone
    ).toBe("tight");
    expect(
      deriveCockpit({ summary: summary({ runwayMonths: null }), records: [], rejectedRows: [] }).runwayTone
    ).toBe("unknown");
  });

  it("combines rejected rows and diagnostics into the review count", () => {
    const cockpit = deriveCockpit({
      summary: summary({
        duplicateGroups: 2,
        transferCandidates: 1
      }),
      records: [],
      rejectedRows: [{}, {}]
    });

    expect(cockpit.review).toEqual({
      rejected: 2,
      duplicates: 2,
      transfers: 1,
      total: 5
    });
  });
});

function summary(
  overrides: Partial<{
    revenue: number;
    outflow: number;
    netCash: number;
    runwayMonths: number | null;
    averageMonthlyOutflow: number;
    duplicateGroups: number;
    transferCandidates: number;
    transactionCount: number;
  }> = {}
): FinanceSummary {
  return {
    revenue: overrides.revenue ?? 1000,
    outflow: overrides.outflow ?? 400,
    netCash: overrides.netCash ?? 600,
    transactionCount: overrides.transactionCount ?? 1,
    periodTrend: [],
    topHeads: [],
    topSubcategories: [],
    accountBalances: [],
    diagnostics: {
      duplicateGroups: Array.from({ length: overrides.duplicateGroups ?? 0 }, (_, index) => ({
        key: `duplicate-${index}`,
        records: []
      })),
      transferCandidates: Array.from({ length: overrides.transferCandidates ?? 0 }, (_, index) => ({
        dateISO: "2026-03-01",
        amount: index + 1,
        fromAccount: "Checking",
        toAccount: "Savings",
        outflowId: `out-${index}`,
        revenueId: `in-${index}`
      }))
    },
    warnings: [],
    cashHealth: {
      averageMonthlyOutflow: overrides.averageMonthlyOutflow ?? 400,
      runwayMonths: Object.hasOwn(overrides, "runwayMonths") ? overrides.runwayMonths! : 6,
      largestTransaction: null,
      revenueConcentration: 0
    }
  };
}

function record(id: string, flow: TransactionRecord["flow"], amount = 100): TransactionRecord {
  return {
    id,
    date: new Date("2026-03-01T00:00:00"),
    dateISO: "2026-03-01",
    periodDaily: "2026-03-01",
    periodWeekly: "2026-02-23",
    periodMonthly: "2026-03",
    head: "Head",
    parent: "Group",
    subcategory: "Subcategory",
    description: "Description",
    counterparty: "Counterparty",
    account: "Checking",
    flow,
    amount,
    signedNet: flow === "revenue" ? amount : -amount,
    runningBalance: null
  };
}
