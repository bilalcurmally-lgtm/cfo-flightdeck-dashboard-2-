import { optionValues, type DashboardFilters } from "../finance/filters";
import type { BudgetEntry, BudgetVarianceRow } from "../finance/budget";
import type { ForecastResult } from "../finance/forecast";
import type { ExpectedIncomeEvent } from "../finance/expected-income";
import type { RunwayConfidenceReport } from "../finance/runway-confidence";
import { reviewPresetLabel, type ReviewPreset } from "../finance/review-presets";
import type { FinanceSummary } from "../finance/summary";
import type { CsvImportResult, PeriodGrain, TransactionRecord } from "../finance/types";
import type { ClassificationRule } from "../finance/classification-rules";
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
      ${renderActiveFilterSummary(options.activeFilters)}
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

function renderActiveFilterSummary(filters: DashboardFilters): string {
  const items = [
    filterSummaryItem("Flow", filters.flow),
    filterSummaryItem("Account", filters.account),
    filterSummaryItem("Head", filters.head),
    filterSummaryItem("Subcategory", filters.subcategory),
    filterSummaryItem("Counterparty", filters.counterparty),
    filters.dateFrom ? `From ${filters.dateFrom}` : "",
    filters.dateTo ? `To ${filters.dateTo}` : ""
  ].filter(Boolean);

  return `
    <p class="active-filter-summary">
      ${items.length ? items.map(escapeHtml).join(" · ") : "No filters active"}
    </p>
  `;
}

function filterSummaryItem(label: string, value: string): string {
  return value && value !== "all" ? `${label}: ${value}` : "";
}

