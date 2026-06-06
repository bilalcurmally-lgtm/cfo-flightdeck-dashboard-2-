import "./styles.css";
import type {
  CsvImportResult,
  TransactionRecord
} from "./finance/types";
import type { FinanceSummary } from "./finance/summary";
import { buildDashboardView } from "./finance/dashboard-view";
import {
  applyClassificationOverrides,
  type ClassificationOverride
} from "./finance/classification-overrides";
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
import { buildReviewDrawerItems, deriveExcludedTransactionIdsFromQueue } from "./ui/review-queue";
import type { ReviewDrawerItem } from "./ui/review-drawer";
import { createInMemoryWorkspaceStore, type WorkspaceStore } from "./workspace/workspace-store";
import { createIndexedDbWorkspaceStore } from "./workspace/indexeddb-workspace-store";
import {
  buildSignatureIndex,
  restoreOverrides,
  restoreReviewExclusions,
  persistOverride,
  clearPersistedOverride,
  persistReviewDecision,
  type SignatureIndex
} from "./workspace/persistence-bridge";
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
import { bindProjectFileActions } from "./ui/project-file-actions";

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
// In-session Type/Group recategorizations (C2). Pure & reversible: dropping an
// entry restores the original classification.
const classificationOverrides = new Map<string, ClassificationOverride>();
// Rows the user marked "Looks right" without changing them — cleared from the
// category-review queue without an override.
const confirmedCategoryIds = new Set<string>();

// D1 persistence. The store starts in-memory and is upgraded to the durable
// IndexedDB-backed store once it opens; `storeReady` gates restore on that.
// `signatureIndex` bridges the active ledger's volatile record ids to the
// reload-stable signatures that everything is persisted under.
let workspaceStore: WorkspaceStore = createInMemoryWorkspaceStore();
const storeReady: Promise<void> = createIndexedDbWorkspaceStore()
  .then((durable) => {
    workspaceStore = durable.store;
  })
  .catch(() => {
    // Keep the in-memory fallback; persistence silently degrades.
  });
let signatureIndex: SignatureIndex | null = null;
let currentReviewItems: ReviewDrawerItem[] = [];

document.querySelector<HTMLDivElement>("#app")!.innerHTML = renderAppShell(SAMPLE_DATASETS);

const fileInput = document.querySelector<HTMLInputElement>("#csv-file")!;
const clearButton = document.querySelector<HTMLButtonElement>("#clear-button")!;
const saveProjectButton = document.querySelector<HTMLButtonElement>("#save-project")!;
const openProjectButton = document.querySelector<HTMLButtonElement>("#open-project")!;
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

bindProjectFileActions({
  status,
  getStore: () => workspaceStore,
  onLoaded: () => {
    // Re-apply the freshly loaded workspace to the active import (if any).
    if (activeImport) void activateImportResult(activeImport.result, activeImport.sourceName);
  }
});

function setProjectActionsEnabled(enabled: boolean): void {
  saveProjectButton.disabled = !enabled;
  openProjectButton.disabled = !enabled;
}

