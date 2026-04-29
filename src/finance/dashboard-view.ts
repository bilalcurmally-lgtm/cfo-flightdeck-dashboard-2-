import { build13WeekForecast, parseFutureCashEvents, type ForecastResult } from "./forecast";
import { filterTransactions, type DashboardFilters } from "./filters";
import { applyReviewPreset, type ReviewPreset } from "./review-presets";
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
}

export interface DashboardViewData {
  baseFilteredRecords: TransactionRecord[];
  baseSummary: FinanceSummary;
  filteredRecords: TransactionRecord[];
  summary: FinanceSummary;
  selectedTransactionId: string;
  selectedRecord: TransactionRecord | null;
  futureEventsText: string;
  forecast: ForecastResult;
}

export function buildDashboardView(input: DashboardViewInput): DashboardViewData {
  const baseFilteredRecords = filterTransactions(input.result.records, input.filters);
  const baseSummary = summarizeTransactions(
    baseFilteredRecords,
    input.result.rejectedRows,
    input.cashOnHand,
    input.trendGrain
  );
  const filteredRecords = applyReviewPreset(baseFilteredRecords, baseSummary, input.reviewPreset);
  const summary = summarizeTransactions(
    filteredRecords,
    input.result.rejectedRows,
    input.cashOnHand,
    input.trendGrain
  );
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
    filteredRecords,
    summary,
    selectedTransactionId,
    selectedRecord,
    futureEventsText: input.futureEventsText,
    forecast
  };
}
