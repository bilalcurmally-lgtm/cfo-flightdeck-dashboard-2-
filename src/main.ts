import "./styles.css";
import type {
  CsvImportResult,
  DateFormat,
  ImportedRow,
  ImportMapping,
  TransactionRecord
} from "./finance/types";
import type { FinanceSummary } from "./finance/summary";
import { buildDashboardView } from "./finance/dashboard-view";
import {
  optionValues,
  type FilterableField
} from "./finance/filters";
import {
  isReviewPreset,
  reviewPresetLabel
} from "./finance/review-presets";
import { currencyOptions } from "./finance/currencies";
import { build13WeekForecast, parseFutureCashEvents } from "./finance/forecast";
import { summarizeTransactions } from "./finance/summary";
import { buildReviewerReport, reviewerReportFilename } from "./export/reviewer-report";
import { buildMonthlyTrendCsv, monthlyTrendCsvFilename } from "./export/monthly-trend-csv";
import { buildTransactionsCsv, transactionsCsvFilename } from "./export/transactions-csv";
import { svgToPngBlob, trendPngFilename } from "./export/trend-png";
import { buildTrendSvg, trendSvgFilename } from "./export/trend-svg";
import { parseExcelWorkbook, type ParsedExcelSheet } from "./import/excel";
import { SAMPLE_DATASETS } from "./import/sample-datasets";
import { importTransactionsFromCsv, importTransactionsFromRows } from "./import/transactions";
import { analyzeImportReadiness } from "./import/validation";
import { clearSettings, DEFAULT_SETTINGS, loadSettings, saveSettings, type AppSettings } from "./store/settings";
import { createDashboardViewState, resetDashboardFilters, selectTransaction } from "./store/view-state";
import {
  dateFormatOption,
  filterSelect,
  mappingSelect,
  metricCard,
  reviewPresetButton,
  trendGrainLabel,
  trendGrainOption
} from "./ui/controls";
import {
  renderAccountBalances,
  renderDiagnostics,
  renderSubcategories,
  renderTopHeads,
  renderTransactionDetail,
  renderTransactionTable,
  renderTrend,
  renderWarnings
} from "./ui/dashboard-renderers";
import { downloadBlob, downloadJson, downloadText, filteredTransactionsFilename } from "./ui/downloads";
import { renderAppShell } from "./ui/app-shell";
import { renderForecast } from "./ui/forecast-renderers";
import { escapeHtml } from "./ui/html";
import {
  renderMappingValidation,
  renderRawPreview,
  renderRejectedRows,
  renderWorksheetOption
} from "./ui/import-review";
import { renderPrintableReport } from "./ui/print-report";
import { renderReferencePanelContent } from "./ui/reference";

type ImportSource = string | ImportedRow[];
type LoadedImportFile =
  | { kind: "csv"; result: CsvImportResult; source: string }
  | { kind: "excel"; sheets: ParsedExcelSheet[] };

let activeImport: { result: CsvImportResult; sourceName: string } | null = null;
let draftImport:
  | { result: CsvImportResult; sourceName: string; source: ImportSource }
  | null = null;
let settings: AppSettings = loadSettings();
let viewState = createDashboardViewState();
let referenceOpen = false;

document.querySelector<HTMLDivElement>("#app")!.innerHTML = renderAppShell(SAMPLE_DATASETS);

const fileInput = document.querySelector<HTMLInputElement>("#csv-file")!;
const sampleButton = document.querySelector<HTMLButtonElement>("#sample-button")!;
const sampleSelect = document.querySelector<HTMLSelectElement>("#sample-select")!;
const clearButton = document.querySelector<HTMLButtonElement>("#clear-button")!;
const referenceButton = document.querySelector<HTMLButtonElement>("#reference-button")!;
const referencePanel = document.querySelector<HTMLElement>("#reference-panel")!;
const status = document.querySelector<HTMLParagraphElement>("#status")!;
const results = document.querySelector<HTMLElement>("#results")!;

fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  if (!file) return;

  try {
    status.textContent = `Reading ${file.name} locally...`;
    const loaded = await loadImportFile(file);
    if (loaded.kind === "excel") {
      renderWorksheetPicker(file.name, loaded.sheets);
      return;
    }
    renderMappingReview(loaded.result, file.name, loaded.source);
  } catch (error) {
    showImportError(file.name, error);
  }
});

