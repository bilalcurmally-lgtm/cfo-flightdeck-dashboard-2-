import type { TransactionRecord } from "../finance/types";
import { exportDateStamp, safeExportStem } from "./filenames";
import { makeWorkbookBlob, type WorkbookCellValue } from "./xlsx-workbook";

const TRANSACTION_WORKBOOK_HEADERS = [
  "Date",
  "Source Sheet",
  "Flow",
  "Account",
  "Head",
  "Parent",
  "Subcategory",
  "Description",
  "Counterparty",
  "Amount",
  "Signed Net",
  "Running Balance"
] satisfies WorkbookCellValue[];

export function buildTransactionsWorkbook(records: TransactionRecord[]): Blob {
  return makeWorkbookBlob([
    {
      name: "Transactions",
      rows: [TRANSACTION_WORKBOOK_HEADERS, ...records.map(transactionWorkbookRow)]
    }
  ]);
}

export function transactionsWorkbookFilename(sourceName: string, generatedAt = new Date()): string {
  return `${safeExportStem(sourceName)}-normalized-transactions-${exportDateStamp(generatedAt)}.xlsx`;
}

function transactionWorkbookRow(record: TransactionRecord): WorkbookCellValue[] {
  return [
    record.dateISO,
    record.sourceSheet ?? "",
    record.flow,
    record.account,
    record.head,
    record.parent,
    record.subcategory,
    record.description,
    record.counterparty,
    record.amount,
    record.signedNet,
    record.runningBalance ?? ""
  ];
}
