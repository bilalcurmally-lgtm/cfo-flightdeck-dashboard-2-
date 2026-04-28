import { readSheet } from "read-excel-file/browser";
import type { ImportedRow } from "../finance/types";

type ExcelInput = ArrayBuffer | File | Blob;

export async function parseExcel(input: ExcelInput): Promise<ImportedRow[]> {
  const rows = await readSheet(input);
  return excelRowsToImportedRows(rows);
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
