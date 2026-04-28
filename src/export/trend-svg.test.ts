import { describe, expect, it } from "vitest";
import { buildTrendSvg, trendSvgFilename } from "./trend-svg";

describe("buildTrendSvg", () => {
  it("exports visible trend data as an SVG image", () => {
    const svg = buildTrendSvg(
      [
        { period: "2026-03", revenue: 1000, outflow: 300, netCash: 700 },
        { period: "2026-04", revenue: 800, outflow: 900, netCash: -100 }
      ],
      { title: "Founder <Trend>", subtitle: "Monthly & filtered", currency: "USD" }
    );

    expect(svg).toContain("<svg");
    expect(svg).toContain("Founder &lt;Trend&gt;");
    expect(svg).toContain("Monthly &amp; filtered");
    expect(svg).toContain("2026-03");
    expect(svg).toContain("Revenue");
    expect(svg).toContain("Outflow");
  });

  it("renders an empty state when no periods are visible", () => {
    expect(buildTrendSvg([])).toContain("No trend data in this view");
  });
});

describe("trendSvgFilename", () => {
  it("creates a safe visible trend image filename", () => {
    expect(trendSvgFilename("Founder Sample.xlsx", new Date("2026-04-27T00:00:00Z"), "weekly")).toBe(
      "founder-sample-visible-weekly-trend-2026-04-27.svg"
    );
  });
});
