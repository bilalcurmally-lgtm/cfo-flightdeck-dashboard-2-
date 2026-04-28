import { parseAmount, classifyFlow } from "../finance/amount";
import { parseDate, startOfWeek, toIsoDate } from "../finance/date";
import type { DateFormat, ImportMapping, ImportedRow, TransactionRecord } from "../finance/types";

const UNASSIGNED_HEAD = "Unassigned Head";
const UNASSIGNED_GROUP = "Unassigned Group";
const UNASSIGNED_SUBCATEGORY = "Unassigned Subcategory";
const UNASSIGNED_DESCRIPTION = "Unassigned";
const UNASSIGNED_COUNTERPARTY = "Unassigned Counterparty";
const UNASSIGNED_ACCOUNT = "Unassigned Account";

export function matchColumn(
  columns: string[],
  lowerColumns: string[],
  candidates: string[]
): string {
  const exactIndex = lowerColumns.findIndex((column) => candidates.includes(column));
  if (exactIndex >= 0) return columns[exactIndex];

  const containsIndex = lowerColumns.findIndex((column) =>
    candidates.some((candidate) => column.includes(candidate))
  );

  return containsIndex >= 0 ? columns[containsIndex] : "";
}

export function mapRowToRecord(
  row: ImportedRow,
  index: number,
  mapping: ImportMapping,
  revenueTokens: string[],
  outflowTokens: string[],
  dateFormat: DateFormat
): TransactionRecord | null {
  const date = parseDate(row[mapping.date], dateFormat);
  const amountRaw = parseAmount(row[mapping.amount]);
  if (!date || amountRaw === null) return null;

  const typeValue = mapping.type ? String(row[mapping.type] || "").trim().toLowerCase() : "";
  const flow = classifyFlow(typeValue, amountRaw, revenueTokens, outflowTokens);
  const amount = Math.abs(amountRaw);
  const head = (mapping.head ? String(row[mapping.head] || "").trim() : "") || UNASSIGNED_HEAD;
  const parent =
    (mapping.parent ? String(row[mapping.parent] || "").trim() : "") || UNASSIGNED_GROUP;
  const subcategory =
    (mapping.subcategory ? String(row[mapping.subcategory] || "").trim() : "") ||
    UNASSIGNED_SUBCATEGORY;
  const description =
    (mapping.description ? String(row[mapping.description] || "").trim() : "") ||
    UNASSIGNED_DESCRIPTION;
  const counterparty =
    (mapping.counterparty ? String(row[mapping.counterparty] || "").trim() : "") ||
    UNASSIGNED_COUNTERPARTY;
  const account =
    (mapping.account ? String(row[mapping.account] || "").trim() : "") || UNASSIGNED_ACCOUNT;
  const signedNet = flow === "revenue" ? amount : -amount;
  const runningBalance = mapping.runningBalance ? parseAmount(row[mapping.runningBalance]) : null;

  return {
    id: `${date.toISOString()}-${index}`,
    date,
    dateISO: toIsoDate(date),
    periodDaily: toIsoDate(date),
    periodWeekly: toIsoDate(startOfWeek(date)),
    periodMonthly: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
    head,
    parent,
    subcategory,
    description,
    counterparty,
    account,
    flow,
    amount,
    signedNet,
    runningBalance
  };
}
