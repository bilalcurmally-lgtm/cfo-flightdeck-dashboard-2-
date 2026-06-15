import { describe, expect, it } from "vitest";
import { validateMetricContract } from "./metric-contract";
import {
  getDetailMetricContracts,
  getMetricContract,
  getMetricsByRole,
  getScalarMetricContracts,
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

  it("returns detail metrics for reporting surfaces", () => {
    expect(getMetricsByRole("detail").map((contract) => contract.id)).toEqual([
      "topHeads",
      "topSubcategories",
      "transactionPreview",
      "rawRow",
      "importQuality",
      "accountBalances"
    ]);
  });
});

describe("scalar vs detail contract helpers", () => {
  it("keeps scalar contracts separate from detail reporting contracts", () => {
    const scalarIds = getScalarMetricContracts().map((contract) => contract.id);
    const detailIds = getDetailMetricContracts().map((contract) => contract.id);

    expect(scalarIds).toEqual(
      expect.arrayContaining([
        "netCash",
        "runwayMonths",
        "revenue",
        "outflow",
        "rejectedRows"
      ])
    );
    expect(detailIds).toEqual([
      "topHeads",
      "topSubcategories",
      "transactionPreview",
      "rawRow",
      "importQuality",
      "accountBalances"
    ]);
    expect(scalarIds.some((id) => detailIds.includes(id))).toBe(false);
    expect(scalarIds.length + detailIds.length).toBe(metricContracts.length);
  });
});
