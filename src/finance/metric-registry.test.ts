import { describe, expect, it } from "vitest";
import { validateMetricContract } from "./metric-contract";
import {
  getMetricContract,
  getMetricsByRole,
  metricContracts
} from "./metric-registry";

describe("metricContracts", () => {
  it("registers at least the core cockpit metrics", () => {
    const ids = metricContracts.map((contract) => contract.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "netCash",
        "runwayMonths",
        "revenue",
        "outflow",
        "averageMonthlyOutflow"
      ])
    );
  });

  it("has no duplicate ids", () => {
    const ids = metricContracts.map((contract) => contract.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every registered contract is well-formed", () => {
    for (const contract of metricContracts) {
      expect(validateMetricContract(contract)).toEqual([]);
    }
  });
});

describe("getMetricContract", () => {
  it("returns the contract for a known id", () => {
    expect(getMetricContract("runwayMonths")).toMatchObject({
      id: "runwayMonths",
      role: "primary",
      format: "months"
    });
  });

  it("returns undefined for an unknown id", () => {
    expect(getMetricContract("nope")).toBeUndefined();
  });
});

describe("getMetricsByRole", () => {
  it("returns net cash and runway as the primary metrics", () => {
    expect(getMetricsByRole("primary").map((contract) => contract.id)).toEqual([
      "netCash",
      "runwayMonths"
    ]);
  });

  it("returns drivers including revenue and outflow", () => {
    const ids = getMetricsByRole("driver").map((contract) => contract.id);
    expect(ids).toEqual(
      expect.arrayContaining(["revenue", "outflow", "averageMonthlyOutflow"])
    );
  });
});