sampleButton.addEventListener("click", async () => {
  const sample = SAMPLE_DATASETS.find((item) => item.path === sampleSelect.value) ?? SAMPLE_DATASETS[0];
  try {
    status.textContent = `Loading ${sample.label.toLowerCase()} sample CSV...`;
    const response = await fetch(sample.path);
    if (!response.ok) throw new Error(`Sample request failed with ${response.status}.`);
    const text = await response.text();
    renderMappingReview(importTransactionsFromCsv(text), sample.path.replace(/^\//, ""), text);
  } catch (error) {
    showImportError(sample.label, error);
  }
});

clearButton.addEventListener("click", () => {
  activeImport = null;
  draftImport = null;
  resetDashboardViewState();
  fileInput.value = "";
  results.innerHTML = "";
  status.textContent = "Import cleared. Waiting for a CSV or Excel file.";
  clearButton.disabled = true;
});

referenceButton.addEventListener("click", () => {
  referenceOpen = !referenceOpen;
  renderReferencePanel();
});

function renderReferencePanel(): void {
  referenceButton.setAttribute("aria-expanded", String(referenceOpen));
  referencePanel.hidden = !referenceOpen;
  referencePanel.innerHTML = referenceOpen ? renderReferencePanelContent() : "";
}

async function loadImportFile(file: File): Promise<LoadedImportFile> {
  if (isExcelFile(file)) {
    return { kind: "excel", sheets: await parseExcelWorkbook(file) };
  }

  const text = await file.text();
  return { kind: "csv", result: importTransactionsFromCsv(text), source: text };
}

function isExcelFile(file: File): boolean {
  return /\.xlsx$/i.test(file.name) || file.type.includes("spreadsheetml");
}

function showImportError(sourceName: string, error: unknown): void {
  activeImport = null;
  draftImport = null;
  results.innerHTML = "";
  clearButton.disabled = true;
  const message = error instanceof Error ? error.message : "Unknown import error.";
  status.textContent = `${sourceName}: could not read this import. ${message}`;
}

function renderWorksheetPicker(sourceName: string, sheets: ParsedExcelSheet[]): void {
  activeImport = null;
  draftImport = null;
  resetDashboardViewState();
  clearButton.disabled = false;

  if (sheets.length === 1) {
    const sheet = sheets[0];
    renderMappingReview(importTransactionsFromRows(sheet.rows), `${sourceName} / ${sheet.name}`, sheet.rows);
    return;
  }

  status.textContent = `${sourceName}: choose the worksheet to import before mapping review.`;
  results.innerHTML = `
    <section class="worksheet-panel" aria-labelledby="worksheet-title">
      <div class="panel-heading">
        <div>
          <h2 id="worksheet-title">Choose Worksheet</h2>
          <p>Select the sheet that contains transaction rows. Empty helper tabs can stay out of the review.</p>
        </div>
        <span>${sheets.length} sheet${sheets.length === 1 ? "" : "s"} found</span>
      </div>
      <div class="worksheet-list">
        ${sheets.map((sheet, index) => renderWorksheetOption(sheet, index)).join("")}
      </div>
    </section>
  `;

  document.querySelectorAll<HTMLButtonElement>("[data-sheet-index]").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.sheetIndex);
      const sheet = sheets[index];
      if (!sheet) return;
      renderMappingReview(importTransactionsFromRows(sheet.rows), `${sourceName} / ${sheet.name}`, sheet.rows);
    });
  });
}

