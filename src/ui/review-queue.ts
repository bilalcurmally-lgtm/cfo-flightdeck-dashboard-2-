import type { FinanceSummary } from "../finance/summary";
import type { ImportIssue } from "../finance/types";
import type { ReviewDrawerItem } from "./review-drawer";

export interface BuildReviewQueueInput {
  summary: FinanceSummary;
  rejectedRows: readonly ImportIssue[];
  excludedReviewItemIds: ReadonlySet<string>;
  formatMoney: (value: number) => string;
}

export function buildReviewDrawerItems({
  summary,
  rejectedRows,
  excludedReviewItemIds,
  formatMoney
}: BuildReviewQueueInput): ReviewDrawerItem[] {
  const items: ReviewDrawerItem[] = [];

  for (const group of summary.diagnostics.duplicateGroups) {
    const rowIds = group.records.slice(1).map((record) => record.id);
    items.push({
      id: `duplicate:${group.key}`,
      kind: "duplicate",
      title: "Possible duplicate",
      body: `${group.records.length} imported rows share the same date, account, flow, amount, head, and description. Review suggested before trusting totals.`,
      rowIds,
      confidence: "medium",
      excluded: excludedReviewItemIds.has(`duplicate:${group.key}`)
    });
  }

  for (const transfer of summary.diagnostics.transferCandidates) {
    const rowIds = [transfer.outflowId, transfer.revenueId];
    items.push({
      id: `transfer:${transfer.outflowId}:${transfer.revenueId}`,
      kind: "transfer",
      title: "Possible transfer",
      body: `${transfer.dateISO} ${formatMoney(transfer.amount)} appears to move from ${transfer.fromAccount} to ${transfer.toAccount}. Review suggested: internal transfers can inflate both revenue and outflow.`,
      rowIds,
      confidence: "medium",
      excluded: excludedReviewItemIds.has(`transfer:${transfer.outflowId}:${transfer.revenueId}`)
    });
  }

  if (rejectedRows.length > 0) {
    items.push({
      id: "rejected:rows",
      kind: "rejected",
      title: "Rejected import rows",
      body: `${rejectedRows.length} row${rejectedRows.length === 1 ? "" : "s"} could not be imported. Review the mapping panel before treating this file as complete.`,
      rowIds: [],
      confidence: "high",
      excluded: excludedReviewItemIds.has("rejected:rows")
    });
  }

  return items;
}

export function deriveExcludedTransactionIds(items: readonly ReviewDrawerItem[]): string[] {
  return [...new Set(items.filter((item) => item.excluded).flatMap((item) => item.rowIds))];
}

export function deriveExcludedTransactionIdsFromQueue(input: BuildReviewQueueInput): string[] {
  return deriveExcludedTransactionIds(buildReviewDrawerItems(input));
}
