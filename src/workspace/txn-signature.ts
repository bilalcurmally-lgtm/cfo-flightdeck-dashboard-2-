import type { TransactionRecord } from "../finance/types";

export type TxnSignatureInput = Pick<
  TransactionRecord,
  "dateISO" | "amount" | "description" | "account" | "sourceSheet"
>;

/** Immutable import identity without occurrenceIndex — used by signLedger for dedup keys. */
export function immutableTxnKey(record: TxnSignatureInput): string {
  return JSON.stringify({
    dateISO: record.dateISO,
    amount: record.amount,
    description: record.description,
    account: record.account,
    sourceSheet: record.sourceSheet ?? "",
  });
}

function canonicalPayload(record: TxnSignatureInput, occurrenceIndex: number): string {
  return JSON.stringify({
    dateISO: record.dateISO,
    amount: record.amount,
    description: record.description,
    account: record.account,
    sourceSheet: record.sourceSheet ?? "",
    occurrenceIndex,
  });
}

/** FNV-1a 32-bit — deterministic, no dependencies, sync-friendly for vitest/node. */
function fnv1a32(input: string, seed = 0x811c9dc5): number {
  let hash = seed >>> 0;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function hashPayload(payload: string): string {
  const primary = fnv1a32(payload);
  const secondary = fnv1a32(payload, primary ^ 0x9e3779b9);
  return `${primary.toString(16).padStart(8, "0")}${secondary.toString(16).padStart(8, "0")}`;
}

export function txnSignature(record: TxnSignatureInput, occurrenceIndex: number): string {
  return `txn_${hashPayload(canonicalPayload(record, occurrenceIndex))}`;
}