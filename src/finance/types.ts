export type CashFlow = "revenue" | "outflow";

export type DateFormat = "dmy" | "mdy" | "ymd";

export type PeriodGrain = "daily" | "weekly" | "monthly";

export interface ImportedRow {
  [column: string]: string;
}

export interface ImportMapping {
  date: string;
  amount: string;
  type?: string;
  head?: string;
  parent?: string;
  subcategory?: string;
  description?: string;
  counterparty?: string;
  account?: string;
  runningBalance?: string;
}

export interface TransactionRecord {
  id: string;
  date: Date;
  dateISO: string;
  periodDaily: string;
  periodWeekly: string;
  periodMonthly: string;
  head: string;
  parent: string;
  subcategory: string;
  description: string;
  counterparty: string;
  account: string;
  flow: CashFlow;
  amount: number;
  signedNet: number;
  runningBalance: number | null;
}

export interface ImportIssue {
  rowNumber: number;
  reason: string;
  row: ImportedRow;
}

export interface CsvImportResult {
  rawRows: ImportedRow[];
  records: TransactionRecord[];
  rejectedRows: ImportIssue[];
  mapping: ImportMapping;
  dateFormat: DateFormat;
}