function renderMappingReview(
  result: CsvImportResult,
  sourceName: string,
  source: ImportSource
): void {
  activeImport = null;
  draftImport = { result, sourceName, source };
  resetDashboardViewState();
  clearButton.disabled = false;
  const columns = Object.keys(result.rawRows[0] || {});

  status.textContent = `${sourceName}: review detected columns before calculations render.`;
  results.innerHTML = `
    <section class="mapping-panel" aria-labelledby="mapping-title">
      <div class="panel-heading">
        <div>
          <h2 id="mapping-title">Review Import Mapping</h2>
          <p>Confirm the required date and amount columns, then adjust optional fields if this CSV uses different labels.</p>
        </div>
        <span>${result.rawRows.length} row${result.rawRows.length === 1 ? "" : "s"} found</span>
      </div>
      <div class="mapping-editor">
        ${mappingSelect("Date", "date", columns, result.mapping.date, true)}
        ${mappingSelect("Amount", "amount", columns, result.mapping.amount, true)}
        ${mappingSelect("Flow / Type", "type", columns, result.mapping.type)}
        ${mappingSelect("Head", "head", columns, result.mapping.head)}
        ${mappingSelect("Group", "parent", columns, result.mapping.parent)}
        ${mappingSelect("Subcategory", "subcategory", columns, result.mapping.subcategory)}
        ${mappingSelect("Counterparty", "counterparty", columns, result.mapping.counterparty)}
        ${mappingSelect("Description", "description", columns, result.mapping.description)}
        ${mappingSelect("Account", "account", columns, result.mapping.account)}
        ${mappingSelect("Running Balance", "runningBalance", columns, result.mapping.runningBalance)}
        <label>
          Date format
          <select id="mapping-date-format">
            ${dateFormatOption("ymd", result.dateFormat)}
            ${dateFormatOption("mdy", result.dateFormat)}
            ${dateFormatOption("dmy", result.dateFormat)}
          </select>
        </label>
      </div>
      <div class="mapping-actions">
        <button id="apply-mapping" type="button">Apply Mapping</button>
      </div>
      <div id="mapping-validation">
        ${renderMappingValidation(analyzeImportReadiness(result.rawRows, result.mapping, result.dateFormat))}
      </div>
      ${renderRawPreview(result)}
    </section>
  `;
  bindMappingReview();
}

