import { build13WeekForecast, parseFutureCashEvents, type ForecastResult } from "./forecast";
import { filterTransactions, type DashboardFilters } from "./filters";
import { applyReviewPreset, type ReviewPreset } from "./review-presets";
import type { ExclusionRef, MetricLineage } from "./audit";
import { summarizeTransactions, type FinanceSummary } from "./summary";
import type { CsvImportResult, PeriodGrain, TransactionRecord } from "./types";

export interface DashboardViewInput {
  result: CsvImportResult;
  filters: DashboardFilters;
  trendGrain: PeriodGrain;
  reviewPreset: ReviewPreset;
  selectedTransactionId: string;
  cashOnHand: number;
  futureEventsText: string;
  excludedTransactionIds?: readonly string[];
}

export interface DashboardViewData {
  baseFilteredRecords: TransactionRecord[];
  baseSummary: FinanceSummary;
  reviewSummary: FinanceSummary;
  filteredRecords: TransactionRecord[];
  summary: FinanceSummary;
  selectedTransactionId: string;
  selectedRecord: TransactionRecord | null;
  futureEventsText: string;
  forecast: ForecastResult;
}

export function buildDashboardView(input: DashboardViewInput): DashboardViewData {
  const excludedIds = new Set(input.excludedTransactionIds ?? []);
  const reviewFilteredRecords = filterTransactions(input.result.records, input.filters);
  const reviewSummary = summarizeTransactions(
    reviewFilteredRecords,
    input.result.rejectedRows,
    input.cashOnHand,
    input.trendGrain
  );
  const baseFilteredRecords = reviewFilteredRecords.filter((record) => !excludedIds.has(record.id));
  const baseSummary = summarizeTransactions(
    baseFilteredRecords,
    input.result.rejectedRows,
    input.cashOnHand,
    input.trendGrain
  );
  const filteredRecords = applyReviewPreset(baseFilteredRecords, baseSummary, input.reviewPreset);
  const summary = withReviewExclusions(summarizeTransactions(
    filteredRecords,
    input.result.rejectedRows,
    input.cashOnHand,
    input.trendGrain
  ), reviewFilteredRecords.filter((record) => excludedIds.has(record.id)));
  const selectedTransactionId = filteredRecords.some(
    (record) => record.id === input.selectedTransactionId
  )
    ? input.selectedTransactionId
    : filteredRecords[0]?.id ?? "";
  const selectedRecord =
    filteredRecords.find((record) => record.id === selectedTransactionId) ?? null;
  const parsedEvents = parseFutureCashEvents(input.futureEventsText);
  const forecast = {
    ...build13WeekForecast(filteredRecords, input.cashOnHand, parsedEvents.events),
    rejectedEvents: parsedEvents.rejectedEvents
  };

  return {
    baseFilteredRecords,
    baseSummary,
    reviewSummary,
    filteredRecords,
    summary,
    selectedTransactionId,
    selectedRecord,
    futureEventsText: input.futureEventsText,
    forecast
  };
}

function withReviewExclusions(
  summary: FinanceSummary,
  excludedRecords: readonly TransactionRecord[]
): FinanceSummary {
  if (excludedRecords.length === 0) return summary;

  const revenueExclusions = excludedRecords
    .filter((record) => record.flow === "revenue")
    .map(toReviewExclusion);
  const outflowExclusions = excludedRecords
    .filter((record) => record.flow === "outflow")
    .map(toReviewExclusion);
  const allExclusions = excludedRecords.map(toReviewExclusion);

  return {
    ...summary,
    lineage: {
      revenue: appendExclusions(summary.lineage.revenue, revenueExclusions),
      outflow: appendExclusions(summary.lineage.outflow, outflowExclusions),
      netCash: appendExclusions(summary.lineage.netCash, allExclusions)
    },
    cashHealth: {
      ...summary.cashHealth,
      lineage: {
        averageMonthlyOutflow: appendExclusions(
          summary.cashHealth.lineage.averageMonthlyOutflow,
          outflowExclusions
        ),
        runwayMonths: appendExclusions(summary.cashHealth.lineage.runwayMonths, outflowExclusions)
      }
    }
  };
}

function appendExclusions(
  lineage: MetricLineage,
  exclusions: readonly ExclusionRef[]
): MetricLineage {
  return exclusions.length === 0
    ? lineage
    : { ...lineage, excluded: [...lineage.excluded, ...exclusions] };
}

function toReviewExclusion(record: TransactionRecord): ExclusionRef {
  return {
    id: record.id,
    reason: "excluded in review drawer",
    confidence: "medium"
  };
}
