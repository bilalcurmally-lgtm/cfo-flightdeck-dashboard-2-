import { describe, expect, it } from "vitest";
import { buildVisibleTrendSvg } from "./visible-trend-svg";

describe("buildVisibleTrendSvg", () => {
  it("builds the visible trend export with dashboard title and review context", () => {
    const svg = buildVisibleTrendSvg({
      periods: [{ period: "2026-04", revenue: 1200, outflow: 400, netCash: 800 }],
      trendGrain: "weekly",
      sourceName: "Founder <Sample>.xlsx",
      reviewPreset: "duplicates",
      currency: "PKR"
    });

    expect(svg).toContain("<svg");
    expect(svg).toContain("Weekly Trend");
    expect(svg).toContain("Founder &lt;Sample&gt;.xlsx");
    expect(svg).toContain("possible duplicates");
    expect(svg).toContain("2026-04");
  });
});
