// src/finance/non-operating.ts
import type { RowRef } from "./audit";
import type { TransactionRecord } from "./types";

export interface NonOperatingSummary {
  total: number;       // signed sum
  revenueIn: number;   // sum amount of revenue rows
  outflowOut: number;  // sum amount of outflow rows
  rows: RowRef[];
}

export function summarizeNonOperating(records: TransactionRecord[]): NonOperatingSummary {
  let total = 0, revenueIn = 0, outflowOut = 0;
  const rows: RowRef[] = [];
  for (const r of records) {
    total += r.signedNet;
    if (r.flow === "revenue") revenueIn += r.amount; else outflowOut += r.amount;
    rows.push({ id: r.id, dateISO: r.dateISO, amount: r.amount, head: r.head, flow: r.flow });
  }
  return { total, revenueIn, outflowOut, rows };
}
