import type { TransactionRecord } from "./types";

export interface DuplicateGroup {
  key: string;
  records: TransactionRecord[];
}

export interface TransferCandidate {
  dateISO: string;
  amount: number;
  fromAccount: string;
  toAccount: string;
  outflowId: string;
  revenueId: string;
}

export interface ImportDiagnostics {
  duplicateGroups: DuplicateGroup[];
  transferCandidates: TransferCandidate[];
}

export function analyzeImportDiagnostics(records: TransactionRecord[]): ImportDiagnostics {
  return {
    duplicateGroups: findDuplicateGroups(records),
    transferCandidates: findTransferCandidates(records)
  };
}

function findDuplicateGroups(records: TransactionRecord[]): DuplicateGroup[] {
  const groups = new Map<string, TransactionRecord[]>();

  for (const record of records) {
    const key = [
      record.dateISO,
      record.account.toLowerCase(),
      record.flow,
      record.amount,
      record.head.toLowerCase(),
      record.description.toLowerCase()
    ].join("|");
    const group = groups.get(key) ?? [];
    group.push(record);
    groups.set(key, group);
  }

  return [...groups.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([key, group]) => ({ key, records: group }));
}

function findTransferCandidates(records: TransactionRecord[]): TransferCandidate[] {
  const outflows = records.filter((record) => record.flow === "outflow");
  const revenues = records.filter((record) => record.flow === "revenue");
  const usedRevenueIds = new Set<string>();
  const candidates: TransferCandidate[] = [];

  for (const outflow of outflows) {
    const match = revenues.find(
      (revenue) =>
        !usedRevenueIds.has(revenue.id) &&
        revenue.dateISO === outflow.dateISO &&
        revenue.amount === outflow.amount &&
        revenue.account !== outflow.account
    );

    if (!match) continue;

    usedRevenueIds.add(match.id);
    candidates.push({
      dateISO: outflow.dateISO,
      amount: outflow.amount,
      fromAccount: outflow.account,
      toAccount: match.account,
      outflowId: outflow.id,
      revenueId: match.id
    });
  }

  return candidates;
}
