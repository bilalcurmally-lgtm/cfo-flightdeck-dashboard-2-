// src/ui/welcome-back-strip.test.ts
import { describe, it, expect } from "vitest";
import { renderWelcomeBackStrip } from "./welcome-back-strip";
import type { ImportComparison } from "../workspace/import-history";

const fmtMoney = (n: number) => `$${n.toFixed(0)}`;
const fmtRunway = (n: number | null) => (n === null ? "n/a" : `${n.toFixed(1)} months`);

function comparison(over: Partial<ImportComparison> = {}): ImportComparison {
  return {
    baseline: {
      importedAt: "2026-04-30T00:00:00.000Z",
      sourceName: "prev.csv",
      signatureSet: [],
      kpiSnapshot: { runwayMonths: 7.2 },
      reviewItemSignatures: [],
    },
    addedTransactions: 4,
    removedTransactions: 0,
    kpiDeltas: [
      { key: "runwayMonths", previous: 7.2, current: 5.9, delta: -1.3, direction: "down" },
    ],
    review: { added: 1, resolved: 0 },
    ...over,
  };
}

describe("renderWelcomeBackStrip", () => {
  it("summarizes runway delta, added transactions, and new review items", () => {
    const html = renderWelcomeBackStrip(comparison(), { formatMoney: fmtMoney, formatRunway: fmtRunway });
    expect(html).toContain("Since your last import");
    expect(html).toContain("7.2 months");
    expect(html).toContain("5.9 months");
    expect(html).toContain("+4 transactions");
    expect(html).toContain("1 new"); // new review item
    expect(html).toContain("data-bw-welcome-strip");
    expect(html).toContain("data-bw-welcome-dismiss");
  });

  it("omits zero clauses (no added/removed/review)", () => {
    const html = renderWelcomeBackStrip(
      comparison({ addedTransactions: 0, removedTransactions: 0, review: { added: 0, resolved: 0 } }),
      { formatMoney: fmtMoney, formatRunway: fmtRunway },
    );
    expect(html).not.toContain("transactions");
    expect(html).not.toContain("new");
  });

  it("marks runway-down as attention (coral) and runway-up as positive (olive)", () => {
    const down = renderWelcomeBackStrip(comparison(), { formatMoney: fmtMoney, formatRunway: fmtRunway });
    expect(down).toContain("bw-welcome--attention");
    const up = renderWelcomeBackStrip(
      comparison({
        kpiDeltas: [{ key: "runwayMonths", previous: 5, current: 7, delta: 2, direction: "up" }],
        review: { added: 0, resolved: 0 },
      }),
      { formatMoney: fmtMoney, formatRunway: fmtRunway },
    );
    expect(up).toContain("bw-welcome--positive");
  });
});