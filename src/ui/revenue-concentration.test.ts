import { describe, expect, it } from "vitest";
import type { RevenueConcentration } from "../finance/metric-diagnostics";
import { renderRevenueConcentration } from "./revenue-concentration";

const fmtMoney = (value: number) => `$${value.toLocaleString("en-US")}`;

function concentration(over: Partial<RevenueConcentration> = {}): RevenueConcentration {
  return {
    total: 10000,
    topHead: { label: "Retainers", amount: 7000, share: 0.7 },
    topCounterparty: { label: "Northstar", amount: 8000, share: 0.8 },
    heads: [
      { label: "Retainers", amount: 7000, share: 0.7 },
      { label: "Projects", amount: 3000, share: 0.3 }
    ],
    counterparties: [
      { label: "Northstar", amount: 8000, share: 0.8 },
      { label: "Riverbend", amount: 2000, share: 0.2 }
    ],
    ...over
  };
}

describe("renderRevenueConcentration", () => {
  it("renders top revenue concentration by head and counterparty", () => {
    const html = renderRevenueConcentration(concentration(), fmtMoney);

    expect(html).toContain("Revenue concentration");
    expect(html).toContain("Top head");
    expect(html).toContain("Retainers");
    expect(html).toContain("$7,000");
    expect(html).toContain("70%");
    expect(html).toContain("Top counterparty");
    expect(html).toContain("Northstar");
    expect(html).toContain("80%");
  });

  it("renders nothing when there is no revenue", () => {
    expect(
      renderRevenueConcentration(
        { total: 0, topHead: null, topCounterparty: null, heads: [], counterparties: [] },
        fmtMoney
      )
    ).toBe("");
  });

  it("escapes untrusted labels", () => {
    const html = renderRevenueConcentration(
      concentration({ heads: [{ label: "<b>Retainers</b>", amount: 1, share: 1 }] }),
      fmtMoney
    );

    expect(html).not.toContain("<b>Retainers</b>");
    expect(html).toContain("&lt;b&gt;Retainers&lt;/b&gt;");
  });
});
