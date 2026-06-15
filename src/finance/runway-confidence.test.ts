import { describe, expect, it } from "vitest";
import { rec } from "./classification-overrides.test";
import type { ForecastResult } from "./forecast";
import type { ReadinessReport } from "./readiness";
import { assessRunwayConfidence } from "./runway-confidence";
import type { TransactionRecord } from "./types";

describe("assessRunwayConfidence", () => {
  it("returns high confidence for clean history, cash on hand, and low volatility", () => {
    const report = assessRunwayConfidence(
      input({
        records: stableHistory(),
        cashOnHand: 12000,
        readiness: readyReport()
      })
    );

    expect(report.level).toBe("high");
    expect(report.score).toBeGreaterThanOrEqual(70);
    expect(report.reasons.some((reason) => reason.id === "cash-on-hand")).toBe(true);
    expect(report.reasons.some((reason) => reason.id === "coverage-strong")).toBe(true);
  });

  it("returns medium confidence for partial coverage or moderate volatility", () => {
    const report = assessRunwayConfidence(
      input({
        records: moderateHistory(),
        cashOnHand: 8000,
        readiness: partialReport()
      })
    );

    expect(report.level).toBe("medium");
    expect(report.score).toBeGreaterThanOrEqual(40);
    expect(report.score).toBeLessThan(70);
  });

  it("returns low confidence when cash on hand is missing and history is thin", () => {
    const report = assessRunwayConfidence(
      input({
        records: [rec({ flow: "outflow", amount: 400, signedNet: -400 })],
        cashOnHand: 0,
        readiness: needsReviewReport(),
        rejectedRowCount: 2,
        categoryReviewPendingCount: 2
      })
    );

    expect(report.level).toBe("low");
    expect(report.score).toBeLessThan(40);
    expect(report.reasons.some((reason) => reason.id === "missing-cash")).toBe(true);
  });

  it("penalizes rejected rows, review debt, and manual-event dependence", () => {
    const clean = assessRunwayConfidence(
      input({
        records: stableHistory(),
        cashOnHand: 12000,
        readiness: readyReport()
      })
    );
    const stressed = assessRunwayConfidence(
      input({
        records: stableHistory(),
        cashOnHand: 12000,
        readiness: needsReviewReport(),
        rejectedRowCount: 3,
        categoryReviewPendingCount: 2,
        forecast: {
          averageWeeklyNet: 100,
          events: [
            { dateISO: "2026-06-01", amount: 1000, label: "Client" },
            { dateISO: "2026-07-01", amount: 2000, label: "Retainer" },
            { dateISO: "2026-08-01", amount: 3000, label: "Project" }
          ],
          rejectedEvents: ["Line 2: bad event"],
          weeks: []
        }
      })
    );

    expect(stressed.score).toBeLessThan(clean.score);
    expect(stressed.reasons.map((reason) => reason.id)).toEqual(
      expect.arrayContaining([
        "rejected-rows",
        "category-review",
        "manual-events-heavy",
        "manual-events-rejected"
      ])
    );
  });

  it("is deterministic for the same inputs", () => {
    const payload = input({
      records: moderateHistory(),
      cashOnHand: 5000,
      readiness: partialReport(),
      revenueConcentration: 0.62
    });

    expect(assessRunwayConfidence(payload)).toEqual(assessRunwayConfidence(payload));
  });
});

function input(
  overrides: Partial<{
    records: TransactionRecord[];
    cashOnHand: number;
    forecast: ForecastResult;
    readiness: ReadinessReport;
    rejectedRowCount: number;
    categoryReviewPendingCount: number;
    revenueConcentration: number;
  }> = {}
) {
  return {
    records: overrides.records ?? stableHistory(),
    cashOnHand: overrides.cashOnHand ?? 10000,
    forecast: overrides.forecast ?? emptyForecast(),
    readiness: overrides.readiness ?? readyReport(),
    rejectedRowCount: overrides.rejectedRowCount ?? 0,
    categoryReviewPendingCount: overrides.categoryReviewPendingCount ?? 0,
    revenueConcentration: overrides.revenueConcentration ?? 0.3
  };
}

function emptyForecast(): ForecastResult {
  return {
    averageWeeklyNet: 250,
    events: [],
    rejectedEvents: [],
    weeks: []
  };
}

function readyReport(): ReadinessReport {
  return {
    status: "ready",
    headline: "Dashboard is ready to trust.",
    signals: []
  };
}

function partialReport(): ReadinessReport {
  return {
    status: "partial",
    headline: "Dashboard is usable with a few caveats.",
    signals: [
      {
        id: "category-review",
        severity: "caution",
        label: "Category review",
        detail: "1 row needs classification."
      }
    ]
  };
}

function needsReviewReport(): ReadinessReport {
  return {
    status: "needs-review",
    headline: "Resolve review items before trusting runway.",
    signals: [
      {
        id: "rejected-rows",
        severity: "blocker",
        label: "Rejected rows",
        detail: "2 rows failed import validation."
      }
    ]
  };
}

function stableHistory(): TransactionRecord[] {
  const months = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"];
  return months.flatMap((periodMonthly, index) => [
    rec({
      id: `rev-${periodMonthly}`,
      flow: "revenue",
      head: "Client",
      amount: 5000 + index * 100,
      signedNet: 5000 + index * 100,
      periodMonthly
    }),
    rec({
      id: `out-${periodMonthly}`,
      flow: "outflow",
      head: "Rent",
      amount: 2000 + index * 50,
      signedNet: -(2000 + index * 50),
      periodMonthly
    })
  ]);
}

function moderateHistory(): TransactionRecord[] {
  return [
    rec({ id: "m1-rev", flow: "revenue", amount: 8000, signedNet: 8000, periodMonthly: "2026-04" }),
    rec({ id: "m1-out", flow: "outflow", amount: 3000, signedNet: -3000, periodMonthly: "2026-04" }),
    rec({ id: "m2-rev", flow: "revenue", amount: 1200, signedNet: 1200, periodMonthly: "2026-05" }),
    rec({ id: "m2-out", flow: "outflow", amount: 4500, signedNet: -4500, periodMonthly: "2026-05" }),
    rec({ id: "m3-rev", flow: "revenue", amount: 6500, signedNet: 6500, periodMonthly: "2026-06" }),
    rec({ id: "m3-out", flow: "outflow", amount: 2200, signedNet: -2200, periodMonthly: "2026-06" })
  ];
}