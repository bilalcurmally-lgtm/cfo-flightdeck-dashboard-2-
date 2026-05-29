import "./styles.css";
import type {
  CsvImportResult,
  TransactionRecord
} from "./finance/types";
import { summarizeTransactions, type FinanceSummary } from "./finance/summary";
import { buildDashboardView } from "./finance/dashboard-view";
import { reviewPresetLabel } from "./finance/review-presets";
import { parseExcelWorkbook, type ParsedExcelSheet } from "./import/excel";
import { classifyImportFile } from "./import/files";
import { SAMPLE_DATASETS } from "./import/sample-datasets";
import { buildNorthstarWorkbookBlob } from "./import/excel-test-fixtures";
import { importTransactionsFromCsv, importTransactionsFromRows } from "./import/transactions";
import { analyzeImportReadiness } from "./import/validation";
import {
  loadSettings,
  type AppSettings
} from "./store/settings";
import {
  createDashboardViewState,
  selectTransaction,
  type DashboardViewState
} from "./store/view-state";
import { renderAppShell } from "./ui/app-shell";
import { renderCurrencyOptions } from "./ui/dashboard-sections";
import { renderPreImportPanel } from "./ui/dashboard-renderers";
import { renderDashboardResults } from "./ui/dashboard-results";
import { formatCurrency, formatRunway } from "./ui/formatters";
import { deriveExcludedTransactionIdsFromQueue } from "./ui/review-queue";
import {
  readCashOnHand as readCashOnHandInput,
  readFutureEventsText as readFutureEventsTextInput
} from "./ui/dashboard-settings-form";
import { bindDashboardSettingsActions } from "./ui/dashboard-settings-actions";
import { bindDashboardFilterActions } from "./ui/dashboard-filter-actions";
import { bindDashboardExportActions } from "./ui/dashboard-export-actions";
import { bindDashboardCockpitActions } from "./ui/dashboard-cockpit-actions";
import {
  renderMappingReviewPanel,
  renderWorksheetPickerPanel
} from "./ui/import-review";
import { bindImportReviewActions, type ImportReviewSource } from "./ui/import-review-actions";
import { bindWorksheetPickerActions } from "./ui/worksheet-picker-actions";
import { bindTransactionPreviewActions } from "./ui/transaction-preview-actions";
import { renderReferencePanelContent } from "./ui/reference";
import { bindPreImportActions } from "./ui/pre-import-actions";

type LoadedImportFile =
  | { kind: "csv"; result: CsvImportResult; source: string }
  | { kind: "excel"; sheets: ParsedExcelSheet[] };

let activeImport: { result: CsvImportResult; sourceName: string } | null = null;
let draftImport:
  | { result: CsvImportResult; sourceName: string; source: ImportReviewSource }
  | null = null;
let settings: AppSettings = loadSettings();
let viewState = createDashboardViewState();
let referenceOpen = false;
const reviewExcludedItemIds = new Set<string>();

document.querySelector<HTMLDivElement>("#app")!.innerHTML = renderAppShell(SAMPLE_DATASETS);

const fileInput = document.querySelector<HTMLInputElement>("#csv-file")!;
const clearButton = document.querySelector<HTMLButtonElement>("#clear-button")!;
const referenceButton = document.querySelector<HTMLButtonElement>("#reference-button")!;
const referencePanel = document.querySelector<HTMLElement>("#reference-panel")!;
const status = document.querySelector<HTMLParagraphElement>("#status")!;
const results = document.querySelector<HTMLElement>("#results")!;

paintPreImport();

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

bindPreImportActions({
  openFilePicker,
  loadNorthstarDemo,
  loadSelectedSample
});

clearButton.addEventListener("click", () => {
  activeImport = null;
  draftImport = null;
  resetDashboardViewState();
  reviewExcludedItemIds.clear();
  fileInput.value = "";
  paintPreImport();
  status.textContent = "Import cleared. Waiting for a CSV or Excel file.";
  clearButton.disabled = true;
});

