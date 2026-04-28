import { parseAmount } from "../finance/amount";
import { parseDate } from "../finance/date";
import type { DateFormat, ImportedRow, ImportMapping } from "../finance/types";

const OPTIONAL_MAPPING_KEYS = [
  "type",
  "account",
  "runningBalance",
  "head",
  "parent",
  "subcategory",
  "counterparty",
  "description"
] as const;

export interface ImportReadiness {
  rawRows: number;
  acceptedRows: number;
  rejectedRows: number;
  missingRequiredColumns: string[];
  invalidDateRows: number;
  invalidAmountRows: number;
  optionalCoverage: Array<{
    key: (typeof OPTIONAL_MAPPING_KEYS)[number];
    column: string;
    filledRows: number;
  }>;
}

export function analyzeImportReadiness(
  rows: ImportedRow[],
  mapping: ImportMapping,
  dateFormat: DateFormat
): ImportReadiness {
  const missingRequiredColumns = [
    ...(!mapping.date ? ["date"] : []),
    ...(!mapping.amount ? ["amount"] : [])
  ];
  let acceptedRows = 0;
  let invalidDateRows = 0;
  let invalidAmountRows = 0;

  for (const row of rows) {
    const hasValidDate = mapping.date ? Boolean(parseDate(row[mapping.date], dateFormat)) : false;
    const hasValidAmount = mapping.amount ? parseAmount(row[mapping.amount]) !== null : false;

    if (!hasValidDate) invalidDateRows += 1;
    if (!hasValidAmount) invalidAmountRows += 1;
    if (hasValidDate && hasValidAmount) acceptedRows += 1;
  }

  return {
    rawRows: rows.length,
    acceptedRows,
    rejectedRows: rows.length - acceptedRows,
    missingRequiredColumns,
    invalidDateRows,
    invalidAmountRows,
    optionalCoverage: OPTIONAL_MAPPING_KEYS.flatMap((key) => {
      const column = mapping[key];
      if (!column) return [];

      return [
        {
          key,
          column,
          filledRows: rows.filter((row) => String(row[column] || "").trim() !== "").length
        }
      ];
    })
  };
}
