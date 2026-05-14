import { describe, expect, it } from "vitest";
import type { CsvImportResult } from "../finance/types";
import type { ParsedExcelSheet } from "../import/excel";
import { bindWorksheetPickerActions, type WorksheetPickerActionRoot } from "./worksheet-picker-actions";

describe("bindWorksheetPickerActions", () => {
  it("renders mapping review for the selected worksheet", () => {
    const buttons = [button("1")];
    const rendered: Array<{ result: CsvImportResult; sourceName: string; rowCount: number }> = [];

    bindWorksheetPickerActions({
      root: root(buttons),
      sourceName: "Workbook.xlsx",
      sheets: [
        sheet("Summary", []),
        sheet("Operating", [{ Date: "2026-05-04", Amount: "100", Head: "Client" }])
      ],
      renderMappingReview: (result, sourceName, source) => {
        rendered.push({
          result,
          sourceName,
          rowCount: Array.isArray(source) ? source.length : 0
        });
      }
    });

    buttons[0].fire("click");

    expect(rendered).toHaveLength(1);
    expect(rendered[0].sourceName).toBe("Workbook.xlsx / Operating");
    expect(rendered[0].result.records).toHaveLength(1);
    expect(rendered[0].rowCount).toBe(1);
  });

  it("ignores stale worksheet indexes", () => {
    const buttons = [button("5")];
    const rendered: string[] = [];

    bindWorksheetPickerActions({
      root: root(buttons),
      sourceName: "Workbook.xlsx",
      sheets: [sheet("Operating", [{ Date: "2026-05-04", Amount: "100" }])],
      renderMappingReview: (_result, sourceName) => {
        rendered.push(sourceName);
      }
    });

    buttons[0].fire("click");
    expect(rendered).toEqual([]);
  });

  it("renders mapping review for compatible sheets combined into one import", () => {
    const buttons = [button("0")];
    const combineButton = button("");
    const rendered: Array<{ sourceName: string; rowCount: number; rawRows: CsvImportResult["rawRows"] }> = [];

    bindWorksheetPickerActions({
      root: root(buttons, combineButton),
      sourceName: "Workbook.xlsx",
      sheets: [
        sheet("Jan 2026", [{ Date: "2026-01-01", Amount: "100" }]),
        sheet("Feb 2026", [{ Date: "2026-02-01", Amount: "250" }])
      ],
      renderMappingReview: (result, sourceName, source) => {
        rendered.push({
          sourceName,
          rowCount: Array.isArray(source) ? source.length : 0,
          rawRows: result.rawRows
        });
      }
    });

    combineButton.fire("click");

    expect(rendered).toEqual([
      {
        sourceName: "Workbook.xlsx / 2 combined sheets",
        rowCount: 2,
        rawRows: [
          { Date: "2026-01-01", Amount: "100", Worksheet: "Jan 2026" },
          { Date: "2026-02-01", Amount: "250", Worksheet: "Feb 2026" }
        ]
      }
    ]);
  });
});

function root(buttons: FakeButton[], combineButton?: FakeButton): WorksheetPickerActionRoot {
  return {
    querySelectorAll: (selector: string) => (selector === "[data-sheet-index]" ? buttons : []),
    querySelector: (selector: string) =>
      selector === "[data-combine-compatible-sheets]" ? combineButton ?? null : null
  } as unknown as WorksheetPickerActionRoot;
}

interface FakeButton {
  dataset: { sheetIndex: string };
  addEventListener: (event: string, listener: () => void) => void;
  fire: (event: string) => void;
}

function button(sheetIndex: string): FakeButton {
  const listeners = new Map<string, () => void>();
  return {
    dataset: { sheetIndex },
    addEventListener: (event, listener) => {
      listeners.set(event, listener);
    },
    fire: (event) => {
      listeners.get(event)?.();
    }
  };
}

function sheet(name: string, rows: ParsedExcelSheet["rows"]): ParsedExcelSheet {
  return {
    name,
    rows,
    rawRowCount: rows.length + 1
  };
}
