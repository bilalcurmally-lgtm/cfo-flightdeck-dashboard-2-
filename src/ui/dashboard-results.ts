import type { DashboardViewData } from "../finance/dashboard-view";
import type { DashboardFilters } from "../finance/filters";
import type { ReviewPreset } from "../finance/review-presets";
import { compareBudgetToActual } from "../finance/budget";
import type { BudgetEntry } from "../finance/budget";
import type { ClassificationRule } from "../finance/classification-rules";
import type { ExpectedIncomeEvent } from "../finance/expected-income";
import type { CsvImportResult, PeriodGrain } from "../finance/types";
import { deriveAuditedCockpit } from "../finance/audit-derive";
import { assessReadiness, buildReadinessInput } from "../finance/readiness";
import { assessRunwayConfidence, buildRunwayConfidenceInput } from "../finance/runway-confidence";
import {
  filterExclusionImpact,
  largestTransactionInfluence,
  revenueConcentration,
  topBurnContributors,
  topNetCashContributors
} from "../finance/metric-diagnostics";
import {
  renderCashHealthPanel,
  renderDashboardFilterPanel,
  renderDetailGrid,
  renderDiagnosticsPanel,
  renderBudgetVsActualPanel,
  renderExportPanel,
  renderForecastPanel,
  renderInsightGrid,
  renderSettingsPanel,
  renderSummaryGrid
} from "./dashboard-sections";
import { renderCockpitStrip } from "./dashboard-cockpit";
import { renderPrintableReport } from "./print-report";
import { buildReviewDrawerItems } from "./review-queue";

export interface DashboardResultsRenderInput {
  result: CsvImportResult;
  sourceName: string;
  view: DashboardViewData;
  activeFilters: DashboardFilters;
  activeTrendGrain: PeriodGrain;
  activeReviewPreset: ReviewPreset;
  reviewPresetLabel: string;
  currencyOptionsHtml: string;
  savedRules?: readonly ClassificationRule[];
  budgets?: readonly BudgetEntry[];
  expectedIncomeEvents?: readonly ExpectedIncomeEvent[];
  appliedRuleFeedback?: { rowCount: number; ruleCount: number } | null;
  cashOnHand: number;
  /** Whether a prior import exists to compare against (feeds the readiness widget). */
  hasImportHistory?: boolean;
  excludedTransactionIds?: readonly string[];
  excludedReviewItemIds?: readonly string[];
  formatMoney: (value: number) => string;
  formatRunway: (months: number | null) => string;
}

export function renderDashboardResults(input: DashboardResultsRenderInput): string {
  const cockpit = deriveAuditedCockpit({
    summary: input.view.summary,
    records: input.view.filteredRecords,
    rejectedRows: input.result.rejectedRows
  });
  const reviewItems = buildReviewDrawerItems({
    summary: input.view.reviewSummary,
    rejectedRows: input.result.rejectedRows,
    excludedReviewItemIds: new Set(input.excludedReviewItemIds ?? []),
    formatMoney: input.formatMoney
  });
  const readiness = assessReadiness(
    buildReadinessInput({
      view: input.view,
      rejectedRowCount: input.result.rejectedRows.length,
      cashOnHand: input.cashOnHand,
      hasImportHistory: input.hasImportHistory ?? false
    })
  );
  const runwayConfidence = assessRunwayConfidence(
    buildRunwayConfidenceInput({
      view: input.view,
      cashOnHand: input.cashOnHand,
      readiness,
      rejectedRowCount: input.result.rejectedRows.length,
      expectedIncomeEvents: input.expectedIncomeEvents ?? []
    })
  );

  return `
    ${renderCockpitStrip(cockpit, {
      formatMoney: input.formatMoney,
      formatRunway: input.formatRunway
    }, reviewItems, {
      nonOperating: input.view.nonOperating,
      categoryItems: input.view.categoryReview.items,
      readiness,
      runwayConfidence,
      netCashContributors: topNetCashContributors(input.view.filteredRecords),
      burnContributors: topBurnContributors(input.view.filteredRecords),
      revenueConcentration: revenueConcentration(input.view.filteredRecords),
      largestTransactionInfluence: largestTransactionInfluence(input.view.filteredRecords),
      filterExclusionImpact: filterExclusionImpact(input.view.reviewSummary, input.view.summary)
    })}
    ${renderAppliedRuleFeedback(input.appliedRuleFeedback)}
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
    ${renderBudgetVsActualPanel(
      compareBudgetToActual(input.budgets ?? [], input.view.filteredRecords),
      input.formatMoney
    )}
    ${renderCashHealthPanel(
      input.view.summary,
      input.cashOnHand,
      input.formatMoney,
      input.formatRunway,
      runwayConfidence
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
    ${renderSettingsPanel(input.currencyOptionsHtml, input.savedRules, input.budgets)}
    ${renderForecastPanel(
      input.view.forecast,
      input.view.futureEventsText,
      input.formatMoney,
      input.expectedIncomeEvents
    )}
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

function renderAppliedRuleFeedback(
  feedback: DashboardResultsRenderInput["appliedRuleFeedback"]
): string {
  if (!feedback || feedback.rowCount === 0) return "";
  const rows = `${feedback.rowCount} row${feedback.rowCount === 1 ? "" : "s"}`;
  const rules = `${feedback.ruleCount} saved rule${feedback.ruleCount === 1 ? "" : "s"}`;
  return `
    <section class="rules-applied" aria-label="Saved rules applied">
      <strong>${rows} classified by ${rules}</strong>
      <span>Review or disable saved rules in Local Settings.</span>
    </section>
  `;
}
