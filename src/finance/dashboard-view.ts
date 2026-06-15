import type { ExpectedIncomeEvent } from "./expected-income";
import { resolveForecastEvents } from "./expected-income";
import { build13WeekForecast, type ForecastResult } from "./forecast";
import { filterTransactions, type DashboardFilters } from "./filters";
import { applyReviewPreset, type ReviewPreset } from "./review-presets";
import type { ExclusionRef, MetricLineage } from "./audit";
import { summarizeTransactions, type FinanceSummary } from "./summary";
import type { CsvImportResult, PeriodGrain, TransactionRecord } from "./types";
import {
  applyClassificationOverrides,
  type ClassificationOverride
} from "./classification-overrides";
import { isOperating } from "./operating-groups";
import { summarizeNonOperating, type NonOperatingSummary } from "./non-operating";
import {
  buildCategoryReviewSummary,
  type CategoryReviewSummary
} from "../ui/category-review-queue";

export interface DashboardViewInput {
  result: CsvImportResult;
  filters: DashboardFilters;
  trendGrain: PeriodGrain;
  reviewPreset: ReviewPreset;
  selectedTransactionId: string;
  cashOnHand: number;
  futureEventsText: string;
  expectedIncomeEvents?: readonly ExpectedIncomeEvent[];
  deriveExcludedTransactionIds?: (reviewSummary: FinanceSummary) => readonly string[];
  overrides?: Map<string, ClassificationOverride>;
}

export interface DashboardViewData {
  baseFilteredRecords: TransactionRecord[];
  baseSummary: FinanceSummary;
  reviewSummary: FinanceSummary;
  // Always populated by buildDashboardView; optional so hand-built test literals
  // (and other synthetic DashboardViewData values) don't have to restate it.
  excludedTransactionIds?: readonly string[];
  filteredRecords: TransactionRecord[];
  summary: FinanceSummary;
  selectedTransactionId: string;
  selectedRecord: TransactionRecord | null;
  futureEventsText: string;
  forecast: ForecastResult;
  nonOperating: NonOperatingSummary;
  categoryReview: CategoryReviewSummary;
}

export function buildDashboardView(input: DashboardViewInput): DashboardViewData {
  const overrides = input.overrides ?? new Map<string, ClassificationOverride>();
  const overridden = applyClassificationOverrides(input.result.records, overrides);
  const reviewFilteredRecords = filterTransactions(overridden, input.filters);

  const reviewSummary = summarizeTransactions(
    reviewFilteredRecords,
    input.result.rejectedRows,
    input.cashOnHand,
    input.trendGrain
  );

  const reviewExcludedIds = new Set(input.deriveExcludedTransactionIds?.(reviewSummary) ?? []);
  const nonOperatingIds = new Set(
    reviewFilteredRecords.filter((record) => !isOperating(record)).map((record) => record.id)
  );
  const operatingExcludedIds = new Set([...reviewExcludedIds, ...nonOperatingIds]);

  const baseFilteredRecords = reviewFilteredRecords.filter(
    (record) => !operatingExcludedIds.has(record.id)
  );
  const baseSummary = summarizeTransactions(
    baseFilteredRecords,
    input.result.rejectedRows,
    input.cashOnHand,
    input.trendGrain
  );
  const filteredRecords = applyReviewPreset(baseFilteredRecords, baseSummary, input.reviewPreset);

  const excludedRecords = reviewFilteredRecords.filter((record) =>
    operatingExcludedIds.has(record.id)
  );
  const summary = withReviewExclusions(
    summarizeTransactions(
      filteredRecords,
      input.result.rejectedRows,
      input.cashOnHand,
      input.trendGrain
    ),
    excludedRecords,
    (record) => nonOperatingIds.has(record.id)
  );

  const nonOperating = summarizeNonOperating(
    reviewFilteredRecords.filter((record) => nonOperatingIds.has(record.id))
  );
  const categoryReview = buildCategoryReviewSummary({ records: overridden, overrides });

  const selectedTransactionId = filteredRecords.some(
    (record) => record.id === input.selectedTransactionId
  )
    ? input.selectedTransactionId
    : filteredRecords[0]?.id ?? "";
  const selectedRecord =
    filteredRecords.find((record) => record.id === selectedTransactionId) ?? null;
  const resolvedEvents = resolveForecastEvents(
    input.expectedIncomeEvents ?? [],
    input.futureEventsText
  );
  const forecast = {
    ...build13WeekForecast(filteredRecords, input.cashOnHand, resolvedEvents.events),
    rejectedEvents: resolvedEvents.rejectedEvents
  };

  return {
    baseFilteredRecords,
    baseSummary,
    reviewSummary,
    // Export removal = review exclusions only; non-operating rows stay in the export.
    excludedTransactionIds: [...reviewExcludedIds],
    filteredRecords,
    summary,
    selectedTransactionId,
    selectedRecord,
    futureEventsText: input.futureEventsText,
    forecast,
    nonOperating,
    categoryReview
  };
}

function withReviewExclusions(
  summary: FinanceSummary,
  excludedRecords: readonly TransactionRecord[],
  isNonOperating: (record: TransactionRecord) => boolean
): FinanceSummary {
  if (excludedRecords.length === 0) return summary;

  const reasonFor = (record: TransactionRecord) =>
    isNonOperating(record) ? "non-operating (Internal/Financing)" : "excluded in review drawer";
  const toExcl = (record: TransactionRecord) => toReviewExclusion(record, reasonFor(record));

  const revenueExclusions = excludedRecords
    .filter((record) => record.flow === "revenue")
    .map(toExcl);
  const outflowExclusions = excludedRecords
    .filter((record) => record.flow === "outflow")
    .map(toExcl);
  const allExclusions = excludedRecords.map(toExcl);

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

function toReviewExclusion(record: TransactionRecord, reason: string): ExclusionRef {
  return {
    id: record.id,
    reason,
    confidence: "medium"
  };
}
