import type { TransactionRecord } from "../finance/types";
import type { WorkbookCellValue } from "./xlsx-workbook";

export const LEDGER_WORKBOOK_HEADERS = [
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

export function ledgerWorkbookRow(record: TransactionRecord): WorkbookCellValue[] {
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