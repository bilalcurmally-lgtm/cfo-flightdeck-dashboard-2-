import { describe, expect, it } from "vitest";
import { renderReviewDrawer, type ReviewDrawerItem } from "./review-drawer";

describe("renderReviewDrawer", () => {
  it("renders conservative review suggested wording with include/exclude toggles", () => {
    const html = renderReviewDrawer(
      [
        item({
          id: "transfer:out:in",
          kind: "transfer",
          title: "Possible transfer",
          body: "2026-03-04 $1,000 moved from Checking to Savings.",
          rowIds: ["out", "in"],
          confidence: "medium",
          excluded: false
        })
      ],
      { updatedLabel: "$2,500 runway re-derived" }
    );

    expect(html).toContain("Review suggested");
    expect(html).toContain("Possible transfer");
    expect(html).toContain("2026-03-04 $1,000 moved from Checking to Savings.");
    expect(html).toContain('data-bw-review-toggle="transfer:out:in"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain("Exclude from KPIs");
    expect(html).toContain("$2,500 runway re-derived");
  });

  it("marks excluded items as included-on-click and renders the warm empty state", () => {
    const html = renderReviewDrawer(
      [
        item({
          id: "duplicate:one",
          kind: "duplicate",
          title: "Possible duplicate",
          excluded: true
        })
      ],
      { updatedLabel: "Runway updated to 5.9 months" }
    );

    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("Include in KPIs");
    expect(html).toContain("Runway updated to 5.9 months");

    expect(renderReviewDrawer([], { updatedLabel: "" })).toContain(
      "Nothing to review — your numbers look clean."
    );
  });
});

function item(overrides: Partial<ReviewDrawerItem>): ReviewDrawerItem {
  return {
    id: "item",
    kind: "duplicate",
    title: "Possible duplicate",
    body: "Two imported rows look alike.",
    rowIds: ["row-2"],
    confidence: "medium",
    excluded: false,
    ...overrides
  };
}
