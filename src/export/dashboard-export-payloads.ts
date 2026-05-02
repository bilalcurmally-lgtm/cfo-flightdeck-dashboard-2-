import { build13WeekForecast, parseFutureCashEvents } from "../finance/forecast";
import type { FinanceSummary } from "../finance/summary";
import { summarizeTransactions } from "../finance/summary";
import type { CsvImportResult, PeriodGrain, TransactionRecord } from "../finance/types";
import type { ReviewPreset } from "../finance/review-presets";
import { filteredTransactionsFilename } from "../ui/downloads";
import { buildMonthlyTrendCsv, monthlyTrendCsvFilename } from "./monthly-trend-csv";
import { buildReviewerReport, type ReviewerReport } from "./reviewer-report";
import { buildTransactionsCsv, transactionsCsvFilename } from "./transactions-csv";
import { trendSvgFilename } from "./trend-svg";
import { buildVisibleTrendSvg } from "./visible-trend-svg";

export interface ReviewerExportReportInput {
  sourceName: string;
  result: CsvImportResult;
  cashOnHand: number;
  futureEventsText: string;
  trendGrain: PeriodGrain;
  generatedAt?: Date;
  forecastStartDate?: Date;
}

export interface TextExportDescriptor {
  filename: string;
  contents: string;
  mediaType: string;
}

export interface TrendSvgExportInput {
  sourceName: string;
  summary: FinanceSummary;
  trendGrain: PeriodGrain;
  reviewPreset: ReviewPreset;
  currency: string;
  generatedAt?: Date;
}

export function buildReviewerExportReport(input: ReviewerExportReportInput): ReviewerReport {
  const parsedEvents = parseFutureCashEvents(input.futureEventsText);
  const forecast = {
    ...build13WeekForecast(
      input.result.records,
      input.cashOnHand,
      parsedEvents.events,
      input.forecastStartDate
    ),
    rejectedEvents: parsedEvents.rejectedEvents
  };

  return buildReviewerReport(
    input.sourceName,
    input.result,
    summarizeTransactions(
      input.result.records,
      input.result.rejectedRows,
      input.cashOnHand,
      input.trendGrain
    ),
    forecast,
    input.generatedAt
  );
}

export function buildTransactionsCsvExport(
  sourceName: string,
  records: TransactionRecord[],
  generatedAt = new Date()
): TextExportDescriptor {
  return {
    filename: transactionsCsvFilename(sourceName, generatedAt),
    contents: buildTransactionsCsv(records),
    mediaType: "text/csv;charset=utf-8"
  };
}

export function buildFilteredTransactionsCsvExport(
  sourceName: string,
  records: TransactionRecord[],
  generatedAt = new Date()
): TextExportDescriptor {
  return {
    filename: filteredTransactionsFilename(sourceName, generatedAt),
    contents: buildTransactionsCsv(records),
    mediaType: "text/csv;charset=utf-8"
  };
}

export function buildTrendCsvExport(
  sourceName: string,
  summary: FinanceSummary,
  trendGrain: PeriodGrain,
  generatedAt = new Date()
): TextExportDescriptor {
  return {
    filename: monthlyTrendCsvFilename(sourceName, generatedAt, trendGrain),
    contents: buildMonthlyTrendCsv(summary.periodTrend),
    mediaType: "text/csv;charset=utf-8"
  };
}

export function buildTrendSvgExport(input: TrendSvgExportInput): TextExportDescriptor {
  return {
    filename: trendSvgFilename(input.sourceName, input.generatedAt, input.trendGrain),
    contents: buildVisibleTrendSvg({
      periods: input.summary.periodTrend,
      trendGrain: input.trendGrain,
      sourceName: input.sourceName,
      reviewPreset: input.reviewPreset,
      currency: input.currency
    }),
    mediaType: "image/svg+xml;charset=utf-8"
  };
}
