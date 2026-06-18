import { describe, expect, it } from "vitest";
import type { ForecastResult } from "../finance/forecast";
import { renderForecast } from "./forecast-renderers";

describe("renderForecast", () => {
  it("renders an accessible SVG forecast path with projected cash points", () => {
    const html = renderForecast(forecast(), money);

    expect(html).toContain("<svg");
    expect(html).toContain('role="img"');
    expect(html).toContain("13-week forecast path");
    expect(html).toContain("forecast-chart__line");
    expect(html).toContain("projected cash at week 13");
    expect(html).toContain("2026-04-13 projected cash $7,000");
  });

  it("marks weeks with manual event impact", () => {
    const html = renderForecast(forecast(), money);

    expect(html).toContain("forecast-chart__event");
    expect(html).toContain("2026-04-06 event net $1,000");
  });

  it("escapes rejected future event text", () => {
    const html = renderForecast(
      {
        ...forecast(),
        rejectedEvents: ["Line 1: <script>alert(1)</script>"]
      },
      money
    );

    expect(html).toContain("Line 1: &lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>");
  });
});

function forecast(): ForecastResult {
  return {
    averageWeeklyNet: 500,
    events: [{ dateISO: "2026-04-08", amount: 1000, label: "Client payment" }],
    rejectedEvents: [],
    weeks: [
      { weekStartISO: "2026-03-30", baselineNet: 500, eventNet: 0, projectedCash: 5000 },
      { weekStartISO: "2026-04-06", baselineNet: 500, eventNet: 1000, projectedCash: 6500 },
      { weekStartISO: "2026-04-13", baselineNet: 500, eventNet: 0, projectedCash: 7000 }
    ]
  };
}

function money(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}
