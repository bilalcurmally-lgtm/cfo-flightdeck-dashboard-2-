import { describe, expect, it } from "vitest";
import type { NetCashContributors } from "../finance/metric-diagnostics";
import { renderNetCashContributors } from "./net-cash-contributors";

const fmtMoney = (value: number) => `$${value.toLocaleString("en-US")}`;

function contributors(over: Partial<NetCashContributors> = {}): NetCashContributors {
  return {
    positives: [
      { label: "Client A", amount: 2500, flow: "revenue" },
      { label: "Client B", amount: 1000, flow: "revenue" }
    ],
    negatives: [{ label: "Payroll", amount: 3000, flow: "outflow" }],
    ...over
  };
}

describe("renderNetCashContributors", () => {
  it("renders the biggest inflows and outflows with amounts", () => {
    const html = renderNetCashContributors(contributors(), fmtMoney);
    expect(html).toContain("Client A");
    expect(html).toContain("$2,500");
    expect(html).toContain("Payroll");
    expect(html).toContain("$3,000");
    expect(html).toContain("Biggest inflows");
    expect(html).toContain("Biggest outflows");
  });

  it("renders nothing when there are no contributors", () => {
    expect(renderNetCashContributors({ positives: [], negatives: [] }, fmtMoney)).toBe("");
  });

  it("omits a side that has no contributors", () => {
    const html = renderNetCashContributors(
      contributors({ negatives: [] }),
      fmtMoney
    );
    expect(html).toContain("Biggest inflows");
    expect(html).not.toContain("Biggest outflows");
  });

  it("escapes untrusted labels", () => {
    const html = renderNetCashContributors(
      contributors({ positives: [{ label: "<b>x</b>", amount: 1, flow: "revenue" }] }),
      fmtMoney
    );
    expect(html).not.toContain("<b>x</b>");
    expect(html).toContain("&lt;b&gt;");
  });
});
