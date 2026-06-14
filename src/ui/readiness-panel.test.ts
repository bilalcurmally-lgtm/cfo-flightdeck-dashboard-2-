import { describe, expect, it } from "vitest";
import { assessReadiness, type ReadinessInput } from "../finance/readiness";
import { renderReadinessWidget, renderReadinessDrawer } from "./readiness-panel";

function input(overrides: Partial<ReadinessInput> = {}): ReadinessInput {
  return {
    transactionCount: 10,
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

describe("renderReadinessWidget", () => {
  it("renders nothing for an empty dashboard", () => {
    expect(renderReadinessWidget(assessReadiness(input({ transactionCount: 0 })))).toBe("");
  });

  it("renders a ready widget with a trigger to open the drawer", () => {
    const html = renderReadinessWidget(assessReadiness(input()));
    expect(html).toContain("data-bw-readiness-trigger");
    expect(html).toContain("bw-readiness--ready");
    expect(html).toContain("Ready");
  });

  it("carries the needs-review status into the widget class", () => {
    const html = renderReadinessWidget(assessReadiness(input({ rejectedRows: 2 })));
    expect(html).toContain("bw-readiness--needs-review");
    expect(html).toContain("Needs review");
  });

  it("escapes the headline", () => {
    // headline is app-generated, but the renderer must escape defensively
    const report = { status: "ready" as const, headline: "<b>x</b>", signals: [] };
    expect(renderReadinessWidget(report)).not.toContain("<b>x</b>");
  });
});

describe("renderReadinessDrawer", () => {
  it("lists each signal with its detail and severity", () => {
    const html = renderReadinessDrawer(
      assessReadiness(input({ rejectedRows: 1, duplicateGroups: 2 }))
    );
    expect(html).toContain("Rejected rows");
    expect(html).toContain("bw-readiness__signal--blocker");
    expect(html).toContain("Duplicates");
    expect(html).toContain("bw-readiness__signal--caution");
    expect(html).toContain("2 possible duplicate groups.");
  });

  it("shows an all-clear message when nothing needs attention", () => {
    const html = renderReadinessDrawer(assessReadiness(input()));
    expect(html).toContain("Every readiness check passed.");
  });

  it("escapes untrusted signal detail", () => {
    const report = {
      status: "needs-review" as const,
      headline: "x",
      signals: [
        { id: "x", severity: "blocker" as const, label: "<i>L</i>", detail: "<i>D</i>" }
      ]
    };
    const html = renderReadinessDrawer(report);
    expect(html).not.toContain("<i>L</i>");
    expect(html).not.toContain("<i>D</i>");
  });
});
