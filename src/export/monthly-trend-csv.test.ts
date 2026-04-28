import { describe, expect, it } from "vitest";
import { buildMonthlyTrendCsv, monthlyTrendCsvFilename } from "./monthly-trend-csv";

describe("buildMonthlyTrendCsv", () => {
  it("exports period trend rows", () => {
    expect(
      buildMonthlyTrendCsv([
        { period: "2026-03", revenue: 1000, outflow: 300, netCash: 700 },
        { period: "2026-04", revenue: 800, outflow: 900, netCash: -100 }
      ])
    ).toBe(["period,revenue,outflow,netCash", "2026-03,1000,300,700", "2026-04,800,900,-100"].join("\n"));
  });
});

describe("monthlyTrendCsvFilename", () => {
  it("creates a safe visible trend filename", () => {
    expect(monthlyTrendCsvFilename("Founder Sample.xlsx", new Date("2026-04-27T00:00:00Z"))).toBe(
      "founder-sample-visible-monthly-trend-2026-04-27.csv"
    );
    expect(monthlyTrendCsvFilename("Founder Sample.xlsx", new Date("2026-04-27T00:00:00Z"), "weekly")).toBe(
      "founder-sample-visible-weekly-trend-2026-04-27.csv"
    );
  });
});
