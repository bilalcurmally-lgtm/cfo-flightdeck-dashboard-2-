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
import type { FilterableField } from "./finance/filters";
import { reviewPresetLabel } from "./finance/review-presets";
import {
  buildFilteredTransactionsCsvExport,
  buildReviewerExportReport,
  buildTransactionsCsvExport,
  buildTrendCsvExport,
  buildTrendSvgExport
} from "./export/dashboard-export-payloads";
import { reviewerReportFilename } from "./export/reviewer-report";
import { svgToPngBlob, trendPngFilename } from "./export/trend-png";
import { parseExcelWorkbook, type ParsedExcelSheet } from "./import/excel";
import { SAMPLE_DATASETS } from "./import/sample-datasets";
import { importTransactionsFromCsv, importTransactionsFromRows } from "./import/transactions";
import { analyzeImportReadiness } from "./import/validation";
import {
  clearSettings,
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  selectCashOnHand,
  selectCurrency,
  selectFutureEventsText,
  type AppSettings
} from "./store/settings";
import {
  createDashboardViewState,
  resetDashboardFilters,
  selectDashboardFilter,
  selectReviewPreset,
  selectTransaction,
  selectTrendGrain
} from "./store/view-state";
import { downloadBlob, downloadJson, downloadText } from "./ui/downloads";
import { renderAppShell } from "./ui/app-shell";
import {
  renderCashHealthPanel,
  renderCurrencyOptions,
  renderDashboardFilterPanel,
  renderDetailGrid,
  renderDiagnosticsPanel,
  renderExportPanel,
  renderForecastPanel,
  renderInsightGrid,
  renderSettingsPanel,
  renderSummaryGrid
} from "./ui/dashboard-sections";
import { formatCurrency, formatRunway } from "./ui/formatters";
import {
  renderMappingReviewPanel,
  renderMappingValidation,
  renderWorksheetPickerPanel
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
  results.innerHTML = renderWorksheetPickerPanel(sheets);

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

  status.textContent = `${sourceName}: review detected columns before calculations render.`;
  results.innerHTML = renderMappingReviewPanel(
    result,
    analyzeImportReadiness(result.rawRows, result.mapping, result.dateFormat)
  );
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
    ${renderDashboardFilterPanel({
      records: result.records,
      filteredRecordCount: view.filteredRecords.length,
      activeFilters: viewState.filters,
      activeTrendGrain: viewState.trendGrain,
      activeReviewPreset: viewState.reviewPreset,
      duplicateGroupCount: view.baseSummary.diagnostics.duplicateGroups.length,
      transferCandidateCount: view.baseSummary.diagnostics.transferCandidates.length
    })}
    ${renderSummaryGrid(view.summary, formatMoney)}
    ${renderCashHealthPanel(view.summary, readCashOnHand(), formatMoney, formatRunway)}
    ${renderExportPanel()}
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
    ${renderSettingsPanel(renderCurrencyOptions(settings.currency))}
    ${renderForecastPanel(view.forecast, view.futureEventsText, formatMoney)}
    ${renderInsightGrid(view.summary, viewState.trendGrain, formatMoney)}
    ${renderDiagnosticsPanel(view.summary, formatMoney)}
    ${renderDetailGrid(
      result,
      view.filteredRecords,
      viewState.selectedTransactionId,
      view.selectedRecord,
      formatMoney
    )}
  `;
  bindDashboardFilters();
  bindLiveInputs();
  bindExportButton(view.summary, view.filteredRecords);
  bindTransactionPreview();
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
      viewState = selectDashboardFilter(viewState, key, select.value);
      renderImportResult(activeImport.result, activeImport.sourceName);
      document.querySelector<HTMLSelectElement>(`[data-filter-key="${key}"]`)?.focus();
    });
  });
  document.querySelectorAll<HTMLInputElement>("[data-date-filter-key]").forEach((input) => {
    input.addEventListener("change", () => {
      if (!activeImport) return;

      const key = input.dataset.dateFilterKey as "dateFrom" | "dateTo" | undefined;
      if (!key) return;
      viewState = selectDashboardFilter(viewState, key, input.value);
      renderImportResult(activeImport.result, activeImport.sourceName);
      document.querySelector<HTMLInputElement>(`[data-date-filter-key="${key}"]`)?.focus();
    });
  });
  document.querySelector<HTMLSelectElement>("#trend-grain")?.addEventListener("change", (event) => {
    if (!activeImport) return;

    const value = (event.target as HTMLSelectElement).value;
    const nextViewState = selectTrendGrain(viewState, value);
    if (nextViewState === viewState) return;
    viewState = nextViewState;
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
      const nextViewState = selectReviewPreset(viewState, preset);
      if (nextViewState === viewState) return;
      viewState = nextViewState;
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
    settings = selectCashOnHand(settings, readCashOnHand());
    saveSettings(settings);
    renderImportResult(activeImport.result, activeImport.sourceName);
    document.querySelector<HTMLInputElement>("#cash-on-hand")?.focus();
  });
  eventsInput?.addEventListener("input", () => {
    if (!activeImport) return;
    const selectionStart = eventsInput.selectionStart;
    settings = selectFutureEventsText(settings, eventsInput.value);
    saveSettings(settings);
    renderImportResult(activeImport.result, activeImport.sourceName);
    const nextInput = document.querySelector<HTMLTextAreaElement>("#future-events");
    nextInput?.focus();
    nextInput?.setSelectionRange(selectionStart, selectionStart);
  });
  currencySelect?.addEventListener("change", () => {
    if (!activeImport) return;
    settings = selectCurrency(settings, currencySelect.value);
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

    downloadJson(
      reviewerReportFilename(activeImport.sourceName),
      buildReviewerExportReport({
        sourceName: activeImport.sourceName,
        result: activeImport.result,
        cashOnHand: readCashOnHand(),
        futureEventsText: readFutureEventsText(),
        trendGrain: viewState.trendGrain
      })
    );
  });
  document.querySelector<HTMLButtonElement>("#export-transactions")?.addEventListener("click", () => {
    if (!activeImport) return;
    const csv = buildTransactionsCsvExport(activeImport.sourceName, activeImport.result.records);
    downloadText(csv.filename, csv.contents, csv.mediaType);
  });
  document.querySelector<HTMLButtonElement>("#export-visible-transactions")?.addEventListener("click", () => {
    if (!activeImport) return;
    const csv = buildFilteredTransactionsCsvExport(activeImport.sourceName, visibleRecords);
    downloadText(csv.filename, csv.contents, csv.mediaType);
  });
  document.querySelector<HTMLButtonElement>("#export-trend")?.addEventListener("click", () => {
    if (!activeImport) return;
    const csv = buildTrendCsvExport(activeImport.sourceName, visibleSummary, viewState.trendGrain);
    downloadText(csv.filename, csv.contents, csv.mediaType);
  });
  document.querySelector<HTMLButtonElement>("#export-trend-svg")?.addEventListener("click", () => {
    if (!activeImport) return;
    const svg = buildTrendSvgExport(buildTrendSvgExportInput(visibleSummary));
    downloadText(svg.filename, svg.contents, svg.mediaType);
  });
  document.querySelector<HTMLButtonElement>("#export-trend-png")?.addEventListener("click", async () => {
    if (!activeImport) return;
    const button = document.querySelector<HTMLButtonElement>("#export-trend-png");
    if (button) button.disabled = true;
    try {
      const svg = buildTrendSvgExport(buildTrendSvgExportInput(visibleSummary));
      const png = await svgToPngBlob(svg.contents);
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

function buildTrendSvgExportInput(visibleSummary: FinanceSummary) {
  return {
    summary: visibleSummary,
    trendGrain: viewState.trendGrain,
    sourceName: activeImport?.sourceName ?? "Current import",
    reviewPreset: viewState.reviewPreset,
    currency: settings.currency
  };
}

function formatMoney(value: number): string {
  return formatCurrency(value, settings.currency);
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
