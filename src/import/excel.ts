import readXlsxFile, { readSheet } from "read-excel-file/browser";
import { parseAmount } from "../finance/amount";
import type { ImportedRow } from "../finance/types";
import { normalizeImportedHeaders } from "./headers";

type ExcelInput = ArrayBuffer | File | Blob;

const HEADER_TOKENS = [
  "date",
  "amount",
  "debit",
  "credit",
  "description",
  "memo",
  "narration",
  "account",
  "balance",
  "category",
  "head",
  "vendor",
  "customer",
  "client"
];

export interface ParsedExcelSheet {
  name: string;
  rows: ImportedRow[];
  rawRowCount: number;
}

export interface CombinedExcelSheets {
  rows: ImportedRow[];
  includedSheets: string[];
  skippedSheets: Array<{
    name: string;
    reason: string;
  }>;
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
  const headerIndex = findHeaderRowIndex(rows);
  if (headerIndex < 0) return [];

  const headers = normalizeImportedHeaders(rows[headerIndex]);
  const bodyRows = rows
    .slice(headerIndex + 1)
    .filter((row) => row.some((value) => String(value ?? "").trim() !== ""));

  const groupedRows = expandGroupedAmountRows(rows[headerIndex - 1], headers, bodyRows);
  if (groupedRows) return groupedRows;

  return bodyRows.map((row) =>
    Object.fromEntries(
      headers.map((header, index) => [header, normalizeCell(row[index], header)])
    )
  );
}

export function combineCompatibleExcelSheets(
  sheets: ParsedExcelSheet[],
  sourceColumn = "Worksheet"
): CombinedExcelSheets {
  const firstDataSheet = sheets.find(isTransactionLikeSheet);
  if (!firstDataSheet) {
    return {
      rows: [],
      includedSheets: [],
      skippedSheets: sheets.map((sheet) => ({ name: sheet.name, reason: sheetSkipReason(sheet) }))
    };
  }

  const expectedHeaders = Object.keys(firstDataSheet.rows[0]);
  const worksheetColumn = uniqueColumnName(sourceColumn, expectedHeaders);
  const rows: ImportedRow[] = [];
  const includedSheets: string[] = [];
  const skippedSheets: CombinedExcelSheets["skippedSheets"] = [];

  for (const sheet of sheets) {
    if (!sheet.rows.length) {
      skippedSheets.push({
        name: sheet.name,
        reason: sheetSkipReason(sheet)
      });
      continue;
    }

    if (!isTransactionLikeSheet(sheet)) {
      skippedSheets.push({
        name: sheet.name,
        reason: sheetSkipReason(sheet)
      });
      continue;
    }

    const headers = Object.keys(sheet.rows[0]);
    if (!sameHeaders(headers, expectedHeaders)) {
      skippedSheets.push({
        name: sheet.name,
        reason: `Headers do not match ${firstDataSheet.name}`
      });
      continue;
    }

    includedSheets.push(sheet.name);
    rows.push(...sheet.rows.map((row) => ({ ...row, [worksheetColumn]: sheet.name })));
  }

  return {
    rows,
    includedSheets,
    skippedSheets
  };
}

function findHeaderRowIndex(rows: unknown[][]): number {
  let firstNonEmptyIndex = -1;
  let bestHeaderIndex = -1;
  let bestHeaderScore = 0;

  rows.forEach((row, index) => {
    const values = row.map((value) => String(value ?? "").trim()).filter(Boolean);
    if (!values.length) return;
    if (firstNonEmptyIndex < 0) firstNonEmptyIndex = index;

    const score = values.filter((value) => {
      const normalized = value.toLowerCase();
      return HEADER_TOKENS.some((token) => normalized === token || normalized.includes(token));
    }).length;

    if (score > bestHeaderScore) {
      bestHeaderScore = score;
      bestHeaderIndex = index;
    }
  });

  return bestHeaderScore > 0 ? bestHeaderIndex : firstNonEmptyIndex;
}

