import { optionValues, type DashboardFilters } from "../finance/filters";
import type { ForecastResult } from "../finance/forecast";
import { reviewPresetLabel, type ReviewPreset } from "../finance/review-presets";
import type { FinanceSummary } from "../finance/summary";
import type { CsvImportResult, PeriodGrain, TransactionRecord } from "../finance/types";
import { currencyOptions } from "../finance/currencies";
import { escapeHtml } from "./html";
import { filterSelect, metricCard, reviewPresetButton, trendGrainLabel, trendGrainOption } from "./controls";
import {
  renderAccountBalances,
  renderDiagnostics,
  renderSubcategories,
  renderTopHeads,
  renderTransactionDetail,
  renderTransactionTable,
  renderTrend,
  renderWarnings
} from "./dashboard-renderers";
import { renderForecast } from "./forecast-renderers";
import { renderRejectedRows } from "./import-review";

export interface DashboardFilterPanelOptions {
  records: TransactionRecord[];
  filteredRecordCount: number;
  activeFilters: DashboardFilters;
  activeTrendGrain: PeriodGrain;
  activeReviewPreset: ReviewPreset;
  duplicateGroupCount: number;
  transferCandidateCount: number;
}

export function renderDashboardFilterPanel(options: DashboardFilterPanelOptions): string {
  return `
    <section class="filter-panel" aria-labelledby="filter-title">
      <div>
        <h2 id="filter-title">Dashboard Filters</h2>
        <p>Filters update visible analysis only. CSV and reviewer exports keep the full reviewed import.</p>
      </div>
      <div class="filter-editor">
        ${filterSelect("Flow", "flow", optionValues(options.records, "flow"), options.activeFilters.flow)}
        ${filterSelect("Account", "account", optionValues(options.records, "account"), options.activeFilters.account)}
        ${filterSelect("Head", "head", optionValues(options.records, "head"), options.activeFilters.head)}
        ${filterSelect(
          "Subcategory",
          "subcategory",
          optionValues(options.records, "subcategory"),
          options.activeFilters.subcategory
        )}
        ${filterSelect(
          "Counterparty",
          "counterparty",
          optionValues(options.records, "counterparty"),
          options.activeFilters.counterparty
        )}
        <label>
          From
          <input data-date-filter-key="dateFrom" type="date" value="${escapeHtml(options.activeFilters.dateFrom)}" />
        </label>
        <label>
          To
          <input data-date-filter-key="dateTo" type="date" value="${escapeHtml(options.activeFilters.dateTo)}" />
        </label>
        <label>
          Trend
          <select id="trend-grain">
            ${trendGrainOption("daily", options.activeTrendGrain)}
            ${trendGrainOption("weekly", options.activeTrendGrain)}
            ${trendGrainOption("monthly", options.activeTrendGrain)}
          </select>
        </label>
      </div>
      <div class="filter-summary">
        <span>${options.filteredRecordCount} of ${options.records.length} record${
          options.records.length === 1 ? "" : "s"
        } shown${options.activeReviewPreset === "all" ? "" : ` · ${escapeHtml(reviewPresetLabel(options.activeReviewPreset))}`}</span>
        <button id="reset-filters" type="button">Reset</button>
      </div>
      <div class="preset-chips" aria-label="Common review views">
        ${reviewPresetButton("all", "All", options.activeReviewPreset)}
        ${reviewPresetButton("revenue", "Revenue", options.activeReviewPreset)}
        ${reviewPresetButton("outflow", "Outflow", options.activeReviewPreset)}
        ${reviewPresetButton(
          "duplicates",
          `Duplicates (${options.duplicateGroupCount})`,
          options.activeReviewPreset,
          !options.duplicateGroupCount
        )}
        ${reviewPresetButton(
          "transfers",
          `Transfers (${options.transferCandidateCount})`,
          options.activeReviewPreset,
          !options.transferCandidateCount
        )}
      </div>
    </section>
  `;
}

