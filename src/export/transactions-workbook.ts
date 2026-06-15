import type { TransactionRecord } from "../finance/types";
import { exportDateStamp, safeExportStem } from "./filenames";
import { LEDGER_WORKBOOK_HEADERS, ledgerWorkbookRow } from "./ledger-workbook-row";
import { makeWorkbookBlob } from "./xlsx-workbook";

export function buildTransactionsWorkbook(records: TransactionRecord[]): Blob {
  return makeWorkbookBlob([
    {
      name: "Transactions",
      rows: [LEDGER_WORKBOOK_HEADERS, ...records.map(ledgerWorkbookRow)]
    }
  ]);
}

export function transactionsWorkbookFilename(sourceName: string, generatedAt = new Date()): string {
  return `${safeExportStem(sourceName)}-normalized-transactions-${exportDateStamp(generatedAt)}.xlsx`;
}
