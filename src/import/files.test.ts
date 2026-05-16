import { describe, expect, it } from "vitest";
import { classifyImportFile } from "./files";

describe("classifyImportFile", () => {
  it("classifies modern xlsx workbooks by extension or MIME type", () => {
    expect(classifyImportFile({ name: "bank-export.xlsx" })).toBe("xlsx");
    expect(
      classifyImportFile({
        name: "download",
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      })
    ).toBe("xlsx");
  });

  it("rejects legacy xls workbooks with a clear conversion path", () => {
    expect(() => classifyImportFile({ name: "bank-export.xls" })).toThrow(
      "Legacy .xls workbooks are not supported yet. Save the file as .xlsx or CSV and try again."
    );
    expect(() =>
      classifyImportFile({ name: "download", type: "application/vnd.ms-excel" })
    ).toThrow("Legacy .xls workbooks are not supported yet.");
  });

  it("keeps csv and unknown text-like files on the csv import path", () => {
    expect(classifyImportFile({ name: "transactions.csv", type: "text/csv" })).toBe("csv");
    expect(classifyImportFile({ name: "export.txt", type: "text/plain" })).toBe("csv");
  });
});
