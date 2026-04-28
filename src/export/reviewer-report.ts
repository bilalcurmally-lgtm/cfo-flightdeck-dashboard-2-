import type { ForecastResult } from "../finance/forecast";
import type { FinanceSummary } from "../finance/summary";
import type { CsvImportResult } from "../finance/types";

export interface ReviewerReport {
  sourceName: string;
  generatedAt: string;
  privacy: string;
  import: {
    rawRows: number;
    acceptedRows: number;
    rejectedRows: number;
    dateFormat: string;
    mapping: CsvImportResult["mapping"];
  };
  summary: {
    revenue: number;
    outflow: number;
    netCash: number;
    averageMonthlyOutflow: number;
    runwayMonths: number | null;
    revenueConcentration: number;
  };
  qualitySignals: string[];
  accountBalances: FinanceSummary["accountBalances"];
  topSubcategories: FinanceSummary["topSubcategories"];
  diagnostics: FinanceSummary["diagnostics"];
  topHeads: FinanceSummary["topHeads"];
  monthlyTrend: FinanceSummary["periodTrend"];
  forecast: {
    averageWeeklyNet: number;
    manualEvents: ForecastResult["events"];
    rejectedManualEvents: ForecastResult["rejectedEvents"];
    weeks: ForecastResult["weeks"];
  };
}

export function buildReviewerReport(
  sourceName: string,
  result: CsvImportResult,
  summary: FinanceSummary,
  forecast: ForecastResult,
  generatedAt = new Date()
): ReviewerReport {
  return {
    sourceName,
    generatedAt: generatedAt.toISOString(),
    privacy: "Generated locally in the browser. Transaction data is not uploaded by default.",
    import: {
      rawRows: result.rawRows.length,
      acceptedRows: result.records.length,
      rejectedRows: result.rejectedRows.length,
      dateFormat: result.dateFormat,
      mapping: result.mapping
    },
    summary: {
      revenue: summary.revenue,
      outflow: summary.outflow,
      netCash: summary.netCash,
      averageMonthlyOutflow: summary.cashHealth.averageMonthlyOutflow,
      runwayMonths: summary.cashHealth.runwayMonths,
      revenueConcentration: summary.cashHealth.revenueConcentration
    },
    qualitySignals: summary.warnings.map((warning) => warning.message),
    accountBalances: summary.accountBalances,
    topSubcategories: summary.topSubcategories,
    diagnostics: summary.diagnostics,
    topHeads: summary.topHeads,
    monthlyTrend: summary.periodTrend,
    forecast: {
      averageWeeklyNet: forecast.averageWeeklyNet,
      manualEvents: forecast.events,
      rejectedManualEvents: forecast.rejectedEvents,
      weeks: forecast.weeks
    }
  };
}

export function reviewerReportFilename(sourceName: string, generatedAt = new Date()): string {
  const safeSource = sourceName
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  const dateStamp = generatedAt.toISOString().slice(0, 10);

  return `${safeSource || "finance"}-review-summary-${dateStamp}.json`;
}
