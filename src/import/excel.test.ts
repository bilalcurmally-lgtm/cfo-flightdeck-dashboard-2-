import { describe, expect, it } from "vitest";
import {
  combineCompatibleExcelSheets,
  excelRowsToImportedRows,
  type ParsedExcelSheet
} from "./excel";

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

  it("skips title rows and starts at the first finance-like header row", () => {
    expect(
      excelRowsToImportedRows([
        ["Monthly bank statement", "", ""],
        ["Generated for review", "", ""],
        ["Date", "Debit", "Credit", "Description"],
        ["2026-05-01", "1200", "", "Rent"],
        ["2026-05-02", "", "3000", "Client payment"]
      ])
    ).toEqual([
      { Date: "2026-05-01", Debit: "1200", Credit: "", Description: "Rent" },
      { Date: "2026-05-02", Debit: "", Credit: "3000", Description: "Client payment" }
    ]);
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

describe("combineCompatibleExcelSheets", () => {
  it("combines rows from sheets with matching headers and adds worksheet provenance", () => {
    const combined = combineCompatibleExcelSheets([
      sheet("Jan 2026", [
        { Date: "2026-01-01", Amount: "100" },
        { Date: "2026-01-02", Amount: "-25" }
      ]),
      sheet("Feb 2026", [{ Date: "2026-02-01", Amount: "250" }])
    ]);

    expect(combined.rows).toEqual([
      { Date: "2026-01-01", Amount: "100", Worksheet: "Jan 2026" },
      { Date: "2026-01-02", Amount: "-25", Worksheet: "Jan 2026" },
      { Date: "2026-02-01", Amount: "250", Worksheet: "Feb 2026" }
    ]);
    expect(combined.includedSheets).toEqual(["Jan 2026", "Feb 2026"]);
    expect(combined.skippedSheets).toEqual([]);
  });

  it("skips empty and incompatible sheets instead of mixing mismatched workbook layouts", () => {
    const combined = combineCompatibleExcelSheets([
      sheet("Jan 2026", [{ Date: "2026-01-01", Amount: "100" }]),
      sheet("Notes", []),
      sheet("Summary", [{ Category: "Revenue", Total: "100" }])
    ]);

    expect(combined.rows).toEqual([
      { Date: "2026-01-01", Amount: "100", Worksheet: "Jan 2026" }
    ]);
    expect(combined.includedSheets).toEqual(["Jan 2026"]);
    expect(combined.skippedSheets).toEqual([
      { name: "Notes", reason: "No imported rows" },
      { name: "Summary", reason: "No date and amount/debit/credit columns detected" }
    ]);
  });

  it("uses the first transaction-like sheet as the combine base when notes appear first", () => {
    const combined = combineCompatibleExcelSheets([
      sheet("Notes", [{ Topic: "Owner", Detail: "Reviewed by finance" }]),
      sheet("Jan 2026", [{ Date: "2026-01-01", Debit: "100", Credit: "" }]),
      sheet("Feb 2026", [{ Date: "2026-02-01", Debit: "", Credit: "250" }])
    ]);

    expect(combined.rows).toEqual([
      { Date: "2026-01-01", Debit: "100", Credit: "", Worksheet: "Jan 2026" },
      { Date: "2026-02-01", Debit: "", Credit: "250", Worksheet: "Feb 2026" }
    ]);
    expect(combined.includedSheets).toEqual(["Jan 2026", "Feb 2026"]);
    expect(combined.skippedSheets).toEqual([
      { name: "Notes", reason: "No date and amount/debit/credit columns detected" }
    ]);
  });

  it("combines compatible sheets even when the same headers appear in a different order", () => {
    const combined = combineCompatibleExcelSheets([
      sheet("Jan 2026", [{ Date: "2026-01-01", Amount: "100", Description: "Invoice" }]),
      sheet("Feb 2026", [{ Description: "Tools", Amount: "-25", Date: "2026-02-01" }])
    ]);

    expect(combined.rows).toEqual([
      { Date: "2026-01-01", Amount: "100", Description: "Invoice", Worksheet: "Jan 2026" },
      { Description: "Tools", Amount: "-25", Date: "2026-02-01", Worksheet: "Feb 2026" }
    ]);
    expect(combined.includedSheets).toEqual(["Jan 2026", "Feb 2026"]);
    expect(combined.skippedSheets).toEqual([]);
  });

  it("uses a unique worksheet source column when the workbook already has Worksheet", () => {
    const combined = combineCompatibleExcelSheets([
      sheet("Jan 2026", [{ Date: "2026-01-01", Amount: "100", Worksheet: "Office" }])
    ]);

    expect(combined.rows).toEqual([
      {
        Date: "2026-01-01",
        Amount: "100",
        Worksheet: "Office",
        Worksheet_2: "Jan 2026"
      }
    ]);
  });
});

function sheet(name: string, rows: ParsedExcelSheet["rows"]): ParsedExcelSheet {
  return {
    name,
    rows,
    rawRowCount: rows.length + 1
  };
}
