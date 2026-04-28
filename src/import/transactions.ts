import { parseAmount } from "../finance/amount";
import { detectDateFormat, parseDate } from "../finance/date";
import type { CsvImportResult, DateFormat, ImportMapping, ImportedRow } from "../finance/types";
import { parseCsv } from "./csv";
import { mapRowToRecord, matchColumn } from "./map";

const DEFAULT_REVENUE_TOKENS = ["revenue", "income", "inflow", "credit", "sale", "sales"];
const DEFAULT_OUTFLOW_TOKENS = [
  "outflow",
  "expense",
  "payment",
  "debit",
  "cost",
  "withdrawal",
  "purchase"
];

export function detectImportMapping(rows: ImportedRow[]): ImportMapping {
  const columns = Object.keys(rows[0] || {});
  const lowerColumns = columns.map((column) => column.toLowerCase());

  return {
    date: matchColumn(columns, lowerColumns, [
      "date",
      "transaction date",
      "posting date",
      "posted date",
      "value date"
    ]),
    amount: matchColumn(columns, lowerColumns, [
      "amount",
      "net amount",
      "value",
      "transaction amount",
      "paid",
      "received"
    ]),
    type: matchColumn(columns, lowerColumns, ["type", "flow", "direction", "transaction type"]),
    head: matchColumn(columns, lowerColumns, [
      "head",
      "category",
      "account head",
      "ledger"
    ]),
    parent: matchColumn(columns, lowerColumns, [
      "parent",
      "group",
      "category group",
      "class"
    ]),
    subcategory: matchColumn(columns, lowerColumns, [
      "subcategory",
      "sub category",
      "sub-category",
      "detail category"
    ]),
    description: matchColumn(columns, lowerColumns, [
      "description",
      "memo",
      "details",
      "narration"
    ]),
    counterparty: matchColumn(columns, lowerColumns, [
      "vendor",
      "payee",
      "customer",
      "client",
      "merchant",
      "counterparty"
    ]),
    account: matchColumn(columns, lowerColumns, [
      "account",
      "bank account",
      "account name",
      "source account",
      "wallet"
    ]),
    runningBalance: matchColumn(columns, lowerColumns, [
      "balance",
      "running balance",
      "available balance",
      "account balance"
    ])
  };
}

export function importTransactionsFromCsv(
  csvText: string,
  options: {
    mapping?: Partial<ImportMapping>;
    dateFormat?: DateFormat;
    revenueTokens?: string[];
    outflowTokens?: string[];
  } = {}
): CsvImportResult {
  return importTransactionsFromRows(parseCsv(csvText), options);
}

export function importTransactionsFromRows(
  rawRows: ImportedRow[],
  options: {
    mapping?: Partial<ImportMapping>;
    dateFormat?: DateFormat;
    revenueTokens?: string[];
    outflowTokens?: string[];
  } = {}
): CsvImportResult {
  const detectedMapping = detectImportMapping(rawRows);
  const mapping = { ...detectedMapping, ...options.mapping };
  const dateFormat = options.dateFormat ?? detectDateFormat(rawRows, mapping.date);
  const revenueTokens = options.revenueTokens ?? DEFAULT_REVENUE_TOKENS;
  const outflowTokens = options.outflowTokens ?? DEFAULT_OUTFLOW_TOKENS;

  const records = [];
  const rejectedRows = [];

  for (const [index, row] of rawRows.entries()) {
    const issueReason = validateImportRow(row, mapping, dateFormat);
    if (issueReason) {
      rejectedRows.push({ rowNumber: index + 2, reason: issueReason, row });
      continue;
    }

    const record = mapRowToRecord(row, index, mapping, revenueTokens, outflowTokens, dateFormat);
    if (record) records.push(record);
    else rejectedRows.push({ rowNumber: index + 2, reason: "Could not map row", row });
  }

  return {
    rawRows,
    records,
    rejectedRows,
    mapping,
    dateFormat
  };
}

function validateImportRow(
  row: ImportedRow,
  mapping: ImportMapping,
  dateFormat: DateFormat
): string | null {
  if (!mapping.date) return "No date column detected";
  if (!mapping.amount) return "No amount column detected";
  if (!parseDate(row[mapping.date], dateFormat)) return "Invalid date";
  if (parseAmount(row[mapping.amount]) === null) return "Invalid amount";
  return null;
}
