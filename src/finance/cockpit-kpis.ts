import type { FinanceSummary } from "./summary";
import type { TransactionRecord } from "./types";

export type RunwayTone = "healthy" | "watch" | "tight" | "unknown";

export interface ReviewBreakdown {
  rejected: number;
  duplicates: number;
  transfers: number;
  total: number;
}

export interface CockpitViewModel {
  revenue: number;
  outflow: number;
  netCash: number;
  runwayMonths: number | null;
  averageMonthlyOutflow: number;
  inflowCount: number;
  outflowCount: number;
  runwayTone: RunwayTone;
  review: ReviewBreakdown;
  hasRows: boolean;
}

export interface DeriveCockpitInput {
  summary: FinanceSummary;
  records: readonly TransactionRecord[];
  rejectedRows: readonly unknown[];
}

export function deriveCockpit({
  summary,
  records,
  rejectedRows
}: DeriveCockpitInput): CockpitViewModel {
  const inflowCount = records.filter((record) => record.flow === "revenue").length;
  const outflowCount = records.filter((record) => record.flow === "outflow").length;
  const rejected = rejectedRows.length;
  const duplicates = summary.diagnostics.duplicateGroups.length;
  const transfers = summary.diagnostics.transferCandidates.length;

  return {
    revenue: summary.revenue,
    outflow: summary.outflow,
    netCash: summary.netCash,
    runwayMonths: summary.cashHealth.runwayMonths,
    averageMonthlyOutflow: summary.cashHealth.averageMonthlyOutflow,
    inflowCount,
    outflowCount,
    runwayTone: classifyRunway(summary.cashHealth.runwayMonths),
    review: {
      rejected,
      duplicates,
      transfers,
      total: rejected + duplicates + transfers
    },
    hasRows: summary.transactionCount > 0
  };
}

function classifyRunway(months: number | null): RunwayTone {
  if (months === null || !Number.isFinite(months)) return "unknown";
  if (months >= 9) return "healthy";
  if (months >= 3) return "watch";
  return "tight";
}