export function renderExportPanel(): string {
  return `
    <section class="export-panel" aria-labelledby="export-title">
      <div>
        <h2 id="export-title">Exports</h2>
        <p>Use transaction CSV for spreadsheet review, JSON for the full audit state, or trend CSV for the visible filtered chart data.</p>
      </div>
      <div class="export-actions">
        <button id="export-transactions" type="button">Transactions CSV</button>
        <button id="export-visible-transactions" type="button">Filtered CSV</button>
        <button id="export-reviewer" type="button">Reviewer JSON</button>
        <button id="export-trend" type="button">Trend CSV</button>
        <button id="export-trend-svg" type="button">Trend SVG</button>
        <button id="export-trend-png" type="button">Trend PNG</button>
        <button id="print-report" type="button">Print Report</button>
      </div>
    </section>
  `;
}

export function renderSummaryGrid(summary: FinanceSummary, formatMoney: (value: number) => string): string {
  return `
    <div class="summary-grid">
      ${metricCard("Records", String(summary.transactionCount))}
      ${metricCard("Revenue", formatMoney(summary.revenue))}
      ${metricCard("Outflow", formatMoney(summary.outflow))}
      ${metricCard("Net Cash", formatMoney(summary.netCash))}
    </div>
  `;
}

export function renderCashHealthPanel(
  summary: FinanceSummary,
  cashOnHand: number,
  formatMoney: (value: number) => string,
  formatRunway: (runwayMonths: number | null) => string
): string {
  return `
    <section class="cash-panel" aria-labelledby="cash-title">
      <div>
        <h2 id="cash-title">Cash Health</h2>
        <p>Enter cash on hand to estimate runway from imported outflows.</p>
      </div>
      <label>
        Cash on hand
        <input id="cash-on-hand" type="number" min="0" step="100" value="${cashOnHand || ""}" placeholder="0" />
      </label>
      <div class="cash-metrics">
        ${metricCard("Avg Monthly Burn", formatMoney(summary.cashHealth.averageMonthlyOutflow))}
        ${metricCard("Runway", formatRunway(summary.cashHealth.runwayMonths))}
        ${metricCard("Revenue Concentration", `${Math.round(summary.cashHealth.revenueConcentration * 100)}%`)}
      </div>
    </section>
  `;
}

export function renderSettingsPanel(currencyOptionsHtml: string): string {
  return `
    <section class="settings-panel" aria-labelledby="settings-title">
      <div>
        <h2 id="settings-title">Local Settings</h2>
        <p>Saved in this browser only. Currency changes display formatting, not imported values.</p>
      </div>
      <div class="settings-controls">
        <label>
          Display currency
          <select id="currency-select">
            ${currencyOptionsHtml}
          </select>
        </label>
        <button id="reset-settings" type="button">Reset Settings</button>
      </div>
    </section>
  `;
}

export function renderCurrencyOptions(selectedCurrency: string): string {
  return currencyOptions()
    .map(
      (currency) =>
        `<option value="${currency.code}"${currency.code === selectedCurrency ? " selected" : ""}>${escapeHtml(
          currency.label
        )}</option>`
    )
    .join("");
}

export function renderForecastPanel(
  forecast: ForecastResult,
  futureEventsText: string,
  formatMoney: (value: number) => string
): string {
  return `
    <section class="forecast-panel" aria-labelledby="forecast-title">
      <div class="panel-heading">
        <div>
          <h2 id="forecast-title">13-Week Forecast</h2>
          <p>One event per line: YYYY-MM-DD, amount, label</p>
        </div>
        <span>${escapeHtml(formatMoney(forecast.averageWeeklyNet))} avg weekly net</span>
      </div>
      <textarea id="future-events" rows="3" placeholder="2026-04-15, -1200, quarterly tax&#10;2026-05-01, 3000, client payment">${escapeHtml(
        futureEventsText
      )}</textarea>
      ${renderForecast(forecast, formatMoney)}
    </section>
  `;
}