function normalizeCell(value: unknown, header = ""): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (isDateLikeHeader(header) && typeof value === "number") {
    const date = excelSerialDateToIso(value);
    if (date) return date;
  }
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function expandGroupedAmountRows(
  parentHeaderRow: unknown[] | undefined,
  headers: string[],
  bodyRows: unknown[][]
): ImportedRow[] | null {
  if (!parentHeaderRow || hasExplicitAmountHeaders(headers)) return null;

  const dateIndex = headers.findIndex(isDateLikeHeader);
  if (dateIndex < 0) return null;

  const parentHeaders = fillForward(parentHeaderRow.map((value) => String(value ?? "").trim()));
  const metadataIndexes = headers
    .map((header, index) => ({ header, index }))
    .filter(({ header }) => isGroupedMetadataHeader(header))
    .map(({ index }) => index);
  const amountIndexes = headers
    .map((header, index) => ({ header, index }))
    .filter(({ index }) => !metadataIndexes.includes(index) && parentHeaders[index])
    .map(({ index }) => index);

  if (!amountIndexes.length) return null;
  if (!amountIndexes.some((index) => String(parentHeaderRow[index] ?? "").trim())) return null;

  const expandedRows: ImportedRow[] = [];
  for (const row of bodyRows) {
    for (const amountIndex of amountIndexes) {
      const amount = normalizeCell(row[amountIndex], headers[amountIndex]);
      if (parseAmount(amount) === null) continue;

      const importedRow = Object.fromEntries(
        metadataIndexes.map((index) => [headers[index], normalizeCell(row[index], headers[index])])
      );
      const parent = parentHeaders[amountIndex];
      expandedRows.push({
        ...importedRow,
        Flow: parent,
        "Parent Group": parent,
        Head: headers[amountIndex],
        Amount: amount
      });
    }
  }

  return expandedRows.length ? expandedRows : null;
}

function hasExplicitAmountHeaders(headers: string[]): boolean {
  return headers.some((header) => {
    const normalized = header.toLowerCase();
    return (
      normalized.includes("amount") ||
      normalized.includes("debit") ||
      normalized.includes("credit") ||
      normalized === "value"
    );
  });
}

function isGroupedMetadataHeader(header: string): boolean {
  const normalized = header.toLowerCase();
  return [
    "date",
    "description",
    "memo",
    "narration",
    "particulars",
    "account",
    "vendor",
    "customer",
    "client",
    "counterparty",
    "reference",
    "notes"
  ].some((token) => normalized === token || normalized.includes(token));
}

function fillForward(values: string[]): string[] {
  let last = "";
  return values.map((value) => {
    if (value) last = value;
    return last;
  });
}

function isDateLikeHeader(header: string): boolean {
  return header.trim().toLowerCase().includes("date");
}

function excelSerialDateToIso(value: number): string | null {
  if (!Number.isFinite(value) || value < 1 || value > 80000) return null;

  const wholeDays = Math.floor(value);
  const unixTime = (wholeDays - 25569) * 86400 * 1000;
  return new Date(unixTime).toISOString().slice(0, 10);
}

function sameHeaders(headers: string[], expectedHeaders: string[]): boolean {
  if (headers.length !== expectedHeaders.length) return false;
  const normalizedHeaders = headers.map(normalizeHeaderForComparison).sort();
  const normalizedExpectedHeaders = expectedHeaders.map(normalizeHeaderForComparison).sort();
  return normalizedHeaders.every((header, index) => header === normalizedExpectedHeaders[index]);
}

function normalizeHeaderForComparison(header: string): string {
  return header.trim().toLowerCase();
}

function isTransactionLikeSheet(sheet: ParsedExcelSheet): boolean {
  if (!sheet.rows.length) return false;
  const headers = Object.keys(sheet.rows[0]).map((header) => header.toLowerCase());
  const hasDate = headers.some((header) => header === "date" || header.includes("date"));
  const hasSingleAmount = headers.some((header) => header === "amount" || header.includes("amount"));
  const hasDebitOrCredit = headers.some((header) => header.includes("debit") || header.includes("credit"));
  return hasDate && (hasSingleAmount || hasDebitOrCredit);
}

function sheetSkipReason(sheet: ParsedExcelSheet): string {
  if (!sheet.rows.length) return "No imported rows";
  return "No date and amount/debit/credit columns detected";
}

function uniqueColumnName(baseName: string, existingColumns: string[]): string {
  if (!existingColumns.includes(baseName)) return baseName;

  let index = 2;
  while (existingColumns.includes(`${baseName}_${index}`)) index += 1;
  return `${baseName}_${index}`;
}