clearButton.addEventListener("click", () => {
  activeImport = null;
  draftImport = null;
  resetDashboardViewState();
  reviewExcludedItemIds.clear();
  classificationOverrides.clear();
  confirmedCategoryIds.clear();
  // Drop the per-ledger index; persisted signatures are intentionally kept so
  // re-importing the same file restores its overrides and review decisions.
  signatureIndex = null;
  currentReviewItems = [];
  fileInput.value = "";
  paintPreImport();
  status.textContent = "Import cleared. Waiting for a CSV or Excel file.";
  clearButton.disabled = true;
  setProjectActionsEnabled(false);
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
  setProjectActionsEnabled(false);
  const message = error instanceof Error ? error.message : "Unknown import error.";
  status.textContent = `${sourceName}: could not read this import. ${message}`;
}

function renderWorksheetPicker(sourceName: string, sheets: ParsedExcelSheet[]): void {
  activeImport = null;
  draftImport = null;
  resetDashboardViewState();
  reviewExcludedItemIds.clear();
  classificationOverrides.clear();
  confirmedCategoryIds.clear();
  clearButton.disabled = false;
  setProjectActionsEnabled(false);

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
  classificationOverrides.clear();
  confirmedCategoryIds.clear();
  clearButton.disabled = false;
  setProjectActionsEnabled(false);

  status.textContent = `${sourceName}: review detected columns before calculations render.`;
  results.innerHTML = renderMappingReviewPanel(
    result,
    analyzeImportReadiness(result.rawRows, result.mapping, result.dateFormat)
  );
  bindMappingReview();
}

function renderImportResult(
  result: CsvImportResult,
  sourceName: string,
  options: { reopenReviewItemId?: string; reopenCategoryItemId?: string } = {}
): void {
  activeImport = { result, sourceName };
  draftImport = null;
  clearButton.disabled = false;
  setProjectActionsEnabled(true);
  const view = buildDashboardView({
    result,
    filters: viewState.filters,
    trendGrain: viewState.trendGrain,
    reviewPreset: viewState.reviewPreset,
    selectedTransactionId: viewState.selectedTransactionId,
    cashOnHand: readCashOnHand(),
    futureEventsText: readFutureEventsText(),
    overrides: classificationOverrides,
    deriveExcludedTransactionIds: (reviewSummary) =>
      deriveExcludedTransactionIdsFromQueue({
        summary: reviewSummary,
        rejectedRows: result.rejectedRows,
        excludedReviewItemIds: reviewExcludedItemIds,
        formatMoney
      })
  });
  const excludedTransactionIds = view.excludedTransactionIds ?? [];
  // Keep the current review items so a toggle can be mapped back to its
  // reload-stable signature for persistence.
  currentReviewItems = buildReviewDrawerItems({
    summary: view.reviewSummary,
    rejectedRows: result.rejectedRows,
    excludedReviewItemIds: reviewExcludedItemIds,
    formatMoney
  });
  // Rows confirmed "Looks right" leave the queue/tile — UNLESS they still carry an
  // active override, so the user can always reach Reset (P2: confirm-then-stuck).
  const visibleCategoryItems = view.categoryReview.items.filter(
    (item) => !confirmedCategoryIds.has(item.id) || classificationOverrides.has(item.id)
  );
  const displayView = {
    ...view,
    categoryReview: { items: visibleCategoryItems }
  };
  if (view.selectedTransactionId !== viewState.selectedTransactionId) {
    viewState = selectTransaction(viewState, view.selectedTransactionId);
  }
  status.textContent = `${sourceName}: ${result.records.length} transaction records ready, ${result.rejectedRows.length} rejected.`;
  results.innerHTML = renderDashboardResults({
    result,
    sourceName,
    view: displayView,
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
    reopenReviewItemId: options.reopenReviewItemId,
    reopenCategoryItemId: options.reopenCategoryItemId,
    onReviewDecision: (decision) => {
      if (decision.excluded) reviewExcludedItemIds.add(decision.itemId);
      else reviewExcludedItemIds.delete(decision.itemId);
      const item = currentReviewItems.find((candidate) => candidate.id === decision.itemId);
      if (item && signatureIndex) {
        persistReviewDecision(workspaceStore, signatureIndex, item, decision.excluded);
      }
      renderImportResult(result, sourceName, { reopenReviewItemId: decision.itemId });
    },
    onRecategorize: (id, patch) => {
      const override = { ...classificationOverrides.get(id), ...patch };
      classificationOverrides.set(id, override);
      confirmedCategoryIds.delete(id);
      if (signatureIndex) persistOverride(workspaceStore, signatureIndex, id, override);
      renderImportResult(result, sourceName, { reopenCategoryItemId: id });
    },
    onConfirmCategory: (id) => {
      confirmedCategoryIds.add(id);
      renderImportResult(result, sourceName, { reopenCategoryItemId: id });
    },
    onResetCategory: (id) => {
      classificationOverrides.delete(id);
      confirmedCategoryIds.delete(id);
      if (signatureIndex) clearPersistedOverride(workspaceStore, signatureIndex, id);
      renderImportResult(result, sourceName, { reopenCategoryItemId: id });
    }
  });
  bindLiveInputs();
  // Export reflects in-session Type/Group edits (overridden records); non-operating
  // rows stay because they are not in excludedTransactionIds. The full-ledger
  // export gets every row with overrides applied (no removal); the reviewer report
  // gets overrides + review-exclusions removed.
  bindExportButton(
    view.summary,
    view.filteredRecords,
    reviewedImportResult(result, classificationOverrides, excludedTransactionIds),
    applyClassificationOverrides(result.records, classificationOverrides)
  );
  bindTransactionPreview();
}

function resetDashboardViewState(): void {
  viewState = createDashboardViewState();
}

function bindMappingReview(): void {
  bindImportReviewActions({
    getDraftImport: () => draftImport,
    renderImportResult: (result, sourceName) => {
      void activateImportResult(result, sourceName);
    }
  });
}

// Entry point for a freshly confirmed import: sign the ledger, restore any
// persisted overrides + review exclusions for matching signatures, THEN render.
// Re-renders (filters, cockpit actions) call renderImportResult directly and
// reuse the signatureIndex built here.
async function activateImportResult(result: CsvImportResult, sourceName: string): Promise<void> {
  await storeReady;
  signatureIndex = buildSignatureIndex(result.records);

  const restoredOverrides = restoreOverrides(workspaceStore, signatureIndex);
  classificationOverrides.clear();
  for (const [id, override] of restoredOverrides) {
    classificationOverrides.set(id, override);
  }

  // Build the review items from the (now override-applied) ledger so stored
  // review decisions can be matched back to this import's synthetic item ids.
  const probe = buildDashboardView({
    result,
    filters: viewState.filters,
    trendGrain: viewState.trendGrain,
    reviewPreset: viewState.reviewPreset,
    selectedTransactionId: viewState.selectedTransactionId,
    cashOnHand: readCashOnHand(),
    futureEventsText: readFutureEventsText(),
    overrides: classificationOverrides
  });
  const probeItems = buildReviewDrawerItems({
    summary: probe.reviewSummary,
    rejectedRows: result.rejectedRows,
    excludedReviewItemIds: new Set<string>(),
    formatMoney
  });
  reviewExcludedItemIds.clear();
  for (const id of restoreReviewExclusions(workspaceStore, probeItems, signatureIndex)) {
    reviewExcludedItemIds.add(id);
  }

  renderImportResult(result, sourceName);
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
  reviewerResult: CsvImportResult,
  fullExportRecords: TransactionRecord[]
): void {
  bindDashboardExportActions({
    status,
    visibleSummary,
    visibleRecords,
    getActiveImport: () => activeImport,
    getReviewerExportResult: () => reviewerResult,
    getFullExportRecords: () => fullExportRecords,
    getCashOnHand: readCashOnHand,
    getFutureEventsText: readFutureEventsText,
    getTrendGrain: () => viewState.trendGrain,
    getReviewPreset: () => viewState.reviewPreset,
    getCurrency: () => settings.currency
  });
}

function reviewedImportResult(
  result: CsvImportResult,
  overrides: Map<string, ClassificationOverride>,
  excludedTransactionIds: readonly string[]
): CsvImportResult {
  if (overrides.size === 0 && excludedTransactionIds.length === 0) return result;
  const excluded = new Set(excludedTransactionIds);
  const records = applyClassificationOverrides(result.records, overrides).filter(
    (record) => !excluded.has(record.id)
  );
  return { ...result, records };
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
