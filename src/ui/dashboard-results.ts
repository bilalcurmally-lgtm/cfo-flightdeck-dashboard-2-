import type { DashboardViewData } from "../finance/dashboard-view";
import type { DashboardFilters } from "../finance/filters";
import type { ReviewPreset } from "../finance/review-presets";
import type { CsvImportResult, PeriodGrain } from "../finance/types";
import { deriveAuditedCockpit } from "../finance/audit-derive";
import {
  renderCashHealthPanel,
  renderDashboardFilterPanel,
  renderDetailGrid,
  renderDiagnosticsPanel,
  renderExportPanel,
  renderForecastPanel,
  renderInsightGrid,
  renderSettingsPanel,
  renderSummaryGrid
} from "./dashboard-sections";
import { renderCockpitStrip } from "./dashboard-cockpit";
import { renderPrintableReport } from "./print-report";

export interface DashboardResultsRenderInput {
  result: CsvImportResult;
  sourceName: string;
  view: DashboardViewData;
  activeFilters: DashboardFilters;
  activeTrendGrain: PeriodGrain;
  activeReviewPreset: ReviewPreset;
  reviewPresetLabel: string;
  currencyOptionsHtml: string;
  cashOnHand: number;
  formatMoney: (value: number) => string;
  formatRunway: (months: number | null) => string;
}

export function renderDashboardResults(input: DashboardResultsRenderInput): string {
  const cockpit = deriveAuditedCockpit({
    summary: input.view.summary,
    records: input.view.filteredRecords,
    rejectedRows: input.result.rejectedRows
  });

  return `
    ${renderCockpitStrip(cockpit, {
      formatMoney: input.formatMoney,
      formatRunway: input.formatRunway
    })}
    ${renderDashboardFilterPanel({
      records: input.result.records,
      filteredRecordCount: input.view.filteredRecords.length,
      activeFilters: input.activeFilters,
      activeTrendGrain: input.activeTrendGrain,
      activeReviewPreset: input.activeReviewPreset,
      duplicateGroupCount: input.view.baseSummary.diagnostics.duplicateGroups.length,
      transferCandidateCount: input.view.baseSummary.diagnostics.transferCandidates.length
    })}
    ${renderSummaryGrid(input.view.summary, input.formatMoney)}
    ${renderCashHealthPanel(
      input.view.summary,
      input.cashOnHand,
      input.formatMoney,
      input.formatRunway
    )}
    ${renderExportPanel()}
    ${renderPrintableReport({
      sourceName: input.sourceName,
      summary: input.view.summary,
      forecast: input.view.forecast,
      visibleRecords: input.view.filteredRecords,
      reviewPresetLabel: input.reviewPresetLabel,
      activeFilters: input.activeFilters,
      formatMoney: input.formatMoney,
      formatRunway: input.formatRunway
    })}
    ${renderSettingsPanel(input.currencyOptionsHtml)}
    ${renderForecastPanel(input.view.forecast, input.view.futureEventsText, input.formatMoney)}
    ${renderInsightGrid(input.view.summary, input.activeTrendGrain, input.formatMoney)}
    ${renderDiagnosticsPanel(input.view.summary, input.formatMoney)}
    ${renderDetailGrid(
      input.result,
      input.view.filteredRecords,
      input.view.selectedTransactionId,
      input.view.selectedRecord,
      input.formatMoney
    )}
  `;
}