function renderImportResult(result: CsvImportResult, sourceName: string): void {
  activeImport = { result, sourceName };
  draftImport = null;
  clearButton.disabled = false;
  const view = buildDashboardView({
    result,
    filters: viewState.filters,
    trendGrain: viewState.trendGrain,
    reviewPreset: viewState.reviewPreset,
    selectedTransactionId: viewState.selectedTransactionId,
    cashOnHand: readCashOnHand(),
    futureEventsText: readFutureEventsText()
  });
  if (view.selectedTransactionId !== viewState.selectedTransactionId) {
    viewState = selectTransaction(viewState, view.selectedTransactionId);
  }
  status.textContent = `${sourceName}: ${result.records.length} transaction records ready, ${result.rejectedRows.length} rejected.`;
  results.innerHTML = `
    <section class="filter-panel" aria-labelledby="filter-title">
      <div>
        <h2 id="filter-title">Dashboard Filters</h2>
        <p>Filters update visible analysis only. CSV and reviewer exports keep the full reviewed import.</p>
      </div>
      <div class="filter-editor">
        ${filterSelect("Flow", "flow", flowOptions(result.records), viewState.filters.flow)}
        ${filterSelect("Account", "account", optionValues(result.records, "account"), viewState.filters.account)}
        ${filterSelect("Head", "head", optionValues(result.records, "head"), viewState.filters.head)}
        ${filterSelect(
          "Subcategory",
          "subcategory",
          optionValues(result.records, "subcategory"),
          viewState.filters.subcategory
        )}
        ${filterSelect(
          "Counterparty",
          "counterparty",
          optionValues(result.records, "counterparty"),
          viewState.filters.counterparty
        )}
        <label>
          From
          <input data-date-filter-key="dateFrom" type="date" value="${escapeHtml(viewState.filters.dateFrom)}" />
        </label>
        <label>
          To
          <input data-date-filter-key="dateTo" type="date" value="${escapeHtml(viewState.filters.dateTo)}" />
        </label>
        <label>
          Trend
          <select id="trend-grain">
            ${trendGrainOption("daily", viewState.trendGrain)}
            ${trendGrainOption("weekly", viewState.trendGrain)}
            ${trendGrainOption("monthly", viewState.trendGrain)}
          </select>
        </label>
      </div>
      <div class="filter-summary">
        <span>${view.filteredRecords.length} of ${result.records.length} record${
          result.records.length === 1 ? "" : "s"
        } shown${viewState.reviewPreset === "all" ? "" : ` · ${escapeHtml(reviewPresetLabel(viewState.reviewPreset))}`}</span>
        <button id="reset-filters" type="button">Reset</button>
      </div>
      <div class="preset-chips" aria-label="Common review views">
        ${reviewPresetButton("all", "All", viewState.reviewPreset)}
        ${reviewPresetButton("revenue", "Revenue", viewState.reviewPreset)}
        ${reviewPresetButton("outflow", "Outflow", viewState.reviewPreset)}
        ${reviewPresetButton(
          "duplicates",
          `Duplicates (${view.baseSummary.diagnostics.duplicateGroups.length})`,
          viewState.reviewPreset,
          !view.baseSummary.diagnostics.duplicateGroups.length
        )}
        ${reviewPresetButton(
          "transfers",
          `Transfers (${view.baseSummary.diagnostics.transferCandidates.length})`,
          viewState.reviewPreset,
          !view.baseSummary.diagnostics.transferCandidates.length
        )}
      </div>
    </section>
    <div class="summary-grid">
      ${metricCard("Records", String(view.summary.transactionCount))}
      ${metricCard("Revenue", formatMoney(view.summary.revenue))}
      ${metricCard("Outflow", formatMoney(view.summary.outflow))}
      ${metricCard("Net Cash", formatMoney(view.summary.netCash))}
    </div>
    <section class="cash-panel" aria-labelledby="cash-title">
      <div>
        <h2 id="cash-title">Cash Health</h2>
        <p>Enter cash on hand to estimate runway from imported outflows.</p>
      </div>
      <label>
        Cash on hand
        <input id="cash-on-hand" type="number" min="0" step="100" value="${readCashOnHand() || ""}" placeholder="0" />
      </label>
      <div class="cash-metrics">
        ${metricCard("Avg Monthly Burn", formatMoney(view.summary.cashHealth.averageMonthlyOutflow))}
        ${metricCard("Runway", formatRunway(view.summary.cashHealth.runwayMonths))}
        ${metricCard("Revenue Concentration", `${Math.round(view.summary.cashHealth.revenueConcentration * 100)}%`)}
      </div>
    </section>
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
    ${renderPrintableReport({
      sourceName,
      summary: view.summary,
      forecast: view.forecast,
      visibleRecords: view.filteredRecords,
      reviewPresetLabel: reviewPresetLabel(viewState.reviewPreset),
      activeFilters: viewState.filters,
      formatMoney,
      formatRunway
    })}
    <section class="settings-panel" aria-labelledby="settings-title">
      <div>
        <h2 id="settings-title">Local Settings</h2>
        <p>Saved in this browser only. Currency changes display formatting, not imported values.</p>
      </div>
      <div class="settings-controls">
        <label>
          Display currency
          <select id="currency-select">
            ${renderCurrencyOptions(settings.currency)}
          </select>
        </label>
        <button id="reset-settings" type="button">Reset Settings</button>
      </div>
    </section>
    <section class="forecast-panel" aria-labelledby="forecast-title">
      <div class="panel-heading">
        <div>
          <h2 id="forecast-title">13-Week Forecast</h2>
          <p>One event per line: YYYY-MM-DD, amount, label</p>
        </div>
        <span>${escapeHtml(formatMoney(view.forecast.averageWeeklyNet))} avg weekly net</span>
      </div>
      <textarea id="future-events" rows="3" placeholder="2026-04-15, -1200, quarterly tax&#10;2026-05-01, 3000, client payment">${escapeHtml(
        view.futureEventsText
      )}</textarea>
      ${renderForecast(view.forecast, formatMoney)}
    </section>
    <div class="insight-grid">
      <section class="table-panel" aria-labelledby="trend-title">
        <div class="panel-heading">
          <h2 id="trend-title">${escapeHtml(trendGrainLabel(viewState.trendGrain))} Trend</h2>
          <span>${view.summary.periodTrend.length} period${view.summary.periodTrend.length === 1 ? "" : "s"}</span>
        </div>
        ${renderTrend(view.summary.periodTrend, formatMoney)}
      </section>
      <section class="table-panel" aria-labelledby="heads-title">
        <div class="panel-heading">
          <h2 id="heads-title">Top Heads</h2>
          <span>by amount</span>
        </div>
        ${renderTopHeads(view.summary.topHeads, formatMoney)}
      </section>
      <section class="table-panel" aria-labelledby="accounts-title">
        <div class="panel-heading">
          <h2 id="accounts-title">Account Balances</h2>
          <span>${view.summary.accountBalances.length} account${
            view.summary.accountBalances.length === 1 ? "" : "s"
          }</span>
        </div>
        ${renderAccountBalances(view.summary.accountBalances, formatMoney)}
      </section>
      <section class="table-panel" aria-labelledby="subcategories-title">
        <div class="panel-heading">
          <h2 id="subcategories-title">Subcategories</h2>
          <span>${view.summary.topSubcategories.length} drilldown${
            view.summary.topSubcategories.length === 1 ? "" : "s"
          }</span>
        </div>
        ${renderSubcategories(view.summary.topSubcategories, formatMoney)}
      </section>
      <section class="table-panel" aria-labelledby="warnings-title">
        <div class="panel-heading">
          <h2 id="warnings-title">Data Quality</h2>
          <span>${view.summary.warnings.length} signal${view.summary.warnings.length === 1 ? "" : "s"}</span>
        </div>
        ${renderWarnings(view.summary)}
      </section>
    </div>
    <section class="table-panel diagnostics-panel" aria-labelledby="diagnostics-title">
      <div class="panel-heading">
        <h2 id="diagnostics-title">Duplicate & Transfer Checks</h2>
        <span>${view.summary.diagnostics.duplicateGroups.length} duplicate, ${
          view.summary.diagnostics.transferCandidates.length
        } transfer</span>
      </div>
      ${renderDiagnostics(view.summary, formatMoney)}
    </section>
    <div class="detail-grid">
      <section class="table-panel" aria-labelledby="preview-title">
        <div class="panel-heading">
          <h2 id="preview-title">Transaction Preview</h2>
          <span>${view.filteredRecords.length} shown · ${escapeHtml(result.dateFormat.toUpperCase())} dates</span>
        </div>
        ${renderTransactionTable(view.filteredRecords, viewState.selectedTransactionId, formatMoney)}
      </section>
      <section class="table-panel" aria-labelledby="transaction-detail-title">
        <div class="panel-heading">
          <h2 id="transaction-detail-title">Transaction Detail</h2>
          <span>audit trail</span>
        </div>
        ${renderTransactionDetail(view.selectedRecord, result, formatMoney)}
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
  bindDashboardFilters();
  bindLiveInputs();
  bindExportButton(view.summary, view.filteredRecords);
  bindTransactionPreview();
}

function renderCurrencyOptions(selectedCurrency: string): string {
  return currencyOptions()
    .map(
      (currency) =>
        `<option value="${currency.code}"${currency.code === selectedCurrency ? " selected" : ""}>${escapeHtml(
          currency.label
        )}</option>`
    )
    .join("");
}

function flowOptions(records: TransactionRecord[]): string[] {
  return optionValues(records, "flow");
}

function resetDashboardViewState(): void {
  viewState = createDashboardViewState();
}

function resetFiltersAndPreset(): void {
  viewState = resetDashboardFilters(viewState);
}

function bindMappingReview(): void {
  const refreshValidation = () => {
    if (!draftImport) return;

    const validation = document.querySelector<HTMLElement>("#mapping-validation");
    const applyButton = document.querySelector<HTMLButtonElement>("#apply-mapping");
    const readiness = analyzeImportReadiness(
      draftImport.result.rawRows,
      readReviewedMapping(),
      readReviewedDateFormat()
    );
    if (validation) validation.innerHTML = renderMappingValidation(readiness);
    if (applyButton) {
      applyButton.disabled =
        Boolean(readiness.missingRequiredColumns.length) || readiness.acceptedRows === 0;
    }
  };

  document.querySelectorAll<HTMLSelectElement>("[data-mapping-key], #mapping-date-format").forEach((select) => {
    select.addEventListener("change", refreshValidation);
  });
  refreshValidation();

  document.querySelector<HTMLButtonElement>("#apply-mapping")?.addEventListener("click", () => {
    if (!draftImport) return;

    const mapping = readReviewedMapping();
    const dateFormat = readReviewedDateFormat();
    const result =
      typeof draftImport.source === "string"
        ? importTransactionsFromCsv(draftImport.source, { mapping, dateFormat })
        : importTransactionsFromRows(draftImport.source, { mapping, dateFormat });
    renderImportResult(result, draftImport.sourceName);
  });
}

function bindDashboardFilters(): void {
  document.querySelectorAll<HTMLSelectElement>("[data-filter-key]").forEach((select) => {
    select.addEventListener("change", () => {
      if (!activeImport) return;

      const key = select.dataset.filterKey as FilterableField | undefined;
      if (!key) return;
      viewState = { ...viewState, filters: { ...viewState.filters, [key]: select.value } };
      renderImportResult(activeImport.result, activeImport.sourceName);
      document.querySelector<HTMLSelectElement>(`[data-filter-key="${key}"]`)?.focus();
    });
  });
  document.querySelectorAll<HTMLInputElement>("[data-date-filter-key]").forEach((input) => {
    input.addEventListener("change", () => {
      if (!activeImport) return;

      const key = input.dataset.dateFilterKey as "dateFrom" | "dateTo" | undefined;
      if (!key) return;
      viewState = { ...viewState, filters: { ...viewState.filters, [key]: input.value } };
      renderImportResult(activeImport.result, activeImport.sourceName);
      document.querySelector<HTMLInputElement>(`[data-date-filter-key="${key}"]`)?.focus();
    });
  });
  document.querySelector<HTMLSelectElement>("#trend-grain")?.addEventListener("change", (event) => {
    if (!activeImport) return;

    const value = (event.target as HTMLSelectElement).value;
    if (value !== "daily" && value !== "weekly" && value !== "monthly") return;
    viewState = { ...viewState, trendGrain: value };
    renderImportResult(activeImport.result, activeImport.sourceName);
    document.querySelector<HTMLSelectElement>("#trend-grain")?.focus();
  });

  document.querySelector<HTMLButtonElement>("#reset-filters")?.addEventListener("click", () => {
    if (!activeImport) return;

    resetFiltersAndPreset();
    renderImportResult(activeImport.result, activeImport.sourceName);
    document.querySelector<HTMLButtonElement>("#reset-filters")?.focus();
  });
  document.querySelectorAll<HTMLButtonElement>("[data-review-preset]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!activeImport) return;

      const preset = button.dataset.reviewPreset;
      if (!isReviewPreset(preset)) return;
      viewState = { ...viewState, reviewPreset: preset };
      renderImportResult(activeImport.result, activeImport.sourceName);
      document.querySelector<HTMLButtonElement>(`[data-review-preset="${preset}"]`)?.focus();
    });
  });
}

function bindTransactionPreview(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-transaction-id]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!activeImport) return;

      viewState = selectTransaction(viewState, button.dataset.transactionId ?? "");
      renderImportResult(activeImport.result, activeImport.sourceName);
      document.querySelector<HTMLButtonElement>(
        `[data-transaction-id="${viewState.selectedTransactionId}"]`
      )?.focus();
    });
  });
}

function bindLiveInputs(): void {
  const cashInput = document.querySelector<HTMLInputElement>("#cash-on-hand");
  const eventsInput = document.querySelector<HTMLTextAreaElement>("#future-events");
  const currencySelect = document.querySelector<HTMLSelectElement>("#currency-select");
  const resetSettingsButton = document.querySelector<HTMLButtonElement>("#reset-settings");
  cashInput?.addEventListener("input", () => {
    if (!activeImport) return;
    settings = { ...settings, cashOnHand: readCashOnHand() };
    saveSettings(settings);
    renderImportResult(activeImport.result, activeImport.sourceName);
    document.querySelector<HTMLInputElement>("#cash-on-hand")?.focus();
  });
  eventsInput?.addEventListener("input", () => {
    if (!activeImport) return;
    const selectionStart = eventsInput.selectionStart;
    settings = { ...settings, futureEventsText: eventsInput.value };
    saveSettings(settings);
    renderImportResult(activeImport.result, activeImport.sourceName);
    const nextInput = document.querySelector<HTMLTextAreaElement>("#future-events");
    nextInput?.focus();
    nextInput?.setSelectionRange(selectionStart, selectionStart);
  });
  currencySelect?.addEventListener("change", () => {
    if (!activeImport) return;
    settings = { ...settings, currency: currencySelect.value };
    saveSettings(settings);
    renderImportResult(activeImport.result, activeImport.sourceName);
    document.querySelector<HTMLSelectElement>("#currency-select")?.focus();
  });
  resetSettingsButton?.addEventListener("click", () => {
    if (!activeImport) return;
    settings = { ...DEFAULT_SETTINGS };
    clearSettings();
    renderImportResult(activeImport.result, activeImport.sourceName);
    document.querySelector<HTMLButtonElement>("#reset-settings")?.focus();
  });
}

function readReviewedMapping(): ImportMapping {
  const mapping: ImportMapping = { date: "", amount: "" };
  document.querySelectorAll<HTMLSelectElement>("[data-mapping-key]").forEach((select) => {
    const key = select.dataset.mappingKey as keyof ImportMapping | undefined;
    if (!key) return;
    mapping[key] = select.value;
  });
  return mapping;
}

function readReviewedDateFormat(): DateFormat {
  const value = document.querySelector<HTMLSelectElement>("#mapping-date-format")?.value;
  if (value === "dmy" || value === "mdy" || value === "ymd") return value;
  return "ymd";
}

function bindExportButton(visibleSummary: FinanceSummary, visibleRecords: TransactionRecord[]): void {
  document.querySelector<HTMLButtonElement>("#export-reviewer")?.addEventListener("click", () => {
    if (!activeImport) return;

    const parsedEvents = parseFutureCashEvents(readFutureEventsText());
    const fullForecast = {
      ...build13WeekForecast(activeImport.result.records, readCashOnHand(), parsedEvents.events),
      rejectedEvents: parsedEvents.rejectedEvents
    };

    const report = buildReviewerReport(
      activeImport.sourceName,
      activeImport.result,
      summarizeTransactions(
        activeImport.result.records,
        activeImport.result.rejectedRows,
        readCashOnHand(),
        viewState.trendGrain
      ),
      fullForecast
    );
    downloadJson(reviewerReportFilename(activeImport.sourceName), report);
  });
  document.querySelector<HTMLButtonElement>("#export-transactions")?.addEventListener("click", () => {
    if (!activeImport) return;
    downloadText(
      transactionsCsvFilename(activeImport.sourceName),
      buildTransactionsCsv(activeImport.result.records),
      "text/csv;charset=utf-8"
    );
  });
  document.querySelector<HTMLButtonElement>("#export-visible-transactions")?.addEventListener("click", () => {
    if (!activeImport) return;
    downloadText(
      filteredTransactionsFilename(activeImport.sourceName, new Date()),
      buildTransactionsCsv(visibleRecords),
      "text/csv;charset=utf-8"
    );
  });
  document.querySelector<HTMLButtonElement>("#export-trend")?.addEventListener("click", () => {
    if (!activeImport) return;
    downloadText(
      monthlyTrendCsvFilename(activeImport.sourceName, new Date(), viewState.trendGrain),
      buildMonthlyTrendCsv(visibleSummary.periodTrend),
      "text/csv;charset=utf-8"
    );
  });
  document.querySelector<HTMLButtonElement>("#export-trend-svg")?.addEventListener("click", () => {
    if (!activeImport) return;
    downloadText(
      trendSvgFilename(activeImport.sourceName, new Date(), viewState.trendGrain),
      buildVisibleTrendSvg(visibleSummary),
      "image/svg+xml;charset=utf-8"
    );
  });
  document.querySelector<HTMLButtonElement>("#export-trend-png")?.addEventListener("click", async () => {
    if (!activeImport) return;
    const button = document.querySelector<HTMLButtonElement>("#export-trend-png");
    if (button) button.disabled = true;
    try {
      const png = await svgToPngBlob(buildVisibleTrendSvg(visibleSummary));
      downloadBlob(trendPngFilename(activeImport.sourceName, new Date(), viewState.trendGrain), png);
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "Could not export trend PNG.";
    } finally {
      if (button) button.disabled = false;
    }
  });
  document.querySelector<HTMLButtonElement>("#print-report")?.addEventListener("click", () => {
    window.print();
  });
}

function buildVisibleTrendSvg(visibleSummary: FinanceSummary): string {
  return buildTrendSvg(visibleSummary.periodTrend, {
    title: `${trendGrainLabel(viewState.trendGrain)} Trend`,
    subtitle: `${activeImport?.sourceName ?? "Current import"} · ${reviewPresetLabel(viewState.reviewPreset)}`,
    currency: settings.currency
  });
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: settings.currency,
    maximumFractionDigits: 0
  }).format(value);
}

function formatRunway(runwayMonths: number | null): string {
  if (runwayMonths === null) return "Not enough data";
  return `${runwayMonths.toFixed(1)} months`;
}

function readCashOnHand(): number {
  const value = Number(
    document.querySelector<HTMLInputElement>("#cash-on-hand")?.value ?? settings.cashOnHand
  );
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function readFutureEventsText(): string {
  return document.querySelector<HTMLTextAreaElement>("#future-events")?.value ?? settings.futureEventsText;
}
