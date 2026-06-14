// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { FOCUSABLE_SELECTOR } from "./dashboard-cockpit-actions";

describe("FOCUSABLE_SELECTOR", () => {
  it("treats an expandable disclosure summary as focusable", () => {
    // Calc-tree buckets render <details><summary>…</summary></details>; the
    // panel focus trap must consider those summaries reachable, or Tab would
    // never land on them and the expandable rows become keyboard-dead.
    const summary = document.createElement("summary");
    expect(summary.matches(FOCUSABLE_SELECTOR)).toBe(true);
  });

  it("does not treat an inert container as focusable", () => {
    const div = document.createElement("div");
    expect(div.matches(FOCUSABLE_SELECTOR)).toBe(false);
  });
});
