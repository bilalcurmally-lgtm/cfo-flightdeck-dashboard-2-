import { describe, expect, it } from "vitest";
import type { FinanceSummary } from "./summary";
import type { TransactionRecord } from "./types";
import { applyReviewPreset, isReviewPreset, reviewPresetLabel } from "./review-presets";

describe("applyReviewPreset", () => {
  it("keeps all records for the all preset", () => {
    const records = [
      record("revenue", "revenue"),
      record("outflow", "outflow")
    ];

    expect(applyReviewPreset(records, summary(), "all")).toBe(records);
  });

  it("filters revenue and outflow presets by flow", () => {
    const records = [
      record("revenue", "revenue"),
      record("outflow", "outflow")
    ];

    expect(applyReviewPreset(records, summary(), "revenue").map((item) => item.id)).toEqual(["revenue"]);
    expect(applyReviewPreset(records, summary(), "outflow").map((item) => item.id)).toEqual(["outflow"]);
  });

  it("filters duplicate and transfer presets from diagnostics", () => {
    const records = [
      record("duplicate-a", "outflow"),
      record("duplicate-b", "outflow"),
      record("transfer-out", "outflow"),
      record("transfer-in", "revenue"),
      record("other", "revenue")
    ];
    const baseSummary = summary({
      duplicateGroups: [{ key: "dupe", records: [records[0], records[1]] }],
      transferCandidates: [
        {
          dateISO: "2026-03-01",
          amount: 100,
          fromAccount: "Checking",
          toAccount: "Savings",
          outflowId: "transfer-out",
          revenueId: "transfer-in"
        }
      ]
    });

    expect(applyReviewPreset(records, baseSummary, "duplicates").map((item) => item.id)).toEqual([
      "duplicate-a",
      "duplicate-b"
    ]);
    expect(applyReviewPreset(records, baseSummary, "transfers").map((item) => item.id)).toEqual([
      "transfer-out",
      "transfer-in"
    ]);
  });
});

describe("isReviewPreset", () => {
  it("accepts known preset names only", () => {
    expect(isReviewPreset("duplicates")).toBe(true);
    expect(isReviewPreset("nope")).toBe(false);
    expect(isReviewPreset(undefined)).toBe(false);
  });
});

describe("reviewPresetLabel", () => {
  it("returns human-readable preset labels", () => {
    expect(reviewPresetLabel("transfers")).toBe("possible transfers");
  });
});

function summary(
  diagnostics: FinanceSummary["diagnostics"] = {
    duplicateGroups: [],
    transferCandidates: []
  }
): FinanceSummary {
  return {
    revenue: 0,
    outflow: 0,
    netCash: 0,
    transactionCount: 0,
    periodTrend: [],
    topHeads: [],
    topSubcategories: [],
    accountBalances: [],
    diagnostics,
    warnings: [],
    cashHealth: {
      averageMonthlyOutflow: 0,
      runwayMonths: null,
      revenueConcentration: 0,
      largestTransaction: null
    }
  };
}

function record(id: string, flow: TransactionRecord["flow"]): TransactionRecord {
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
    amount: 100,
    signedNet: flow === "revenue" ? 100 : -100,
    runningBalance: null
  };
}
