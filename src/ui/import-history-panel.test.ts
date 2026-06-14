import { describe, expect, it } from "vitest";
import type { ImportSnapshot } from "../workspace/import-history";
import { renderImportHistoryPanel } from "./import-history-panel";

const formatRunway = (value: number | null) =>
  value === null ? "n/a" : `${value.toFixed(1)} mo`;

function snapshot(overrides: Partial<ImportSnapshot> & { sourceName: string }): ImportSnapshot {
  const { sourceName, ...rest } = overrides;
  return {
    importedAt: "2026-04-30T00:00:00.000Z",
    sourceName,
    signatureSet: ["a"],
    kpiSnapshot: { runwayMonths: 7, transactionCount: 10 },
    reviewItemSignatures: [],
    ...rest
  };
}

describe("renderImportHistoryPanel", () => {
  it("shows an empty state with no imports", () => {
    expect(renderImportHistoryPanel([], { formatRunway })).toContain("No imports yet");
  });

  it("lists imports newest-first with source, runway, and transaction count", () => {
    const html = renderImportHistoryPanel(
      [
        snapshot({ sourceName: "jan.csv" }),
        snapshot({
          sourceName: "feb.csv",
          kpiSnapshot: { runwayMonths: 6, transactionCount: 14 }
        })
      ],
      { formatRunway }
    );

    const feb = html.indexOf("feb.csv");
    const jan = html.indexOf("jan.csv");
    expect(feb).toBeGreaterThan(-1);
    expect(jan).toBeGreaterThan(feb);
    expect(html).toContain("7.0 mo");
    expect(html).toContain("6.0 mo");
    expect(html).toContain("14 txns");
  });
});
