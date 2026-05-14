import type { FinanceSummary } from "../finance/summary";
import type { CsvImportResult, PeriodGrain, TransactionRecord } from "../finance/types";
import {
  buildFilteredTransactionsCsvExport,
  buildReviewerExportReport,
  buildTransactionsCsvExport,
  buildTrendCsvExport,
  buildTrendSvgExport
} from "../export/dashboard-export-payloads";
import { reviewerReportFilename } from "../export/reviewer-report";
import { svgToPngBlob, trendPngFilename } from "../export/trend-png";
import type { ReviewPreset } from "../finance/review-presets";
import { downloadBlob, downloadJson, downloadText } from "./downloads";

export interface ActiveExportImport {
  result: CsvImportResult;
  sourceName: string;
}

export interface DashboardExportActionRoot {
  querySelector<T extends Element = Element>(selector: string): T | null;
}

export interface DashboardExportDownloads {
  blob: typeof downloadBlob;
  json: typeof downloadJson;
  text: typeof downloadText;
}

export interface DashboardExportActionBindings {
  root?: DashboardExportActionRoot;
  status: { textContent: string | null };
  visibleSummary: FinanceSummary;
  visibleRecords: TransactionRecord[];
  getActiveImport: () => ActiveExportImport | null;
  getCashOnHand: () => number;
  getFutureEventsText: () => string;
  getTrendGrain: () => PeriodGrain;
  getReviewPreset: () => ReviewPreset;
  getCurrency: () => string;
  downloads?: DashboardExportDownloads;
  print?: () => void;
  now?: () => Date;
}

export function bindDashboardExportActions({
  root = document,
  status,
  visibleSummary,
  visibleRecords,
  getActiveImport,
  getCashOnHand,
  getFutureEventsText,
  getTrendGrain,
  getReviewPreset,
  getCurrency,
  downloads = { blob: downloadBlob, json: downloadJson, text: downloadText },
  print = () => window.print(),
  now = () => new Date()
}: DashboardExportActionBindings): void {
  root.querySelector<HTMLButtonElement>("#export-reviewer")?.addEventListener("click", () => {
    const activeImport = getActiveImport();
    if (!activeImport) return;

    const generatedAt = now();
    downloads.json(
      reviewerReportFilename(activeImport.sourceName, generatedAt),
      buildReviewerExportReport({
        sourceName: activeImport.sourceName,
        result: activeImport.result,
        cashOnHand: getCashOnHand(),
        futureEventsText: getFutureEventsText(),
        trendGrain: getTrendGrain(),
        generatedAt
      })
    );
  });

  root.querySelector<HTMLButtonElement>("#export-transactions")?.addEventListener("click", () => {
    const activeImport = getActiveImport();
    if (!activeImport) return;

    const csv = buildTransactionsCsvExport(activeImport.sourceName, activeImport.result.records, now());
    downloads.text(csv.filename, csv.contents, csv.mediaType);
  });

  root
    .querySelector<HTMLButtonElement>("#export-visible-transactions")
    ?.addEventListener("click", () => {
      const activeImport = getActiveImport();
      if (!activeImport) return;

      const csv = buildFilteredTransactionsCsvExport(activeImport.sourceName, visibleRecords, now());
      downloads.text(csv.filename, csv.contents, csv.mediaType);
    });

  root.querySelector<HTMLButtonElement>("#export-trend")?.addEventListener("click", () => {
    const activeImport = getActiveImport();
    if (!activeImport) return;

    const csv = buildTrendCsvExport(activeImport.sourceName, visibleSummary, getTrendGrain(), now());
    downloads.text(csv.filename, csv.contents, csv.mediaType);
  });

  root.querySelector<HTMLButtonElement>("#export-trend-svg")?.addEventListener("click", () => {
    const activeImport = getActiveImport();
    if (!activeImport) return;

    const svg = buildTrendSvgExport(
      buildTrendSvgExportInput(activeImport, visibleSummary, {
        trendGrain: getTrendGrain(),
        reviewPreset: getReviewPreset(),
        currency: getCurrency(),
        generatedAt: now()
      })
    );
    downloads.text(svg.filename, svg.contents, svg.mediaType);
  });

  root.querySelector<HTMLButtonElement>("#export-trend-png")?.addEventListener("click", async () => {
    const activeImport = getActiveImport();
    if (!activeImport) return;

    const button = root.querySelector<HTMLButtonElement>("#export-trend-png");
    if (button) button.disabled = true;
    try {
      const generatedAt = now();
      const svg = buildTrendSvgExport(
        buildTrendSvgExportInput(activeImport, visibleSummary, {
          trendGrain: getTrendGrain(),
          reviewPreset: getReviewPreset(),
          currency: getCurrency(),
          generatedAt
        })
      );
      const png = await svgToPngBlob(svg.contents);
      downloads.blob(trendPngFilename(activeImport.sourceName, generatedAt, getTrendGrain()), png);
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "Could not export trend PNG.";
    } finally {
      if (button) button.disabled = false;
    }
  });

  root.querySelector<HTMLButtonElement>("#print-report")?.addEventListener("click", () => {
    print();
  });
}

export function buildTrendSvgExportInput(
  activeImport: ActiveExportImport | null,
  visibleSummary: FinanceSummary,
  options: {
    trendGrain: PeriodGrain;
    reviewPreset: ReviewPreset;
    currency: string;
    generatedAt?: Date;
  }
) {
  return {
    summary: visibleSummary,
    trendGrain: options.trendGrain,
    sourceName: activeImport?.sourceName ?? "Current import",
    reviewPreset: options.reviewPreset,
    currency: options.currency,
    generatedAt: options.generatedAt
  };
}