export function renderExportPanel(): string {
  return `
    <section class="export-panel" aria-labelledby="export-title">
      <div>
        <h2 id="export-title">Exports</h2>
        <p>Use transaction CSV or Excel for spreadsheet review, JSON for the full audit state, or trend CSV for the visible filtered chart data.</p>
      </div>
      <div class="export-actions">
        <button id="export-transactions" type="button">Transactions CSV</button>
        <button id="export-transactions-xlsx" type="button">Transactions Excel</button>
        <button id="export-accountant-workbook" type="button">Accountant Workbook</button>
        <button id="export-dashboard-manifest" type="button">Dashboard Manifest</button>
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
  formatRunway: (runwayMonths: number | null) => string,
  runwayConfidence?: RunwayConfidenceReport
): string {
  const confidenceLine = runwayConfidence
    ? `<p class="cash-confidence">Runway confidence: ${escapeHtml(runwayConfidence.headline)}</p>`
    : "";

  return `
    <section class="cash-panel" aria-labelledby="cash-title">
      <div>
        <h2 id="cash-title">Cash Health</h2>
        <p>Enter cash on hand to estimate runway from imported outflows.</p>
        ${confidenceLine}
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

export function renderSettingsPanel(
  currencyOptionsHtml: string,
  rules: readonly ClassificationRule[] = [],
  budgets: readonly BudgetEntry[] = []
): string {
  return `
    <section class="settings-panel" aria-labelledby="settings-title">
      <div>
        <h2 id="settings-title">Local Settings</h2>
        <p>Saved in this browser and exportable in your .billu.json project file.</p>
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
      ${renderBudgetSettings(budgets)}
      ${renderSavedRules(rules)}
    </section>
  `;
}

function renderBudgetSettings(budgets: readonly BudgetEntry[]): string {
  return `
    <div class="budget-settings" aria-label="Monthly budgets">
      <h3>Monthly Budgets</h3>
      <p>Add simple head or subcategory budgets to compare against imported actuals.</p>
      <div class="budget-settings__form">
        <label>Month <input id="budget-month" type="month" /></label>
        <label>Scope
          <select id="budget-scope">
            <option value="head">Head</option>
            <option value="subcategory">Subcategory</option>
          </select>
        </label>
        <label>Key <input id="budget-key" type="text" placeholder="Client or Client / Retainer" /></label>
        <label>Flow
          <select id="budget-flow">
            <option value="revenue">Revenue</option>
            <option value="outflow">Outflow</option>
          </select>
        </label>
        <label>Amount <input id="budget-amount" type="number" min="0" step="50" /></label>
        <label>Note <input id="budget-note" type="text" placeholder="Optional note" /></label>
        <button id="budget-add" type="button">Add budget</button>
      </div>
      ${budgets.length === 0 ? `<p class="budget-settings__empty">No budgets yet.</p>` : renderBudgetList(budgets)}
    </div>
  `;
}

function renderBudgetList(budgets: readonly BudgetEntry[]): string {
  return `
    <ul class="budget-settings__list">
      ${budgets
        .map(
          (entry) => `
            <li class="budget-settings__item">
              <div>
                <strong>${escapeHtml(entry.month)} · ${escapeHtml(entry.key)}</strong>
                <span>${escapeHtml(entry.flow)} · budget ${entry.amount}${entry.note ? ` · ${escapeHtml(entry.note)}` : ""}</span>
              </div>
              <button type="button" data-budget-delete="${escapeHtml(entry.id)}">Delete</button>
            </li>
          `
        )
        .join("")}
    </ul>
  `;
}

export function renderBudgetVsActualPanel(
  rows: readonly BudgetVarianceRow[],
  formatMoney: (value: number) => string
): string {
  if (rows.length === 0) {
    return `
      <section class="budget-panel" aria-labelledby="budget-title">
        <h2 id="budget-title">Budget Vs Actual</h2>
        <p>Add monthly budgets in Local Settings to compare plan against imported actuals.</p>
      </section>
    `;
  }

  return `
    <section class="budget-panel" aria-labelledby="budget-title">
      <div class="panel-heading">
        <h2 id="budget-title">Budget Vs Actual</h2>
        <span>${rows.length} row${rows.length === 1 ? "" : "s"}</span>
      </div>
      <table class="budget-table">
        <thead>
          <tr>
            <th>Month</th>
            <th>Key</th>
            <th>Flow</th>
            <th>Budgeted</th>
            <th>Actual</th>
            <th>Variance</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `
                <tr data-budget-status="${escapeHtml(row.status)}">
                  <td>${escapeHtml(row.month)}</td>
                  <td>${escapeHtml(row.key)}</td>
                  <td>${escapeHtml(row.flow)}</td>
                  <td>${row.budgeted === null ? "—" : escapeHtml(formatMoney(row.budgeted))}</td>
                  <td>${escapeHtml(formatMoney(row.actual))}</td>
                  <td>${escapeHtml(formatMoney(row.variance))}</td>
                  <td>${escapeHtml(row.status)}</td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    </section>
  `;
}

function renderSavedRules(rules: readonly ClassificationRule[]): string {
  if (rules.length === 0) {
    return `
      <div class="saved-rules" aria-label="Saved classification rules">
        <h3>Saved Rules</h3>
        <p class="saved-rules__empty">No saved rules yet.</p>
      </div>
    `;
  }

  return `
    <div class="saved-rules" aria-label="Saved classification rules">
      <h3>Saved Rules</h3>
      <ul class="saved-rules__list">
        ${rules.map((rule) => renderSavedRule(rule)).join("")}
      </ul>
    </div>
  `;
}

function renderSavedRule(rule: ClassificationRule): string {
  const action = [
    rule.override.flow ? `Type: ${rule.override.flow}` : "",
    rule.override.parent ? `Group: ${rule.override.parent}` : ""
  ].filter(Boolean).join(" · ");
  const description = `${rule.field} contains "${rule.contains}" · ${action || "No action"}`;
  return `
    <li class="saved-rules__item" data-rule-id="${escapeHtml(rule.id)}">
      <div>
        <strong>${escapeHtml(rule.label ?? `${rule.field} contains ${rule.contains}`)}</strong>
        <span>${escapeHtml(description)}</span>
      </div>
      <div class="saved-rules__actions">
        <button type="button" data-rule-toggle="${escapeHtml(rule.id)}" aria-pressed="${rule.enabled}">
          ${rule.enabled ? "Enabled" : "Disabled"}
        </button>
        <button type="button" data-rule-delete="${escapeHtml(rule.id)}">Delete</button>
      </div>
    </li>
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
  formatMoney: (value: number) => string,
  expectedIncomeEvents: readonly ExpectedIncomeEvent[] = []
): string {
  return `
    <section class="forecast-panel" aria-labelledby="forecast-title">
      <div class="panel-heading">
        <div>
          <h2 id="forecast-title">13-Week Forecast</h2>
          <p>Tag expected income below or keep one manual event per line: YYYY-MM-DD, amount, label</p>
        </div>
        <span>${escapeHtml(formatMoney(forecast.averageWeeklyNet))} avg weekly net</span>
      </div>
      ${renderExpectedIncomeSettings(expectedIncomeEvents, formatMoney)}
      <textarea id="future-events" rows="3" placeholder="2026-04-15, -1200, quarterly tax&#10;2026-05-01, 3000, client payment">${escapeHtml(
        futureEventsText
      )}</textarea>
      ${renderForecast(forecast, formatMoney)}
    </section>
  `;
}

function renderExpectedIncomeSettings(
  events: readonly ExpectedIncomeEvent[],
  formatMoney: (value: number) => string
): string {
  return `
    <div class="expected-income" aria-label="Expected income events">
      <h3>Expected Income</h3>
      <p>Forecast input only — not invoicing or receivables tracking.</p>
      <div class="expected-income__form">
        <label>Due date <input id="expected-income-date" type="date" /></label>
        <label>Amount <input id="expected-income-amount" type="number" min="0" step="50" /></label>
        <label>Label <input id="expected-income-label" type="text" placeholder="Client retainer" /></label>
        <label>Status
          <select id="expected-income-status">
            <option value="expected">Expected</option>
            <option value="tentative">Tentative</option>
            <option value="received">Received</option>
          </select>
        </label>
        <button id="expected-income-add" type="button">Add expected income</button>
      </div>
      ${
        events.length === 0
          ? `<p class="expected-income__empty">No tagged expected income yet.</p>`
          : `
            <ul class="expected-income__list">
              ${events
                .map(
                  (event) => `
                    <li>
                      <div>
                        <strong>${escapeHtml(event.dueDate)} · ${escapeHtml(formatMoney(event.amount))}</strong>
                        <span>${escapeHtml(event.label)} · ${escapeHtml(event.status)}</span>
                      </div>
                      <button type="button" data-expected-income-delete="${escapeHtml(event.id)}">Delete</button>
                    </li>
                  `
                )
                .join("")}
            </ul>
          `
      }
    </div>
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
