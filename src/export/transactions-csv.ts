import type { TransactionRecord } from "../finance/types";
import { exportDateStamp, safeExportStem } from "./filenames";

export function buildTransactionsCsv(records: TransactionRecord[]): string {
  const header = [
    "date",
    "flow",
    "account",
    "head",
    "parent",
    "subcategory",
    "description",
    "counterparty",
    "amount",
    "signedNet",
    "runningBalance"
  ];
  const lines = records.map((record) =>
    [
      record.dateISO,
      record.flow,
      csvEscape(record.account),
      csvEscape(record.head),
      csvEscape(record.parent),
      csvEscape(record.subcategory),
      csvEscape(record.description),
      csvEscape(record.counterparty),
      record.amount,
      record.signedNet,
      record.runningBalance ?? ""
    ].join(",")
  );

  return [header.join(","), ...lines].join("\n");
}

export function transactionsCsvFilename(sourceName: string, generatedAt = new Date()): string {
  return `${safeExportStem(sourceName)}-normalized-transactions-${exportDateStamp(generatedAt)}.csv`;
}

function csvEscape(value: string): string {
  if (!/[",\n\r]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}
