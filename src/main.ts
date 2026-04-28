import "./styles.css";
import type {
  CsvImportResult,
  DateFormat,
  ImportedRow,
  ImportMapping,
  PeriodGrain,
  TransactionRecord
} from "./finance/types";
import type { FinanceSummary } from "./finance/summary";
import {
  DEFAULT_FILTERS,
  filterTransactions,
  optionValues,
  type DashboardFilters,
  type FilterableField
} from "./finance/filters";
import { currencyOptions } from "./finance/currencies";
import { build13WeekForecast, parseFutureCashEvents } from "./finance/forecast";
import { summarizeTransactions } from "./finance/summary";
import { buildReviewerReport, reviewerReportFilename } from "./export/reviewer-report";
import { buildMonthlyTrendCsv, monthlyTrendCsvFilename } from "./export/monthly-trend-csv";
import { buildTransactionsCsv, transactionsCsvFilename } from "./export/transactions-csv";
import { buildTrendSvg, trendSvgFilename } from "./export/trend-svg";
import { parseExcelWorkbook, type ParsedExcelSheet } from "./import/excel";
import { importTransactionsFromCsv, importTransactionsFromRows } from "./import/transactions";
import { analyzeImportReadiness } from "./import/validation";
import { clearSettings, DEFAULT_SETTINGS, loadSettings, saveSettings, type AppSettings } from "./store/settings";
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
import { downloadJson, downloadText, filteredTransactionsFilename } from "./ui/downloads";
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

const SAMPLE_DATASETS = [
  { label: "Freelancer", path: "/sample-freelancer.csv" },
  { label: "Agency", path: "/sample-agency.csv" },
  { label: "Founder", path: "/sample-founder.csv" }
];

type ImportSource = string | ImportedRow[];
type LoadedImportFile =
  | { kind: "csv"; result: CsvImportResult; source: string }
  | { kind: "excel"; sheets: ParsedExcelSheet[] };
type ReviewPreset = "all" | "revenue" | "outflow" | "duplicates" | "transfers";

let activeImport: { result: CsvImportResult; sourceName: string } | null = null;
let draftImport:
  | { result: CsvImportResult; sourceName: string; source: ImportSource }
  | null = null;
let settings: AppSettings = loadSettings();
let activeFilters: DashboardFilters = { ...DEFAULT_FILTERS };
let activeTrendGrain: PeriodGrain = "monthly";
let activeReviewPreset: ReviewPreset = "all";
let selectedTransactionId = "";
let referenceOpen = false;

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <section class="shell" aria-labelledby="page-title">
    <header class="hero">
      <div>
        <p class="eyebrow">Billu.Works Finance Dashboard V2</p>
        <h1 id="page-title">Private finance import, tested before the dashboard grows.</h1>
        <p class="lede">
          Drop in a bank CSV or Excel export. V2 keeps the file in your browser, maps transaction
          rows locally, and shows rejected rows before any CFO-style claims are made.
        </p>
      </div>
      <aside class="privacy-note" aria-label="Privacy promise">
        <strong>Local first</strong>
        <span>No upload, no account, no server-side transaction storage.</span>
      </aside>
    </header>

    <section class="import-panel" aria-labelledby="import-title">
      <div>
        <h2 id="import-title">Import File</h2>
        <p>CSV and Excel files are parsed locally, then paused for mapping review before calculations render.</p>
      </div>
      <div class="actions">
        <label class="file-button">
          <input id="csv-file" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" />
          Choose File
        </label>
        <label class="sample-picker">
          <span>Sample</span>
          <select id="sample-select">
            ${SAMPLE_DATASETS.map(
              (sample) => `<option value="${sample.path}">${sample.label}</option>`
            ).join("")}
          </select>
        </label>
        <button id="sample-button" type="button">Load Sample</button>
        <button id="clear-button" type="button" disabled>Clear</button>
        <button id="reference-button" type="button" aria-expanded="false">Formulas</button>
      </div>
      <p id="status" class="status" role="status">Waiting for a CSV or Excel file.</p>
    </section>

    <section id="reference-panel" class="reference-panel" aria-label="Formula reference" hidden></section>
    <section id="results" class="results" aria-live="polite"></section>
  </section>
