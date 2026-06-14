import { describe, expect, it } from "vitest";
import {
  applyClassificationRules,
  applyClassificationRulesWithMatches,
  type ClassificationRule
} from "./classification-rules";
import type { TransactionRecord } from "./types";

function record(overrides: Partial<TransactionRecord>): TransactionRecord {
  return {
    id: "row-1",
    date: new Date("2026-01-01T00:00:00.000Z"),
    dateISO: "2026-01-01",
    periodDaily: "2026-01-01",
    periodWeekly: "2026-W01",
    periodMonthly: "2026-01",
    flow: "outflow",
    amount: 100,
    signedNet: -100,
    head: "Unassigned Head",
    parent: "Operating",
    subcategory: "Unassigned Subcategory",
    counterparty: "Stripe payout",
    description: "Stripe transfer",
    account: "Checking",
    runningBalance: null,
    ...overrides
  };
}

function rule(overrides: Partial<ClassificationRule> = {}): ClassificationRule {
  return {
    id: "rule-1",
    field: "counterparty",
    contains: "stripe",
    override: { flow: "revenue", parent: "Sales" },
    enabled: true,
    ...overrides
  };
}

describe("applyClassificationRules", () => {
  it("creates overrides for records whose configured field contains the rule text", () => {
    const overrides = applyClassificationRules(
      [record({ id: "a", counterparty: "Stripe" }), record({ id: "b", counterparty: "Rent" })],
      [rule()]
    );

    expect(overrides.get("a")).toEqual({ flow: "revenue", parent: "Sales" });
    expect(overrides.has("b")).toBe(false);
  });

  it("ignores disabled rules and blank match text", () => {
    const records = [record({ id: "a", counterparty: "Stripe" })];
    expect(applyClassificationRules(records, [rule({ enabled: false })]).size).toBe(0);
    expect(applyClassificationRules(records, [rule({ contains: "  " })]).size).toBe(0);
  });

  it("merges multiple matching rules in order so later rules can refine earlier ones", () => {
    const overrides = applyClassificationRules(
      [record({ id: "a", description: "stripe loan repayment" })],
      [
        rule({ id: "flow", field: "description", contains: "stripe", override: { flow: "revenue" } }),
        rule({ id: "parent", field: "description", contains: "loan", override: { parent: "Financing" } }),
        rule({ id: "final", field: "description", contains: "repayment", override: { flow: "outflow" } })
      ]
    );

    expect(overrides.get("a")).toEqual({ flow: "outflow", parent: "Financing" });
  });

  it("reports matched record and rule ids for import feedback", () => {
    const result = applyClassificationRulesWithMatches(
      [
        record({ id: "a", counterparty: "Owner" }),
        record({ id: "b", counterparty: "Stripe" })
      ],
      [
        rule({ id: "owner", contains: "owner", override: { parent: "Internal" } }),
        rule({ id: "stripe", contains: "stripe", override: { parent: "Income" } })
      ]
    );

    expect([...result.matchedRecordIds]).toEqual(["a", "b"]);
    expect([...result.matchedRuleIds]).toEqual(["owner", "stripe"]);
    expect(result.overrides.get("a")).toEqual({ parent: "Internal" });
  });
});
