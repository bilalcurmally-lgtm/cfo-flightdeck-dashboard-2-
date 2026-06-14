import { describe, expect, it } from "vitest";
import {
  explainRunwayChange,
  topNetCashContributors,
  type DiagnosticsFormatters,
  type RunwayInputs
} from "./metric-diagnostics";
import type { TransactionRecord } from "./types";

function record(
  head: string,
  flow: TransactionRecord["flow"],
  amount: number
): TransactionRecord {
  return {
    id: `${head}-${flow}-${amount}`,
    date: new Date("2026-03-01T00:00:00"),
    dateISO: "2026-03-01",
    periodDaily: "2026-03-01",
    periodWeekly: "2026-03-01",
    periodMonthly: "2026-03",
    head,
    parent: "Group",
    subcategory: "Subcategory",
    description: "Memo",
    counterparty: "Counterparty",
    account: "Operating",
    flow,
    amount,
    signedNet: flow === "revenue" ? amount : -amount,
    runningBalance: null
  };
}

const formatters: DiagnosticsFormatters = {
  formatMoney: (value) => `$${Math.round(value)}`,
  formatRunway: (months) => (months === null ? "n/a" : `${months.toFixed(1)} mo`)
};

function inputs(overrides: Partial<RunwayInputs> = {}): RunwayInputs {
  return { runwayMonths: 6, cashOnHand: 6000, averageMonthlyOutflow: 1000, ...overrides };
}

describe("explainRunwayChange", () => {
  it("attributes a drop to rising burn when cash is unchanged", () => {
    const prev = inputs({ runwayMonths: 10, cashOnHand: 10000, averageMonthlyOutflow: 1000 });
    const curr = inputs({ runwayMonths: 5, cashOnHand: 10000, averageMonthlyOutflow: 2000 });
    const result = explainRunwayChange(prev, curr, formatters);

    expect(result.direction).toBe("down");
    expect(result.headline).toContain("fell");
    expect(result.headline.toLowerCase()).toContain("burn");
    expect(result.drivers[0].factor).toBe("burn");
    expect(result.drivers[0].detail).toContain("$1000"); // burn rose by 1000
  });

  it("attributes a rise to growing cash when burn is unchanged", () => {
    const prev = inputs({ runwayMonths: 5, cashOnHand: 5000, averageMonthlyOutflow: 1000 });
    const curr = inputs({ runwayMonths: 10, cashOnHand: 10000, averageMonthlyOutflow: 1000 });
    const result = explainRunwayChange(prev, curr, formatters);

    expect(result.direction).toBe("up");
    expect(result.headline).toContain("rose");
    expect(result.headline.toLowerCase()).toContain("cash");
    expect(result.drivers[0].factor).toBe("cash");
  });

  it("orders the dominant driver first when both cash and burn move", () => {
    // cash +1000 (helps), burn +500 (hurts); cash effect dominates -> net up, cash first
    const prev = inputs({ runwayMonths: 5, cashOnHand: 5000, averageMonthlyOutflow: 1000 });
    const curr = inputs({ runwayMonths: 4, cashOnHand: 6000, averageMonthlyOutflow: 1500 });
    const result = explainRunwayChange(prev, curr, formatters);

    expect(result.drivers.map((d) => d.factor)).toEqual(["burn", "cash"]);
  });

  it("reports unavailable runway with the missing input", () => {
    const prev = inputs();
    const curr = inputs({ runwayMonths: null, cashOnHand: 0, averageMonthlyOutflow: 1000 });
    const result = explainRunwayChange(prev, curr, formatters);

    expect(result.direction).toBe("unavailable");
    expect(result.headline.toLowerCase()).toContain("cash on hand");
    expect(result.drivers).toEqual([]);
  });

  it("explains there is no comparable prior runway", () => {
    const prev = inputs({ runwayMonths: null, cashOnHand: 0 });
    const curr = inputs({ runwayMonths: 7 });
    const result = explainRunwayChange(prev, curr, formatters);

    expect(result.direction).toBe("flat");
    expect(result.headline.toLowerCase()).toContain("no comparable");
    expect(result.drivers).toEqual([]);
  });

  it("reports a held runway when nothing material changed", () => {
    const result = explainRunwayChange(inputs(), inputs(), formatters);
    expect(result.direction).toBe("flat");
    expect(result.headline.toLowerCase()).toContain("held");
  });
});

describe("topNetCashContributors", () => {
  it("groups revenue by head and returns the biggest inflows first", () => {
    const result = topNetCashContributors([
      record("Client A", "revenue", 2000),
      record("Client A", "revenue", 500),
      record("Client B", "revenue", 1000),
      record("Rent", "outflow", 800)
    ]);

    expect(result.positives.map((c) => [c.label, c.amount])).toEqual([
      ["Client A", 2500],
      ["Client B", 1000]
    ]);
    expect(result.positives[0].flow).toBe("revenue");
  });

  it("groups outflow by head and returns the biggest outflows first", () => {
    const result = topNetCashContributors([
      record("Payroll", "outflow", 3000),
      record("Rent", "outflow", 1500),
      record("Software", "outflow", 200),
      record("Client A", "revenue", 100)
    ]);

    expect(result.negatives.map((c) => c.label)).toEqual([
      "Payroll",
      "Rent",
      "Software"
    ]);
    expect(result.negatives[0].flow).toBe("outflow");
  });

  it("respects the limit on each side", () => {
    const result = topNetCashContributors(
      [
        record("A", "revenue", 5),
        record("B", "revenue", 4),
        record("C", "revenue", 3),
        record("X", "outflow", 5),
        record("Y", "outflow", 4),
        record("Z", "outflow", 3)
      ],
      { limit: 2 }
    );
    expect(result.positives).toHaveLength(2);
    expect(result.negatives).toHaveLength(2);
    expect(result.positives.map((c) => c.label)).toEqual(["A", "B"]);
  });

  it("returns empty sides for an empty ledger", () => {
    expect(topNetCashContributors([])).toEqual({ positives: [], negatives: [] });
  });

  it("groups by counterparty when asked", () => {
    const a = record("Misc", "revenue", 1000);
    const b = record("Misc", "revenue", 400);
    const result = topNetCashContributors([{ ...a, counterparty: "Stripe" }, { ...b, counterparty: "Direct" }], {
      groupBy: "counterparty"
    });
    expect(result.positives.map((c) => c.label)).toEqual(["Stripe", "Direct"]);
  });
});