`;

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

  status.textContent = `Reading ${file.name} locally...`;
  const loaded = await loadImportFile(file);
  if (loaded.kind === "excel") {
    renderWorksheetPicker(file.name, loaded.sheets);
    return;
  }
  renderMappingReview(loaded.result, file.name, loaded.source);
});

sampleButton.addEventListener("click", async () => {
  const sample = SAMPLE_DATASETS.find((item) => item.path === sampleSelect.value) ?? SAMPLE_DATASETS[0];
  status.textContent = `Loading ${sample.label.toLowerCase()} sample CSV...`;
  const response = await fetch(sample.path);
  const text = await response.text();
  renderMappingReview(importTransactionsFromCsv(text), sample.path.replace(/^\//, ""), text);
});

clearButton.addEventListener("click", () => {
  activeImport = null;
  draftImport = null;
  activeFilters = { ...DEFAULT_FILTERS };
  activeTrendGrain = "monthly";
  activeReviewPreset = "all";
  selectedTransactionId = "";
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

function renderWorksheetPicker(sourceName: string, sheets: ParsedExcelSheet[]): void {
  activeImport = null;
  draftImport = null;
  activeFilters = { ...DEFAULT_FILTERS };
  activeTrendGrain = "monthly";
  activeReviewPreset = "all";
  selectedTransactionId = "";
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
  activeFilters = { ...DEFAULT_FILTERS };
  activeTrendGrain = "monthly";
  activeReviewPreset = "all";
  selectedTransactionId = "";
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
  const baseFilteredRecords = filterTransactions(result.records, activeFilters);
  const baseSummary = summarizeTransactions(
    baseFilteredRecords,
    result.rejectedRows,
    readCashOnHand(),
    activeTrendGrain
  );
  const filteredRecords = applyReviewPreset(baseFilteredRecords, baseSummary);
  const summary = summarizeTransactions(
    filteredRecords,
    result.rejectedRows,
    readCashOnHand(),
    activeTrendGrain
  );
  if (!filteredRecords.some((record) => record.id === selectedTransactionId)) {
    selectedTransactionId = filteredRecords[0]?.id ?? "";
  }
  const selectedRecord = filteredRecords.find((record) => record.id === selectedTransactionId) ?? null;
  const eventInputValue = readFutureEventsText();
  const parsedEvents = parseFutureCashEvents(eventInputValue);
  const forecast = {
    ...build13WeekForecast(filteredRecords, readCashOnHand(), parsedEvents.events),
    rejectedEvents: parsedEvents.rejectedEvents
  };
  status.textContent = `${sourceName}: ${result.records.length} transaction records ready, ${result.rejectedRows.length} rejected.`;
  results.innerHTML = `
    <section class="filter-panel" aria-labelledby="filter-title">
      <div>
        <h2 id="filter-title">Dashboard Filters</h2>
        <p>Filters update visible analysis only. CSV and reviewer exports keep the full reviewed import.</p>
      </div>
      <div class="filter-editor">
        ${filterSelect("Flow", "flow", flowOptions(result.records), activeFilters.flow)}
        ${filterSelect("Account", "account", optionValues(result.records, "account"), activeFilters.account)}
        ${filterSelect("Head", "head", optionValues(result.records, "head"), activeFilters.head)}
        ${filterSelect(
          "Subcategory",
          "subcategory",
          optionValues(result.records, "subcategory"),
          activeFilters.subcategory
        )}
        ${filterSelect(
          "Counterparty",
          "counterparty",
          optionValues(result.records, "counterparty"),
          activeFilters.counterparty
        )}
        <label>
          From
          <input data-date-filter-key="dateFrom" type="date" value="${escapeHtml(activeFilters.dateFrom)}" />
        </label>
        <label>
          To
          <input data-date-filter-key="dateTo" type="date" value="${escapeHtml(activeFilters.dateTo)}" />
        </label>
        <label>
          Trend
          <select id="trend-grain">
            ${trendGrainOption("daily", activeTrendGrain)}
            ${trendGrainOption("weekly", activeTrendGrain)}
            ${trendGrainOption("monthly", activeTrendGrain)}
          </select>
        </label>
      </div>
      <div class="filter-summary">
        <span>${filteredRecords.length} of ${result.records.length} record${
          result.records.length === 1 ? "" : "s"
        } shown${activeReviewPreset === "all" ? "" : ` · ${escapeHtml(reviewPresetLabel(activeReviewPreset))}`}</span>
        <button id="reset-filters" type="button">Reset</button>
      </div>
      <div class="preset-chips" aria-label="Common review views">
        ${reviewPresetButton("all", "All", activeReviewPreset)}
        ${reviewPresetButton("revenue", "Revenue", activeReviewPreset)}
        ${reviewPresetButton("outflow", "Outflow", activeReviewPreset)}
        ${reviewPresetButton(
          "duplicates",
          `Duplicates (${baseSummary.diagnostics.duplicateGroups.length})`,
          activeReviewPreset,
          !baseSummary.diagnostics.duplicateGroups.length
        )}
        ${reviewPresetButton(
          "transfers",
          `Transfers (${baseSummary.diagnostics.transferCandidates.length})`,
          activeReviewPreset,
          !baseSummary.diagnostics.transferCandidates.length
        )}
      </div>
    </section>
    <div class="summary-grid">
      ${metricCard("Records", String(summary.transactionCount))}
      ${metricCard("Revenue", formatMoney(summary.revenue))}
      ${metricCard("Outflow", formatMoney(summary.outflow))}
      ${metricCard("Net Cash", formatMoney(summary.netCash))}
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
        ${metricCard("Avg Monthly Burn", formatMoney(summary.cashHealth.averageMonthlyOutflow))}
        ${metricCard("Runway", formatRunway(summary.cashHealth.runwayMonths))}
        ${metricCard("Revenue Concentration", `${Math.round(summary.cashHealth.revenueConcentration * 100)}%`)}
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
        <button id="print-report" type="button">Print Report</button>
      </div>
    </section>
    ${renderPrintableReport({
      sourceName,
      summary,
      forecast,
      visibleRecords: filteredRecords,
      reviewPresetLabel: reviewPresetLabel(activeReviewPreset),
      activeFilters,
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
        <span>${escapeHtml(formatMoney(forecast.averageWeeklyNet))} avg weekly net</span>
      </div>
      <textarea id="future-events" rows="3" placeholder="2026-04-15, -1200, quarterly tax&#10;2026-05-01, 3000, client payment">${escapeHtml(
        eventInputValue
      )}</textarea>
      ${renderForecast(forecast, formatMoney)}
    </section>
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
          <span>${summary.accountBalances.length} account${
            summary.accountBalances.length === 1 ? "" : "s"
          }</span>
        </div>
        ${renderAccountBalances(summary.accountBalances, formatMoney)}
      </section>
      <section class="table-panel" aria-labelledby="subcategories-title">
        <div class="panel-heading">
          <h2 id="subcategories-title">Subcategories</h2>
          <span>${summary.topSubcategories.length} drilldown${
            summary.topSubcategories.length === 1 ? "" : "s"
          }</span>
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
    <section class="table-panel diagnostics-panel" aria-labelledby="diagnostics-title">
      <div class="panel-heading">
        <h2 id="diagnostics-title">Duplicate & Transfer Checks</h2>
        <span>${summary.diagnostics.duplicateGroups.length} duplicate, ${
          summary.diagnostics.transferCandidates.length
        } transfer</span>
      </div>
      ${renderDiagnostics(summary, formatMoney)}
    </section>
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
  bindDashboardFilters();
  bindLiveInputs();
  bindExportButton(summary, filteredRecords);
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

function applyReviewPreset(records: TransactionRecord[], baseSummary: FinanceSummary): TransactionRecord[] {
  if (activeReviewPreset === "revenue") return records.filter((record) => record.flow === "revenue");
  if (activeReviewPreset === "outflow") return records.filter((record) => record.flow === "outflow");
  if (activeReviewPreset === "duplicates") {
    const duplicateIds = new Set(
      baseSummary.diagnostics.duplicateGroups.flatMap((group) => group.records.map((record) => record.id))
    );
    return records.filter((record) => duplicateIds.has(record.id));
  }
  if (activeReviewPreset === "transfers") {
    const transferIds = new Set(
      baseSummary.diagnostics.transferCandidates.flatMap((candidate) => [
        candidate.outflowId,
        candidate.revenueId
      ])
    );
    return records.filter((record) => transferIds.has(record.id));
  }
  return records;
}

function reviewPresetLabel(preset: ReviewPreset): string {
  const labels: Record<ReviewPreset, string> = {
    all: "all records",
    revenue: "revenue only",
    outflow: "outflow only",
    duplicates: "possible duplicates",
    transfers: "possible transfers"
  };
  return labels[preset];
}

function flowOptions(records: TransactionRecord[]): string[] {
  return optionValues(records, "flow");
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
      activeFilters = { ...activeFilters, [key]: select.value };
      renderImportResult(activeImport.result, activeImport.sourceName);
      document.querySelector<HTMLSelectElement>(`[data-filter-key="${key}"]`)?.focus();
    });
  });
  document.querySelectorAll<HTMLInputElement>("[data-date-filter-key]").forEach((input) => {
    input.addEventListener("change", () => {
      if (!activeImport) return;

      const key = input.dataset.dateFilterKey as "dateFrom" | "dateTo" | undefined;
      if (!key) return;
      activeFilters = { ...activeFilters, [key]: input.value };
      renderImportResult(activeImport.result, activeImport.sourceName);
      document.querySelector<HTMLInputElement>(`[data-date-filter-key="${key}"]`)?.focus();
    });
  });
  document.querySelector<HTMLSelectElement>("#trend-grain")?.addEventListener("change", (event) => {
    if (!activeImport) return;

    const value = (event.target as HTMLSelectElement).value;
    if (value !== "daily" && value !== "weekly" && value !== "monthly") return;
    activeTrendGrain = value;
    renderImportResult(activeImport.result, activeImport.sourceName);
    document.querySelector<HTMLSelectElement>("#trend-grain")?.focus();
  });

  document.querySelector<HTMLButtonElement>("#reset-filters")?.addEventListener("click", () => {
    if (!activeImport) return;

    activeFilters = { ...DEFAULT_FILTERS };
    activeReviewPreset = "all";
    renderImportResult(activeImport.result, activeImport.sourceName);
    document.querySelector<HTMLButtonElement>("#reset-filters")?.focus();
  });
  document.querySelectorAll<HTMLButtonElement>("[data-review-preset]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!activeImport) return;

      const preset = button.dataset.reviewPreset;
      if (
        preset !== "all" &&
        preset !== "revenue" &&
        preset !== "outflow" &&
        preset !== "duplicates" &&
        preset !== "transfers"
      ) {
        return;
      }
      activeReviewPreset = preset;
      renderImportResult(activeImport.result, activeImport.sourceName);
      document.querySelector<HTMLButtonElement>(`[data-review-preset="${preset}"]`)?.focus();
    });
  });
}

