import { describe, expect, it } from "vitest";
import { excelRowsToImportedRows, type ParsedExcelSheet } from "./excel";

describe("excelRowsToImportedRows", () => {
  it("turns worksheet rows into imported rows", () => {
    const rows = excelRowsToImportedRows([
      ["", ""],
      ["Date", "Amount", "Description"],
      [new Date("2026-03-01T00:00:00Z"), 1200, "Invoice"],
      ["2026-03-02", -40, "Tools"]
    ]);

    expect(rows).toEqual([
      { Date: "2026-03-01", Amount: "1200", Description: "Invoice" },
      { Date: "2026-03-02", Amount: "-40", Description: "Tools" }
    ]);
  });

  it("uses fallback headers and skips blank body rows", () => {
    expect(
      excelRowsToImportedRows([
        ["Date", ""],
        ["2026-03-01", 100],
        ["", ""]
      ])
    ).toEqual([{ Date: "2026-03-01", column_2: "100" }]);
  });

  it("preserves duplicate worksheet columns instead of overwriting values", () => {
    expect(
      excelRowsToImportedRows([
        ["Date", "Amount", "Amount"],
        ["2026-03-01", 100, 200]
      ])
    ).toEqual([{ Date: "2026-03-01", Amount: "100", Amount_2: "200" }]);
  });

  it("keeps parsed sheet metadata available for workbook selection", () => {
    const sheets: ParsedExcelSheet[] = [
      {
        name: "Operating",
        rows: excelRowsToImportedRows([
          ["Date", "Amount"],
          ["2026-03-01", 100]
        ]),
        rawRowCount: 2
      }
    ];

    expect(sheets[0]).toEqual({
      name: "Operating",
      rows: [{ Date: "2026-03-01", Amount: "100" }],
      rawRowCount: 2
    });
  });
});
