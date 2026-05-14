import { combineCompatibleExcelSheets, type ParsedExcelSheet } from "../import/excel";
import { importTransactionsFromRows } from "../import/transactions";
import type { ImportReviewSource } from "./import-review-actions";

export interface WorksheetPickerActionRoot {
  querySelectorAll<T extends Element = Element>(selector: string): Iterable<T> | ArrayLike<T>;
  querySelector?<T extends Element = Element>(selector: string): T | null;
}

export interface WorksheetPickerActionBindings {
  root?: WorksheetPickerActionRoot;
  sourceName: string;
  sheets: ParsedExcelSheet[];
  renderMappingReview: (
    result: ReturnType<typeof importTransactionsFromRows>,
    sourceName: string,
    source: ImportReviewSource
  ) => void;
}

export function bindWorksheetPickerActions({
  root = document,
  sourceName,
  sheets,
  renderMappingReview
}: WorksheetPickerActionBindings): void {
  root.querySelector?.<HTMLButtonElement>("[data-combine-compatible-sheets]")?.addEventListener("click", () => {
    const combined = combineCompatibleExcelSheets(sheets);
    if (!combined.rows.length) return;

    renderMappingReview(
      importTransactionsFromRows(combined.rows),
      `${sourceName} / ${combined.includedSheets.length} combined sheet${
        combined.includedSheets.length === 1 ? "" : "s"
      }`,
      combined.rows
    );
  });

  Array.from(root.querySelectorAll<HTMLButtonElement>("[data-sheet-index]")).forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.sheetIndex);
      const sheet = sheets[index];
      if (!sheet) return;
      renderMappingReview(importTransactionsFromRows(sheet.rows), `${sourceName} / ${sheet.name}`, sheet.rows);
    });
  });
}
