import { describe, expect, it } from "vitest";
import type { FilterExclusionImpact } from "../finance/metric-diagnostics";
import { renderFilterExclusionImpact } from "./filter-exclusion-impact";

const fmtMoney = (value: number) => `$${value.toLocaleString("en-US")}`;

function impact(over: Partial<FilterExclusionImpact> = {}): FilterExclusionImpact {
  return {
    before: { revenue: 10000, outflow: 7000, netCash: 3000, transactionCount: 10 },
    after: { revenue: 8000, outflow: 4000, netCash: 4000, transactionCount: 7 },
    hiddenRecords: 3,
    deltas: [
      { metric: "revenue", before: 10000, after: 8000, delta: -2000 },
      { metric: "outflow", before: 7000, after: 4000, delta: -3000 },
      { metric: "netCash", before: 3000, after: 4000, delta: 1000 }
    ],
    ...over
  };
}

describe("renderFilterExclusionImpact", () => {
  it("renders metric deltas and hidden record count", () => {
    const html = renderFilterExclusionImpact(impact(), fmtMoney);

    expect(html).toContain("Current view impact");
    expect(html).toContain("3 rows hidden");
    expect(html).toContain("Revenue");
    expect(html).toContain("-$2,000");
    expect(html).toContain("Outflow");
    expect(html).toContain("-$3,000");
    expect(html).toContain("Net cash");
    expect(html).toContain("+$1,000");
  });

  it("renders nothing when there is no impact", () => {
    expect(renderFilterExclusionImpact(null, fmtMoney)).toBe("");
  });
});
