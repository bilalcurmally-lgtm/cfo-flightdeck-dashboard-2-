import type { CsvImportResult, DateFormat, ImportedRow, ImportMapping } from "../finance/types";
import { importTransactionsFromCsv, importTransactionsFromRows } from "../import/transactions";
import { analyzeImportReadiness } from "../import/validation";
import { renderMappingValidation } from "./import-review";
import { readReviewedDateFormat, readReviewedMapping } from "./import-review-form";

export type ImportReviewSource = string | ImportedRow[];

export interface DraftImportReview {
  result: CsvImportResult;
  sourceName: string;
  source: ImportReviewSource;
}

export interface ImportReviewActionRoot {
  querySelectorAll<T extends Element = Element>(selector: string): Iterable<T> | ArrayLike<T>;
  querySelector<T extends Element = Element>(selector: string): T | null;
}

export interface ImportReviewActionBindings {
  root?: ImportReviewActionRoot;
  getDraftImport: () => DraftImportReview | null;
  renderImportResult: (result: CsvImportResult, sourceName: string) => void;
  readMapping?: (root?: ImportReviewActionRoot) => ImportMapping;
  readDateFormat?: (root?: ImportReviewActionRoot) => DateFormat;
}

export function bindImportReviewActions({
  root = document,
  getDraftImport,
  renderImportResult,
  readMapping = readReviewedMapping,
  readDateFormat = readReviewedDateFormat
}: ImportReviewActionBindings): void {
  const refreshValidation = () => {
    const draftImport = getDraftImport();
    if (!draftImport) return;

    const validation = root.querySelector<HTMLElement>("#mapping-validation");
    const applyButton = root.querySelector<HTMLButtonElement>("#apply-mapping");
    const readiness = analyzeImportReadiness(
      draftImport.result.rawRows,
      readMapping(root),
      readDateFormat(root)
    );
    if (validation) validation.innerHTML = renderMappingValidation(readiness);
    if (applyButton) {
      applyButton.disabled =
        Boolean(readiness.missingRequiredColumns.length) || readiness.acceptedRows === 0;
    }
  };

  Array.from(root.querySelectorAll<HTMLSelectElement>("[data-mapping-key], #mapping-date-format")).forEach(
    (select) => {
      select.addEventListener("change", refreshValidation);
    }
  );
  refreshValidation();

  root.querySelector<HTMLButtonElement>("#apply-mapping")?.addEventListener("click", () => {
    const draftImport = getDraftImport();
    if (!draftImport) return;

    const mapping = readMapping(root);
    const dateFormat = readDateFormat(root);
    const result =
      typeof draftImport.source === "string"
        ? importTransactionsFromCsv(draftImport.source, { mapping, dateFormat })
        : importTransactionsFromRows(draftImport.source, { mapping, dateFormat });
    renderImportResult(result, draftImport.sourceName);
  });
}
