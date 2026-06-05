import type { TransactionRecord } from "../finance/types";
import { immutableTxnKey, txnSignature } from "./txn-signature";

export interface SignedRow {
  id: string;
  signature: string;
}

export function signLedger(records: readonly TransactionRecord[]): SignedRow[] {
  const occurrenceCounts = new Map<string, number>();
  const signed: SignedRow[] = [];

  for (const record of records) {
    const key = immutableTxnKey(record);
    const occurrenceIndex = occurrenceCounts.get(key) ?? 0;
    occurrenceCounts.set(key, occurrenceIndex + 1);
    signed.push({
      id: record.id,
      signature: txnSignature(record, occurrenceIndex),
    });
  }

  return signed;
}