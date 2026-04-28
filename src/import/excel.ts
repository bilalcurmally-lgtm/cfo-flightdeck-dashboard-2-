import readXlsxFile, { readSheet } from "read-excel-file/browser";
import type { ImportedRow } from "../finance/types";

type ExcelInput = ArrayBuffer | File | Blob;

export interface ParsedExcelSheet {
  name: string;
  rows: ImportedRow[];
  rawRowCount: number;
}

export async function parseExcel(input: ExcelInput): Promise<ImportedRow[]> {
  const rows = await readSheet(input);
  return excelRowsToImportedRows(rows);
}

export async function parseExcelWorkbook(input: ExcelInput): Promise<ParsedExcelSheet[]> {
  const sheets = await readXlsxFile(input);
  return sheets.map((sheet, index) => ({
    name: sheet.sheet || `Sheet ${index + 1}`,
    rows: excelRowsToImportedRows(sheet.data),
    rawRowCount: sheet.data.length
  }));
}

export function excelRowsToImportedRows(rows: unknown[][]): ImportedRow[] {
  const headerIndex = rows.findIndex((row) =>
    row.some((value) => String(value ?? "").trim() !== "")
  );
  if (headerIndex < 0) return [];

  const headers = rows[headerIndex].map((value, index) => {
    const header = String(value ?? "").trim();
    return header || `column_${index + 1}`;
  });

  return rows
    .slice(headerIndex + 1)
    .filter((row) => row.some((value) => String(value ?? "").trim() !== ""))
    .map((row) =>
      Object.fromEntries(
        headers.map((header, index) => [header, normalizeCell(row[index])])
      )
    );
}

function normalizeCell(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (value === null || value === undefined) return "";
  return String(value).trim();
}
