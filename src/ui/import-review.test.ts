import { describe, expect, it } from "vitest";
import type { CsvImportResult } from "../finance/types";
import { analyzeImportReadiness } from "../import/validation";
import type { ParsedExcelSheet } from "../import/excel";
import { renderMappingReviewPanel, renderWorksheetOption } from "./import-review";

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

describe("renderMappingReviewPanel", () => {
  it("renders mapping controls, validation, and raw preview", () => {
    const result = csvResult();
    const html = renderMappingReviewPanel(
      result,
      analyzeImportReadiness(result.rawRows, result.mapping, result.dateFormat)
    );

    expect(html).toContain('id="mapping-title"');
    expect(html).toContain('data-mapping-key="date"');
    expect(html).toContain('data-mapping-key="amount"');
    expect(html).toContain('id="mapping-date-format"');
    expect(html).toContain('id="apply-mapping"');
    expect(html).toContain("2/2 rows ready");
    expect(html).toContain('class="table-wrap mapping-preview"');
    expect(html).toContain("<td>Northstar Studio</td>");
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

function csvResult(): CsvImportResult {
  return {
    rawRows: [
      { Date: "2026-03-01", Amount: "3200", Counterparty: "Northstar Studio" },
      { Date: "2026-03-04", Amount: "-49", Counterparty: "Figma" }
    ],
    records: [],
    rejectedRows: [],
    mapping: {
      date: "Date",
      amount: "Amount",
      counterparty: "Counterparty"
    },
    dateFormat: "ymd"
  };
}