function bindTransactionPreview(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-transaction-id]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!activeImport) return;

      selectedTransactionId = button.dataset.transactionId ?? "";
      renderImportResult(activeImport.result, activeImport.sourceName);
      document.querySelector<HTMLButtonElement>(`[data-transaction-id="${selectedTransactionId}"]`)?.focus();
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
        activeTrendGrain
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
      monthlyTrendCsvFilename(activeImport.sourceName, new Date(), activeTrendGrain),
      buildMonthlyTrendCsv(visibleSummary.periodTrend),
      "text/csv;charset=utf-8"
    );
  });
  document.querySelector<HTMLButtonElement>("#export-trend-svg")?.addEventListener("click", () => {
    if (!activeImport) return;
    downloadText(
      trendSvgFilename(activeImport.sourceName, new Date(), activeTrendGrain),
      buildTrendSvg(visibleSummary.periodTrend, {
        title: `${trendGrainLabel(activeTrendGrain)} Trend`,
        subtitle: `${activeImport.sourceName} · ${reviewPresetLabel(activeReviewPreset)}`,
        currency: settings.currency
      }),
      "image/svg+xml;charset=utf-8"
    );
  });
  document.querySelector<HTMLButtonElement>("#print-report")?.addEventListener("click", () => {
    window.print();
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
