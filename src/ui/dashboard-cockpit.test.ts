import { describe, expect, it } from "vitest";
import type { CockpitViewModel } from "../finance/cockpit-kpis";
import { renderCockpitStrip } from "./dashboard-cockpit";

describe("renderCockpitStrip", () => {
  it("renders the five cockpit tiles when review work exists", () => {
    const html = renderCockpitStrip(baseViewModel(), formatters);

    expect(html.match(/class="bw-kpi(?:\s|")/g)?.length).toBe(5);
    expect(html).toContain("Revenue");
    expect(html).toContain("Outflow");
    expect(html).toContain("Net cash");
    expect(html).toContain("Runway");
    expect(html).toContain("Needs review");
    expect(html).toContain("4 rejected · 2 dupes · 1 transfer");
  });

  it("omits the review tile and switches to the four-column class when count is zero", () => {
    const html = renderCockpitStrip(
      {
        ...baseViewModel(),
        review: { rejected: 0, duplicates: 0, transfers: 0, total: 0 }
      },
      formatters
    );

    expect(html.match(/class="bw-kpi(?:\s|")/g)?.length).toBe(4);
    expect(html).not.toContain("Needs review");
    expect(html).toContain("bw-cockpit bw-cockpit--4");
  });

  it("escapes dynamic formatter output and review meta", () => {
    const html = renderCockpitStrip(
      {
        ...baseViewModel(),
        review: { rejected: 1, duplicates: 0, transfers: 0, total: 1 }
      },
      {
        formatMoney: () => "<money>",
        formatRunway: () => "<months>"
      }
    );

    expect(html).toContain("&lt;money&gt;");
    expect(html).toContain("&lt;months&gt;");
    expect(html).not.toContain("<money>");
    expect(html).not.toContain("<months>");
  });

  it("shows a muted empty state without removing the cockpit", () => {
    const html = renderCockpitStrip(
      {
        ...baseViewModel(),
        hasRows: false,
        review: { rejected: 0, duplicates: 0, transfers: 0, total: 0 }
      },
      formatters
    );

    expect(html).toContain("no rows in current filter");
    expect(html).toContain("—");
    expect(html).toContain('aria-label="Cockpit summary"');
  });
});

const formatters = {
  formatMoney: (value: number) => `$${value.toLocaleString("en-US")}`,
  formatRunway: (months: number | null) => (months === null ? "Not enough data" : `${months} months`)
};

function baseViewModel(): CockpitViewModel {
  return {
    revenue: 48210,
    outflow: 36540,
    netCash: 11670,
    runwayMonths: 6.2,
    averageMonthlyOutflow: 5220,
    inflowCount: 142,
    outflowCount: 318,
    runwayTone: "watch",
    review: { rejected: 4, duplicates: 2, transfers: 1, total: 7 },
    hasRows: true
  };
}