export function renderInsightGrid(
  summary: FinanceSummary,
  activeTrendGrain: PeriodGrain,
  formatMoney: (value: number) => string
): string {
  return `
    <div class="insight-grid">
      <section class="table-panel" aria-labelledby="trend-title">
        <div class="panel-heading">
          <h2 id="trend-title">${escapeHtml(trendGrainLabel(activeTrendGrain))} Trend</h2>
          <span>${summary.periodTrend.length} period${summary.periodTrend.length === 1 ? "" : "s"}</span>
        </div>
        ${renderTrend(summary.periodTrend, formatMoney)}
      </section>
      <section class="table-panel" aria-labelledby="heads-title">
        <div class="panel-heading">
          <h2 id="heads-title">Top Heads</h2>
          <span>by amount</span>
        </div>
        ${renderTopHeads(summary.topHeads, formatMoney)}
      </section>
      <section class="table-panel" aria-labelledby="accounts-title">
        <div class="panel-heading">
          <h2 id="accounts-title">Account Balances</h2>
          <span>${summary.accountBalances.length} account${summary.accountBalances.length === 1 ? "" : "s"}</span>
        </div>
        ${renderAccountBalances(summary.accountBalances, formatMoney)}
      </section>
      <section class="table-panel" aria-labelledby="subcategories-title">
        <div class="panel-heading">
          <h2 id="subcategories-title">Subcategories</h2>
          <span>${summary.topSubcategories.length} drilldown${summary.topSubcategories.length === 1 ? "" : "s"}</span>
        </div>
        ${renderSubcategories(summary.topSubcategories, formatMoney)}
      </section>
      <section class="table-panel" aria-labelledby="warnings-title">
        <div class="panel-heading">
          <h2 id="warnings-title">Data Quality</h2>
          <span>${summary.warnings.length} signal${summary.warnings.length === 1 ? "" : "s"}</span>
        </div>
        ${renderWarnings(summary)}
      </section>
    </div>
  `;
}

export function renderDiagnosticsPanel(
  summary: FinanceSummary,
  formatMoney: (value: number) => string
): string {
  return `
    <section class="table-panel diagnostics-panel" aria-labelledby="diagnostics-title">
      <div class="panel-heading">
        <h2 id="diagnostics-title">Duplicate & Transfer Checks</h2>
        <span>${summary.diagnostics.duplicateGroups.length} duplicate, ${summary.diagnostics.transferCandidates.length} transfer</span>
      </div>
      ${renderDiagnostics(summary, formatMoney)}
    </section>
  `;
}

export function renderDetailGrid(
  result: CsvImportResult,
  filteredRecords: TransactionRecord[],
  selectedTransactionId: string,
  selectedRecord: TransactionRecord | null,
  formatMoney: (value: number) => string
): string {
  return `
    <div class="detail-grid">
      <section class="table-panel" aria-labelledby="preview-title">
        <div class="panel-heading">
          <h2 id="preview-title">Transaction Preview</h2>
          <span>${filteredRecords.length} shown · ${escapeHtml(result.dateFormat.toUpperCase())} dates</span>
        </div>
        ${renderTransactionTable(filteredRecords, selectedTransactionId, formatMoney)}
      </section>
      <section class="table-panel" aria-labelledby="transaction-detail-title">
        <div class="panel-heading">
          <h2 id="transaction-detail-title">Transaction Detail</h2>
          <span>audit trail</span>
        </div>
        ${renderTransactionDetail(selectedRecord, result, formatMoney)}
      </section>
      <section class="table-panel" aria-labelledby="quality-title">
        <div class="panel-heading">
          <h2 id="quality-title">Import Quality</h2>
          <span>${result.rejectedRows.length} rejected</span>
        </div>
        ${renderRejectedRows(result)}
      </section>
    </div>
  `;
}
