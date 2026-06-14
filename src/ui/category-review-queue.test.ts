import { describe, it, expect } from "vitest";
import { buildCategoryReviewSummary } from "./category-review-queue";
import { rec } from "../finance/classification-overrides.test";

describe("buildCategoryReviewSummary", () => {
  it("flags by non-operating group", () => {
    const s = buildCategoryReviewSummary({ records: [rec({ id: "a", parent: "Financing" })], overrides: new Map() });
    expect(s.items.map((i) => i.id)).toEqual(["a"]);
    expect(s.items[0].reasons).toContain("non-operating-group");
  });
  it("flags owner-draw still in Operating by keyword", () => {
    const s = buildCategoryReviewSummary({ records: [rec({ id: "a", head: "Owner Draw" })], overrides: new Map() });
    expect(s.items[0].reasons).toContain("keyword");
  });
  it("does not flag an ordinary cost", () => {
    const s = buildCategoryReviewSummary({ records: [rec({ id: "a", head: "Rent", counterparty: "Landlord", subcategory: "" })], overrides: new Map() });
    expect(s.items).toEqual([]);
  });
  it("marks acted when an override exists", () => {
    const s = buildCategoryReviewSummary({ records: [rec({ id: "a", parent: "Financing" })], overrides: new Map([["a", { parent: "Income" }]]) });
    expect(s.items[0].acted).toBe(true);
  });
  it("keeps an override-carrying row even after it loses its only review reason (Reset stays reachable)", () => {
    // Row was flagged only by its non-operating group, then the override moved it to an
    // operating group with no keyword — current state has no review reason, but the
    // active override must keep it in the queue so Reset is reachable.
    const s = buildCategoryReviewSummary({
      records: [rec({ id: "a", parent: "Operating Costs", head: "Rent", subcategory: "", counterparty: "Landlord" })],
      overrides: new Map([["a", { parent: "Operating Costs" }]]),
    });
    expect(s.items.map((i) => i.id)).toEqual(["a"]);
    expect(s.items[0].acted).toBe(true);
    expect(s.items[0].reasons).toEqual([]);
  });
});
