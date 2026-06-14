import { describe, expect, it } from "vitest";
import {
  isMetricRole,
  validateMetricContract,
  type MetricContract
} from "./metric-contract";

function contract(overrides: Partial<MetricContract> = {}): MetricContract {
  return {
    id: "netCash",
    label: "Net Cash",
    role: "primary",
    decisionQuestion: "Did we end the period with more or less cash?",
    formula: "revenue - outflow",
    format: "currency",
    requiredInputs: ["revenue", "outflow"],
    caveats: ["Excludes non-operating transfers."],
    readiness: "Requires a fully classified ledger.",
    ...overrides
  };
}

describe("isMetricRole", () => {
  it("accepts the four defined roles", () => {
    expect(isMetricRole("primary")).toBe(true);
    expect(isMetricRole("driver")).toBe(true);
    expect(isMetricRole("guardrail")).toBe(true);
    expect(isMetricRole("detail")).toBe(true);
  });

  it("rejects unknown roles", () => {
    expect(isMetricRole("hero")).toBe(false);
    expect(isMetricRole("")).toBe(false);
  });
});

describe("validateMetricContract", () => {
  it("returns no problems for a complete contract", () => {
    expect(validateMetricContract(contract())).toEqual([]);
  });

  it("flags a blank label", () => {
    expect(validateMetricContract(contract({ label: "  " }))).toContain(
      "label is required"
    );
  });

  it("flags a missing decision question", () => {
    expect(validateMetricContract(contract({ decisionQuestion: "" }))).toContain(
      "decisionQuestion is required"
    );
  });

  it("flags a missing formula", () => {
    expect(validateMetricContract(contract({ formula: "" }))).toContain(
      "formula is required"
    );
  });

  it("flags an unknown role", () => {
    expect(
      validateMetricContract(contract({ role: "hero" as MetricContract["role"] }))
    ).toContain("role is invalid");
  });

  it("flags an empty required-inputs list", () => {
    expect(validateMetricContract(contract({ requiredInputs: [] }))).toContain(
      "requiredInputs must list at least one input"
    );
  });
});
