import { describe, expect, it } from "vitest";
import type { AuditedCockpit } from "../finance/audit";
import { renderCockpitStrip } from "./dashboard-cockpit";

describe("renderCockpitStrip", () => {
  it("renders the six cockpit tiles when review work exists", () => {
    const html = renderCockpitStrip(baseViewModel(), formatters);

    expect(html.match(/class="bw-kpi(?:\s|")/g)?.length).toBe(6);
    expect(html).toContain("Revenue");
    expect(html).toContain("Outflow");
    expect(html).toContain("Net cash");
    expect(html).toContain("Avg burn");
    expect(html).toContain("Runway");
    expect(html).toContain("Needs review");
    expect(html).toContain("4 rejected · 2 dupes · 1 transfer");
    // with the review tile present the strip needs the six-column class
    expect(html).toContain("bw-cockpit bw-cockpit--6");
  });

  it("renders auditable KPI triggers and hidden lineage panel templates for every metric", () => {
    const html = renderCockpitStrip(baseViewModel(), formatters);

    for (const metric of ["revenue", "outflow", "netCash", "averageMonthlyOutflow", "runwayMonths"]) {
      expect(html).toContain(`data-bw-lineage-trigger="${metric}"`);
      expect(html).toContain(`data-bw-lineage-template="${metric}"`);
    }
    expect(html).toContain("data-bw-lineage-panel");
    expect(html).toContain('aria-expanded="false"');
  });

  it("omits the review tile and uses the base five-column class when count is zero", () => {
    const html = renderCockpitStrip(
      {
        ...baseViewModel(),
        review: { rejected: 0, duplicates: 0, transfers: 0, total: 0 }
      },
      formatters
    );

    expect(html.match(/class="bw-kpi(?:\s|")/g)?.length).toBe(5);
    expect(html).not.toContain("Needs review");
    expect(html).toContain('class="bw-cockpit"');
    expect(html).not.toContain("bw-cockpit--6");
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

  it("summarizes review tile meta from the same item set as the tile count", () => {
    const html = renderCockpitStrip(
      {
        ...baseViewModel(),
        review: { rejected: 0, duplicates: 0, transfers: 1, total: 1 }
      },
      formatters,
      [
        {
          id: "transfer:one",
          kind: "transfer",
          title: "Possible transfer",
          body: "One active transfer.",
          rowIds: ["out-1", "in-1"],
          confidence: "medium",
          excluded: false
        },
        {
          id: "transfer:two",
          kind: "transfer",
          title: "Possible transfer",
          body: "One saved transfer.",
          rowIds: ["out-2", "in-2"],
          confidence: "medium",
          excluded: true
        }
      ]
    );

    expect(html).toContain("Needs review");
    expect(html).toContain('<span class="bw-kpi__value">2</span>');
    expect(html).toContain("2 transfers · 1 saved decision");
    expect(html).not.toContain("1 transfer");
  });

  it("counts grouped rejected rows as one review item when a review queue is provided", () => {
    const html = renderCockpitStrip(
      {
        ...baseViewModel(),
        review: { rejected: 4, duplicates: 0, transfers: 0, total: 4 }
      },
      formatters,
      [
        {
          id: "rejected:rows",
          kind: "rejected",
          title: "Rejected import rows",
          body: "4 rows could not be imported.",
          rowIds: [],
          confidence: "high",
          excluded: true
        }
      ]
    );

    expect(html).toContain('<span class="bw-kpi__value">1</span>');
    expect(html).toContain("1 rejected · 1 saved decision");
  });
});

const formatters = {
  formatMoney: (value: number) => `$${value.toLocaleString("en-US")}`,
  formatRunway: (months: number | null) => (months === null ? "Not enough data" : `${months} months`)
};

function baseViewModel(): AuditedCockpit {
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
    hasRows: true,
    lineage: {
      revenue: {
        metric: "revenue",
        value: 48210,
        formulaText: "Revenue = sum of revenue rows",
        plainEnglish: "Revenue is the sum of imported revenue rows.",
        direct: [
          { id: "r1", dateISO: "2026-03-01", amount: 48210, head: "Client", flow: "revenue" }
        ],
        assumptions: [],
        excluded: []
      },
      outflow: {
        metric: "outflow",
        value: 36540,
        formulaText: "Outflow = sum of outflow rows",
        plainEnglish: "Outflow is the sum of imported outflow rows.",
        direct: [
          { id: "o1", dateISO: "2026-03-02", amount: 36540, head: "Ops", flow: "outflow" }
        ],
        assumptions: [],
        excluded: []
      },
      netCash: {
        metric: "netCash",
        value: 11670,
        formulaText: "Net cash = revenue - outflow",
        plainEnglish: "Net cash subtracts outflow from revenue.",
        direct: [],
        derived: {
          label: "Net cash",
          value: 11670,
          op: "subtract",
          children: [
            { label: "Revenue", value: 48210, op: "sum" },
            { label: "Outflow", value: 36540, op: "sum" }
          ]
        },
        assumptions: [],
        excluded: []
      },
      averageMonthlyOutflow: {
        metric: "averageMonthlyOutflow",
        value: 5220,
        formulaText: "Average monthly outflow = monthly outflow total / month count",
        plainEnglish: "Average monthly outflow uses recorded outflow months.",
        direct: [],
        assumptions: [],
        excluded: []
      },
      runwayMonths: {
        metric: "runwayMonths",
        value: 6.2,
        formulaText: "Runway = cash on hand / average monthly outflow",
        plainEnglish: "Runway uses user-entered cash on hand.",
        direct: [],
        derived: {
          label: "Runway",
          value: 6.2,
          op: "divide",
          children: [
            { label: "Cash on hand", value: 32364, op: "identity" },
            { label: "Average monthly outflow", value: 5220, op: "avg" }
          ]
        },
        assumptions: [{ label: "Cash on hand", value: 32364, source: "user-entered" }],
        excluded: []
      }
    }
  };
}
