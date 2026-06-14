import { describe, expect, it } from "vitest";
import type { BurnContributors } from "../finance/metric-diagnostics";
import { renderBurnContributors } from "./burn-contributors";

const fmtMoney = (value: number) => `$${value.toLocaleString("en-US")}`;

function contributors(over: Partial<BurnContributors> = {}): BurnContributors {
  return {
    total: 6000,
    heads: [
      { label: "Payroll", amount: 4500, share: 0.75 },
      { label: "Rent", amount: 1500, share: 0.25 }
    ],
    subcategories: [
      { label: "Payroll / Engineering", amount: 3000, share: 0.5 },
      { label: "Payroll / Design", amount: 1500, share: 0.25 }
    ],
    ...over
  };
}

describe("renderBurnContributors", () => {
  it("renders burn drivers by head and subcategory", () => {
    const html = renderBurnContributors(contributors(), fmtMoney);

    expect(html).toContain("What's driving burn");
    expect(html).toContain("By head");
    expect(html).toContain("Payroll");
    expect(html).toContain("$4,500");
    expect(html).toContain("75%");
    expect(html).toContain("By subcategory");
    expect(html).toContain("Payroll / Engineering");
  });

  it("renders nothing when there is no burn", () => {
    expect(renderBurnContributors({ total: 0, heads: [], subcategories: [] }, fmtMoney)).toBe("");
  });

  it("escapes untrusted labels", () => {
    const html = renderBurnContributors(
      contributors({ heads: [{ label: "<b>Payroll</b>", amount: 1, share: 1 }] }),
      fmtMoney
    );

    expect(html).not.toContain("<b>Payroll</b>");
    expect(html).toContain("&lt;b&gt;Payroll&lt;/b&gt;");
  });
});
