import { describe, expect, it } from "vitest";
import {
  explainRunwayChange,
  type DiagnosticsFormatters,
  type RunwayInputs
} from "./metric-diagnostics";

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
