import { describe, expect, it } from "vitest";
import {
  explainRunwayChange,
  filterExclusionImpact,
  largestTransactionInfluence,
  revenueConcentration,
  topBurnContributors,
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

describe("topBurnContributors", () => {
  it("groups outflow by head and ranks the biggest burn drivers first", () => {
    const result = topBurnContributors([
      record("Payroll", "outflow", 3000),
      record("Payroll", "outflow", 1500),
      record("Rent", "outflow", 1200),
      record("Client", "revenue", 5000)
    ]);

    expect(result.total).toBe(5700);
    expect(result.heads.map((item) => [item.label, item.amount])).toEqual([
      ["Payroll", 4500],
      ["Rent", 1200]
    ]);
    expect(result.heads[0].share).toBeCloseTo(4500 / 5700);
  });

  it("groups outflow by head and subcategory for more specific burn drivers", () => {
    const a = record("Payroll", "outflow", 3000);
    const b = record("Payroll", "outflow", 1500);
    const c = record("Software", "outflow", 400);
    const result = topBurnContributors([
      { ...a, subcategory: "Engineering" },
      { ...b, subcategory: "Design" },
      { ...c, subcategory: "Tools" }
    ]);

    expect(result.subcategories.map((item) => [item.label, item.amount])).toEqual([
      ["Payroll / Engineering", 3000],
      ["Payroll / Design", 1500],
      ["Software / Tools", 400]
    ]);
  });

  it("respects the limit for head and subcategory lists", () => {
    const result = topBurnContributors(
      [
        record("A", "outflow", 5),
        record("B", "outflow", 4),
        record("C", "outflow", 3)
      ],
      { limit: 2 }
    );

    expect(result.heads.map((item) => item.label)).toEqual(["A", "B"]);
    expect(result.subcategories).toHaveLength(2);
  });

  it("returns empty contributors when there is no outflow", () => {
    expect(topBurnContributors([record("Client", "revenue", 5000)])).toEqual({
      total: 0,
      heads: [],
      subcategories: []
    });
  });
});

describe("revenueConcentration", () => {
  it("reports the top revenue source by head and counterparty", () => {
    const a = { ...record("Retainers", "revenue", 7000), counterparty: "Northstar" };
    const b = { ...record("Projects", "revenue", 2000), counterparty: "Riverbend" };
    const c = { ...record("Projects", "revenue", 1000), counterparty: "Northstar" };
    const result = revenueConcentration([a, b, c, record("Payroll", "outflow", 3000)]);

    expect(result.total).toBe(10000);
    expect(result.topHead).toEqual({ label: "Retainers", amount: 7000, share: 0.7 });
    expect(result.topCounterparty).toEqual({ label: "Northstar", amount: 8000, share: 0.8 });
  });

  it("returns ranked head and counterparty lists", () => {
    const result = revenueConcentration([
      { ...record("A", "revenue", 5000), counterparty: "One" },
      { ...record("B", "revenue", 3000), counterparty: "Two" },
      { ...record("C", "revenue", 2000), counterparty: "Two" }
    ]);

    expect(result.heads.map((item) => item.label)).toEqual(["A", "B", "C"]);
    expect(result.counterparties.map((item) => [item.label, item.amount])).toEqual([
      ["One", 5000],
      ["Two", 5000]
    ]);
  });

  it("respects the list limit", () => {
    const result = revenueConcentration(
      [
        { ...record("A", "revenue", 5), counterparty: "One" },
        { ...record("B", "revenue", 4), counterparty: "Two" },
        { ...record("C", "revenue", 3), counterparty: "Three" }
      ],
      { limit: 2 }
    );

    expect(result.heads).toHaveLength(2);
    expect(result.counterparties).toHaveLength(2);
  });

  it("returns empty concentration when there is no revenue", () => {
    expect(revenueConcentration([record("Payroll", "outflow", 3000)])).toEqual({
      total: 0,
      topHead: null,
      topCounterparty: null,
      heads: [],
      counterparties: []
    });
  });
});

describe("largestTransactionInfluence", () => {
  it("reports the largest transaction and its share of gross activity", () => {
    const result = largestTransactionInfluence([
      { ...record("Client", "revenue", 5000), id: "rev-1", description: "Annual retainer" },
      { ...record("Payroll", "outflow", 3000), id: "out-1", description: "Payroll run" },
      { ...record("Software", "outflow", 2000), id: "out-2", description: "Tools" }
    ]);

    expect(result).toMatchObject({
      id: "rev-1",
      label: "Annual retainer",
      head: "Client",
      flow: "revenue",
      amount: 5000,
      signedImpact: 5000,
      totalActivity: 10000,
      netCash: 0
    });
    expect(result?.shareOfActivity).toBe(0.5);
  });

  it("uses signed impact for outflow transactions", () => {
    const result = largestTransactionInfluence([
      { ...record("Client", "revenue", 1000), id: "rev-1" },
      { ...record("Payroll", "outflow", 4000), id: "out-1" }
    ]);

    expect(result?.id).toBe("out-1");
    expect(result?.signedImpact).toBe(-4000);
    expect(result?.netCash).toBe(-3000);
  });

  it("returns null for an empty ledger", () => {
    expect(largestTransactionInfluence([])).toBeNull();
  });
});

describe("filterExclusionImpact", () => {
  it("summarizes how the current view changed headline cash metrics", () => {
    const result = filterExclusionImpact(
      { revenue: 10000, outflow: 7000, netCash: 3000, transactionCount: 10 },
      { revenue: 8000, outflow: 4000, netCash: 4000, transactionCount: 7 }
    );

    expect(result).toEqual({
      before: { revenue: 10000, outflow: 7000, netCash: 3000, transactionCount: 10 },
      after: { revenue: 8000, outflow: 4000, netCash: 4000, transactionCount: 7 },
      hiddenRecords: 3,
      deltas: [
        { metric: "revenue", before: 10000, after: 8000, delta: -2000 },
        { metric: "outflow", before: 7000, after: 4000, delta: -3000 },
        { metric: "netCash", before: 3000, after: 4000, delta: 1000 }
      ]
    });
  });

  it("returns null when nothing changed", () => {
    const snapshot = { revenue: 100, outflow: 50, netCash: 50, transactionCount: 2 };
    expect(filterExclusionImpact(snapshot, snapshot)).toBeNull();
  });

  it("never reports negative hidden records", () => {
    const result = filterExclusionImpact(
      { revenue: 100, outflow: 0, netCash: 100, transactionCount: 1 },
      { revenue: 120, outflow: 0, netCash: 120, transactionCount: 2 }
    );
    expect(result?.hiddenRecords).toBe(0);
  });
});
