import { describe, expect, it } from "vitest";
import type { LargestTransactionInfluence } from "../finance/metric-diagnostics";
import { renderLargestTransactionInfluence } from "./largest-transaction-influence";

const fmtMoney = (value: number) => `$${value.toLocaleString("en-US")}`;

function influence(over: Partial<LargestTransactionInfluence> = {}): LargestTransactionInfluence {
  return {
    id: "txn-1",
    label: "Annual retainer",
    dateISO: "2026-03-01",
    head: "Client",
    counterparty: "Northstar",
    flow: "revenue",
    amount: 5000,
    signedImpact: 5000,
    totalActivity: 10000,
    netCash: 2000,
    shareOfActivity: 0.5,
    ...over
  };
}

describe("renderLargestTransactionInfluence", () => {
  it("renders the largest transaction with amount, share, and signed impact", () => {
    const html = renderLargestTransactionInfluence(influence(), fmtMoney);

    expect(html).toContain("Largest transaction");
    expect(html).toContain("Annual retainer");
    expect(html).toContain("Northstar");
    expect(html).toContain("$5,000");
    expect(html).toContain("50%");
    expect(html).toContain("+$5,000");
  });

  it("renders nothing when there is no transaction", () => {
    expect(renderLargestTransactionInfluence(null, fmtMoney)).toBe("");
  });

  it("escapes untrusted labels", () => {
    const html = renderLargestTransactionInfluence(
      influence({ label: "<b>Annual</b>", counterparty: "<i>Client</i>" }),
      fmtMoney
    );

    expect(html).not.toContain("<b>Annual</b>");
    expect(html).not.toContain("<i>Client</i>");
    expect(html).toContain("&lt;b&gt;Annual&lt;/b&gt;");
  });
});
