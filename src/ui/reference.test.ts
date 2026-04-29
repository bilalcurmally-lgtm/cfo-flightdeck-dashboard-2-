import { describe, expect, it } from "vitest";
import { renderReferencePanelContent } from "./reference";

describe("renderReferencePanelContent", () => {
  it("summarizes current import and export behavior", () => {
    const html = renderReferencePanelContent();

    expect(html).toContain("Duplicate column names");
    expect(html).toContain("Amount_2");
    expect(html).toContain("Trend CSV, SVG, and PNG");
  });
});
