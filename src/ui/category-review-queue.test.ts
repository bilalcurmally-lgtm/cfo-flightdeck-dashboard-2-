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
});
