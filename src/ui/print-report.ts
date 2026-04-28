import type { ForecastResult } from "../finance/forecast";
import type { DashboardFilters } from "../finance/filters";
import type { FinanceSummary } from "../finance/summary";
import type { TransactionRecord } from "../finance/types";
import { metricCard } from "./controls";
import { renderReportTransactionTable } from "./dashboard-renderers";
import { escapeHtml, formatDateRange } from "./html";

type MoneyFormatter = (value: number) => string;

export function renderPrintableReport({
  sourceName,
  summary,
  forecast,
  visibleRecords,
  reviewPresetLabel,
  activeFilters,
  formatMoney,
  formatRunway
}: {
  sourceName: string;
  summary: FinanceSummary;
  forecast: ForecastResult & { rejectedEvents: string[] };
  visibleRecords: TransactionRecord[];
  reviewPresetLabel: string;
  activeFilters: DashboardFilters;
  formatMoney: MoneyFormatter;
  formatRunway: (runwayMonths: number | null) => string;
}): string {
  const reportFields = [
    ["Source", sourceName],
    ["Created", new Date().toLocaleString()],
    ["Preset", reviewPresetLabel],
    ["Flow", activeFilters.flow],
    ["Account", activeFilters.account],
    ["Head", activeFilters.head],
    ["Subcategory", activeFilters.subcategory],
    ["Counterparty", activeFilters.counterparty],
    ["Date Range", formatDateRange(activeFilters.dateFrom, activeFilters.dateTo)]
  ];
  const nextForecast = forecast.weeks[forecast.weeks.length - 1];

  return `
    <section class="print-report" aria-label="Printable report">
      <header>
        <p class="eyebrow">Billu.Works Finance Dashboard V2</p>
        <h2>Finance Import Report</h2>
      </header>
      <dl class="report-meta">
        ${reportFields
          .map(
            ([label, value]) => `
              <div>
                <dt>${escapeHtml(label)}</dt>
                <dd>${escapeHtml(value)}</dd>
              </div>
            `
          )
          .join("")}
      </dl>
      <div class="report-metrics">
        ${metricCard("Records", String(summary.transactionCount))}
        ${metricCard("Revenue", formatMoney(summary.revenue))}
        ${metricCard("Outflow", formatMoney(summary.outflow))}
        ${metricCard("Net Cash", formatMoney(summary.netCash))}
        ${metricCard("Avg Monthly Burn", formatMoney(summary.cashHealth.averageMonthlyOutflow))}
        ${metricCard("Runway", formatRunway(summary.cashHealth.runwayMonths))}
      </div>
      <div class="report-grid">
        <article>
          <h3>Forecast</h3>
          <p>${escapeHtml(formatMoney(forecast.averageWeeklyNet))} average weekly net.</p>
          <p>${
            nextForecast
              ? `${escapeHtml(nextForecast.weekStartISO)} projected cash: ${escapeHtml(formatMoney(nextForecast.projectedCash))}.`
              : "No forecast weeks available."
          }</p>
        </article>
        <article>
          <h3>Review Signals</h3>
          <p>${summary.diagnostics.duplicateGroups.length} possible duplicate group${
            summary.diagnostics.duplicateGroups.length === 1 ? "" : "s"
          }.</p>
          <p>${summary.diagnostics.transferCandidates.length} possible transfer${
            summary.diagnostics.transferCandidates.length === 1 ? "" : "s"
          }.</p>
          <p>${summary.warnings.length} quality signal${summary.warnings.length === 1 ? "" : "s"}.</p>
        </article>
      </div>
      <div>
        <h3>Visible Transactions</h3>
        ${renderReportTransactionTable(visibleRecords.slice(0, 12), formatMoney)}
      </div>
    </section>
  `;
}
