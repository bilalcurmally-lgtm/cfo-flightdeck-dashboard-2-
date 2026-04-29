import { describe, expect, it } from "vitest";
import type { ParsedExcelSheet } from "../import/excel";
import { renderWorksheetOption } from "./import-review";

describe("renderWorksheetOption", () => {
  it("renders a worksheet row preview alongside sheet metadata", () => {
    const html = renderWorksheetOption(
      sheet({
        name: "Operating",
        rows: [
          {
            Date: "2026-03-01",
            Amount: "3200",
            Counterparty: "Northstar Studio",
            Description: "Design retainer",
            Extra: "hidden"
          },
          {
            Date: "2026-03-04",
            Amount: "-49",
            Counterparty: "Figma",
            Description: "Design tools",
            Extra: "hidden"
          }
        ]
      }),
      1
    );

    expect(html).toContain('class="table-wrap worksheet-preview"');
    expect(html).toContain('aria-label="Operating worksheet preview"');
    expect(html).toContain("<th>Date</th>");
    expect(html).toContain("<th>Amount</th>");
    expect(html).toContain("<td>Northstar Studio</td>");
    expect(html).not.toContain("<th>Extra</th>");
    expect(html).toContain('data-sheet-index="1"');
    expect(html).not.toContain(" disabled");
  });

  it("escapes worksheet preview values and disables empty sheets", () => {
    const html = renderWorksheetOption(
      sheet({
        name: "<Helper>",
        rows: [],
        rawRowCount: 0
      }),
      0
    );

    expect(html).toContain("&lt;Helper&gt;");
    expect(html).toContain("No table-like rows detected");
    expect(html).toContain("No preview rows available.");
    expect(html).toContain('type="button" disabled');
  });
});

function sheet(overrides: Partial<ParsedExcelSheet>): ParsedExcelSheet {
  return {
    name: "Sheet",
    rows: [],
    rawRowCount: 2,
    ...overrides
  };
}