referenceButton.addEventListener("click", () => {
  referenceOpen = !referenceOpen;
  renderReferencePanel();
});

function openFilePicker(): void {
  fileInput.click();
}

async function loadSelectedSample(samplePath?: string): Promise<void> {
  const sample = SAMPLE_DATASETS.find((item) => item.path === samplePath) ?? SAMPLE_DATASETS[0];
  try {
    status.textContent = `Loading ${sample.label.toLowerCase()} sample CSV...`;
    const response = await fetch(sample.path);
    if (!response.ok) throw new Error(`Sample request failed with ${response.status}.`);
    const text = await response.text();
    renderMappingReview(importTransactionsFromCsv(text), sample.path.replace(/^\//, ""), text);
  } catch (error) {
    showImportError(sample.label, error);
  }
}

async function loadNorthstarDemo(): Promise<void> {
  try {
    status.textContent = "Building Northstar Excel demo locally...";
    const sheets = await parseExcelWorkbook(buildNorthstarWorkbookBlob());
    renderWorksheetPicker("northstar-trading-demo.xlsx", sheets);
  } catch (error) {
    showImportError("Northstar Excel demo", error);
  }
}

function paintPreImport(): void {
  results.innerHTML = renderPreImportPanel(SAMPLE_DATASETS);
}

function renderReferencePanel(): void {
  referenceButton.setAttribute("aria-expanded", String(referenceOpen));
  referencePanel.hidden = !referenceOpen;
  referencePanel.innerHTML = referenceOpen ? renderReferencePanelContent() : "";
}

async function loadImportFile(file: File): Promise<LoadedImportFile> {
  if (classifyImportFile(file) === "xlsx") {
    return { kind: "excel", sheets: await parseExcelWorkbook(file) };
  }

  const text = await file.text();
  return { kind: "csv", result: importTransactionsFromCsv(text), source: text };
}

function showImportError(sourceName: string, error: unknown): void {
  activeImport = null;
  draftImport = null;
  paintPreImport();
  clearButton.disabled = true;
  const message = error instanceof Error ? error.message : "Unknown import error.";
  status.textContent = `${sourceName}: could not read this import. ${message}`;
}

function renderWorksheetPicker(sourceName: string, sheets: ParsedExcelSheet[]): void {
  activeImport = null;
  draftImport = null;
  resetDashboardViewState();
  reviewExcludedItemIds.clear();
  clearButton.disabled = false;

  if (sheets.length === 1) {
    const sheet = sheets[0];
    renderMappingReview(importTransactionsFromRows(sheet.rows), `${sourceName} / ${sheet.name}`, sheet.rows);
    return;
  }

  status.textContent = `${sourceName}: choose the worksheet to import before mapping review.`;
  results.innerHTML = renderWorksheetPickerPanel(sheets);
  bindWorksheetPickerActions({
    sourceName,
    sheets,
    renderMappingReview
  });
}

function renderMappingReview(
  result: CsvImportResult,
  sourceName: string,
  source: ImportReviewSource
): void {
  activeImport = null;
  draftImport = { result, sourceName, source };
  resetDashboardViewState();
  reviewExcludedItemIds.clear();
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
  const fullReviewSummary = summarizeTransactions(
    result.records,
    result.rejectedRows,
    readCashOnHand(),
    viewState.trendGrain
  );
  const excludedTransactionIds = deriveExcludedTransactionIdsFromQueue({
    summary: fullReviewSummary,
    rejectedRows: result.rejectedRows,
    excludedReviewItemIds: reviewExcludedItemIds,
    formatMoney
  });
  const view = buildDashboardView({
    result,
    filters: viewState.filters,
    trendGrain: viewState.trendGrain,
    reviewPreset: viewState.reviewPreset,
    selectedTransactionId: viewState.selectedTransactionId,
    cashOnHand: readCashOnHand(),
    futureEventsText: readFutureEventsText(),
    excludedTransactionIds
  });
  if (view.selectedTransactionId !== viewState.selectedTransactionId) {
    viewState = selectTransaction(viewState, view.selectedTransactionId);
  }
  status.textContent = `${sourceName}: ${result.records.length} transaction records ready, ${result.rejectedRows.length} rejected.`;
  results.innerHTML = renderDashboardResults({
    result,
    sourceName,
    view,
    activeFilters: viewState.filters,
    activeTrendGrain: viewState.trendGrain,
    activeReviewPreset: viewState.reviewPreset,
    reviewPresetLabel: reviewPresetLabel(viewState.reviewPreset),
    currencyOptionsHtml: renderCurrencyOptions(settings.currency),
    cashOnHand: readCashOnHand(),
    excludedTransactionIds,
    excludedReviewItemIds: [...reviewExcludedItemIds],
    formatMoney,
    formatRunway
  });
  bindDashboardFilters();
  bindDashboardCockpitActions({
    onReviewDecision: (decision) => {
      if (decision.excluded) reviewExcludedItemIds.add(decision.itemId);
      else reviewExcludedItemIds.delete(decision.itemId);
      renderImportResult(result, sourceName);
    }
  });
  bindLiveInputs();
  bindExportButton(view.summary, view.filteredRecords, reviewedImportResult(result, excludedTransactionIds));
  bindTransactionPreview();
}

function resetDashboardViewState(): void {
  viewState = createDashboardViewState();
}

function bindMappingReview(): void {
  bindImportReviewActions({
    getDraftImport: () => draftImport,
    renderImportResult
  });
}

function bindDashboardFilters(): void {
  bindDashboardFilterActions({
    getActiveImport: () => activeImport,
    getViewState: () => viewState,
    setViewState: (nextViewState: DashboardViewState) => {
      viewState = nextViewState;
    },
    renderActiveImport: (nextActiveImport) => {
      renderImportResult(nextActiveImport.result, nextActiveImport.sourceName);
    }
  });
}

function bindTransactionPreview(): void {
  bindTransactionPreviewActions({
    getActiveImport: () => activeImport,
    getViewState: () => viewState,
    setViewState: (nextViewState: DashboardViewState) => {
      viewState = nextViewState;
    },
    renderActiveImport: (nextActiveImport) => {
      renderImportResult(nextActiveImport.result, nextActiveImport.sourceName);
    }
  });
}

function bindLiveInputs(): void {
  bindDashboardSettingsActions({
    getActiveImport: () => activeImport,
    getSettings: () => settings,
    setSettings: (nextSettings: AppSettings) => {
      settings = nextSettings;
    },
    renderActiveImport: (nextActiveImport) => {
      renderImportResult(nextActiveImport.result, nextActiveImport.sourceName);
    }
  });
}

function bindExportButton(
  visibleSummary: FinanceSummary,
  visibleRecords: TransactionRecord[],
  reviewerResult: CsvImportResult
): void {
  bindDashboardExportActions({
    status,
    visibleSummary,
    visibleRecords,
    getActiveImport: () => activeImport,
    getReviewerExportResult: () => reviewerResult,
    getCashOnHand: readCashOnHand,
    getFutureEventsText: readFutureEventsText,
    getTrendGrain: () => viewState.trendGrain,
    getReviewPreset: () => viewState.reviewPreset,
    getCurrency: () => settings.currency
  });
}

function reviewedImportResult(
  result: CsvImportResult,
  excludedTransactionIds: readonly string[]
): CsvImportResult {
  if (excludedTransactionIds.length === 0) return result;
  const excluded = new Set(excludedTransactionIds);
  return {
    ...result,
    records: result.records.filter((record) => !excluded.has(record.id))
  };
}

function formatMoney(value: number): string {
  return formatCurrency(value, settings.currency);
}

function readCashOnHand(): number {
  return readCashOnHandInput(document, settings.cashOnHand);
}

function readFutureEventsText(): string {
  return readFutureEventsTextInput(document, settings.futureEventsText);
}
