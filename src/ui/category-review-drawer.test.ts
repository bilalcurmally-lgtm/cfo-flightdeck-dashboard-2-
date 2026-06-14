// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderCategoryReviewDrawer } from "./category-review-drawer";
import type { CategoryReviewItem } from "./category-review-queue";

function item(o: Partial<CategoryReviewItem> = {}): CategoryReviewItem {
  return { id: "a", flow: "outflow", parent: "Operating Costs", head: "Owner Draw",
    label: "ACME — Owner Draw", reasons: ["keyword"], acted: false, record: {} as any, ...o };
}
describe("renderCategoryReviewDrawer", () => {
  it("renders Type+Group selects with current values", () => {
    const el = document.createElement("div");
    el.innerHTML = renderCategoryReviewDrawer([item()]);
    expect(el.querySelector<HTMLSelectElement>('[data-role="flow-select"]')?.value).toBe("outflow");
    expect(el.querySelector<HTMLSelectElement>('[data-role="group-select"]')?.value).toBe("Operating Costs");
  });
  it("escapes labels and keeps item ids on interactive controls", () => {
    const html = renderCategoryReviewDrawer([item({ id: "x", label: "<b>bad</b>" })]);
    expect(html).toContain("&lt;b&gt;bad&lt;/b&gt;");
    expect(html).toContain('data-category-id="x"');
  });
  it("shows Reset only for acted rows", () => {
    const el = document.createElement("div");
    el.innerHTML = renderCategoryReviewDrawer([item({ acted: true })]);
    expect(el.querySelector('[data-role="reset"]')).not.toBeNull();
  });
  it("shows Remember rule only for acted rows", () => {
    const acted = document.createElement("div");
    acted.innerHTML = renderCategoryReviewDrawer([item({ acted: true })]);
    expect(acted.querySelector('[data-role="save-rule"]')).not.toBeNull();

    const untouched = document.createElement("div");
    untouched.innerHTML = renderCategoryReviewDrawer([item({ acted: false })]);
    expect(untouched.querySelector('[data-role="save-rule"]')).toBeNull();
  });
});
