import type { FinanceSummary } from "./summary";
import type { TransactionRecord } from "./types";

export type ReviewPreset = "all" | "revenue" | "outflow" | "duplicates" | "transfers";

export function isReviewPreset(value: string | undefined): value is ReviewPreset {
  return (
    value === "all" ||
    value === "revenue" ||
    value === "outflow" ||
    value === "duplicates" ||
    value === "transfers"
  );
}

export function applyReviewPreset(
  records: TransactionRecord[],
  summary: FinanceSummary,
  preset: ReviewPreset
): TransactionRecord[] {
  if (preset === "revenue") return records.filter((record) => record.flow === "revenue");
  if (preset === "outflow") return records.filter((record) => record.flow === "outflow");
  if (preset === "duplicates") {
    const duplicateIds = new Set(
      summary.diagnostics.duplicateGroups.flatMap((group) => group.records.map((record) => record.id))
    );
    return records.filter((record) => duplicateIds.has(record.id));
  }
  if (preset === "transfers") {
    const transferIds = new Set(
      summary.diagnostics.transferCandidates.flatMap((candidate) => [
        candidate.outflowId,
        candidate.revenueId
      ])
    );
    return records.filter((record) => transferIds.has(record.id));
  }
  return records;
}

export function reviewPresetLabel(preset: ReviewPreset): string {
  const labels: Record<ReviewPreset, string> = {
    all: "all records",
    revenue: "revenue only",
    outflow: "outflow only",
    duplicates: "possible duplicates",
    transfers: "possible transfers"
  };
  return labels[preset];
}
