import { describe, expect, it } from "vitest";
import { assessReadiness, type ReadinessInput } from "./readiness";

function input(overrides: Partial<ReadinessInput> = {}): ReadinessInput {
  return {
    transactionCount: 12,
    rejectedRows: 0,
    duplicateGroups: 0,
    transferCandidates: 0,
    categoryReviewItems: 0,
    unassignedHeads: 0,
    unassignedCounterparties: 0,
    hasCashOnHand: true,
    revenueConcentration: 0,
    nonOperatingRows: 0,
    hasImportHistory: true,
    ...overrides
  };
}

describe("assessReadiness", () => {
  it("reports empty when there are no transactions", () => {
    const report = assessReadiness(input({ transactionCount: 0 }));
    expect(report.status).toBe("empty");
    expect(report.signals).toEqual([]);
  });

  it("reports ready when no actionable signals are present", () => {
    const report = assessReadiness(input());
    expect(report.status).toBe("ready");
    expect(report.signals.filter((s) => s.severity !== "info")).toEqual([]);
  });

  it("treats rejected rows as a blocker that needs review", () => {
    const report = assessReadiness(input({ rejectedRows: 3 }));
    expect(report.status).toBe("needs-review");
    const signal = report.signals.find((s) => s.id === "rejectedRows");
    expect(signal?.severity).toBe("blocker");
    expect(signal?.detail).toContain("3");
  });

  it("treats unassigned heads as a blocker", () => {
    const report = assessReadiness(input({ unassignedHeads: 2 }));
    expect(report.status).toBe("needs-review");
    expect(report.signals.find((s) => s.id === "unassignedHeads")?.severity).toBe(
      "blocker"
    );
  });

  it("treats duplicates and transfers as cautions -> partial", () => {
    const report = assessReadiness(input({ duplicateGroups: 1, transferCandidates: 2 }));
    expect(report.status).toBe("partial");
    expect(report.signals.find((s) => s.id === "duplicateGroups")?.severity).toBe(
      "caution"
    );
    expect(report.signals.find((s) => s.id === "transferCandidates")?.severity).toBe(
      "caution"
    );
  });

  it("flags missing cash on hand as a caution that blocks runway", () => {
    const report = assessReadiness(input({ hasCashOnHand: false }));
    expect(report.status).toBe("partial");
    expect(report.signals.find((s) => s.id === "cashOnHand")?.severity).toBe("caution");
  });

  it("flags concentrated revenue as a caution", () => {
    const report = assessReadiness(input({ revenueConcentration: 0.82 }));
    expect(report.status).toBe("partial");
    const signal = report.signals.find((s) => s.id === "revenueConcentration");
    expect(signal?.severity).toBe("caution");
    expect(signal?.detail).toContain("82%");
  });

  it("lets a blocker dominate cautions", () => {
    const report = assessReadiness(input({ rejectedRows: 1, duplicateGroups: 5 }));
    expect(report.status).toBe("needs-review");
  });

  it("keeps non-operating rows informational and does not downgrade ready", () => {
    const report = assessReadiness(input({ nonOperatingRows: 4 }));
    expect(report.status).toBe("ready");
    expect(report.signals.find((s) => s.id === "nonOperating")?.severity).toBe("info");
  });

  it("summarizes the actionable count in the headline", () => {
    const report = assessReadiness(input({ rejectedRows: 1, duplicateGroups: 1 }));
    // two actionable signals (one blocker, one caution); info-only signals excluded
    expect(report.headline).toContain("2");
  });
});
