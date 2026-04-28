import "./styles.css";
import type {
  CsvImportResult,
  DateFormat,
  ImportedRow,
  ImportMapping,
  PeriodGrain,
  TransactionRecord
} from "./finance/types";
import type {
  AccountBalance,
  FinanceSummary,
  HeadSummary,
  PeriodSummary,
  SubcategorySummary,
  QualityWarning
} from "./finance/summary";
import type { ForecastResult, ForecastWeek } from "./finance/forecast";
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
import { parseExcel } from "./import/excel";
import { importTransactionsFromCsv, importTransactionsFromRows } from "./import/transactions";
import { analyzeImportReadiness, type ImportReadiness } from "./import/validation";
import { clearSettings, DEFAULT_SETTINGS, loadSettings, saveSettings, type AppSettings } from "./store/settings";

const SAMPLE_DATASETS = [
  { label: "Freelancer", path: "/sample-freelancer.csv" },
  { label: "Agency", path: "/sample-agency.csv" },
  { label: "Founder", path: "/sample-founder.csv" }
];

let activeImport: { result: CsvImportResult; sourceName: string } | null = null;
let draftImport:
  | { result: CsvImportResult; sourceName: string; source: string | ImportedRow[] }
  | null = null;
let settings: AppSettings = loadSettings();
let activeFilters: DashboardFilters = { ...DEFAULT_FILTERS };
let activeTrendGrain: PeriodGrain = "monthly";
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
  referencePanel.innerHTML = referenceOpen
    ? `
      <div class="panel-heading">
        <div>
          <h2>Formula Reference</h2>
          <p>Short version of the local calculations, export rules, and privacy promise.</p>
        </div>
        <span>auditable math</span>
      </div>
      <div class="reference-grid">
        <article>
          <h3>Import</h3>
          <p>Date and amount are required. Flow uses a mapped type column when available; otherwise positive values are revenue and negative values are outflow.</p>
        </article>
        <article>
          <h3>Dashboard</h3>
          <p>Revenue and outflow sum absolute amounts by flow. Net cash is revenue minus outflow. Filters change visible calculations only.</p>
        </article>
        <article>
          <h3>Cash Health</h3>
          <p>Average monthly burn is the average monthly outflow. Runway is cash on hand divided by average monthly burn.</p>
        </article>
        <article>
          <h3>Forecast</h3>
          <p>The 13-week forecast starts from cash on hand, adds average weekly net, and includes manual future cash events.</p>
        </article>
        <article>
          <h3>Exports</h3>
          <p>Transactions CSV and reviewer JSON keep the full reviewed import. Trend CSV exports the visible filtered trend.</p>
        </article>
        <article>
          <h3>Privacy</h3>
          <p>Files are parsed in the browser by default. Local settings stay in browser storage and can be cleared with site data.</p>
        </article>
      </div>
    `
    : "";
}

async function loadImportFile(
  file: File
): Promise<{ result: CsvImportResult; source: string | ImportedRow[] }> {
  if (isExcelFile(file)) {
    const rows = await parseExcel(file);
    return { result: importTransactionsFromRows(rows), source: rows };
  }

  const text = await file.text();
  return { result: importTransactionsFromCsv(text), source: text };
}

function isExcelFile(file: File): boolean {
  return /\.xlsx$/i.test(file.name) || file.type.includes("spreadsheetml");
}

function renderMappingReview(
  result: CsvImportResult,
  sourceName: string,
  source: string | ImportedRow[]
): void {
  activeImport = null;
  draftImport = { result, sourceName, source };
  activeFilters = { ...DEFAULT_FILTERS };
  activeTrendGrain = "monthly";
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
  const filteredRecords = filterTransactions(result.records, activeFilters);
  const summary = summarizeTransactions(
    filteredRecords,
    result.rejectedRows,
    readCashOnHand(),
    activeTrendGrain
  );
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
        } shown</span>
        <button id="reset-filters" type="button">Reset</button>
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
        <button id="export-reviewer" type="button">Reviewer JSON</button>
        <button id="export-trend" type="button">Trend CSV</button>
      </div>
    </section>
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
      ${renderForecast(forecast)}
    </section>
    <div class="insight-grid">
      <section class="table-panel" aria-labelledby="trend-title">
        <div class="panel-heading">
          <h2 id="trend-title">${escapeHtml(trendGrainLabel(activeTrendGrain))} Trend</h2>
          <span>${summary.periodTrend.length} period${summary.periodTrend.length === 1 ? "" : "s"}</span>
        </div>
        ${renderTrend(summary.periodTrend)}
      </section>
      <section class="table-panel" aria-labelledby="heads-title">
        <div class="panel-heading">
          <h2 id="heads-title">Top Heads</h2>
          <span>by amount</span>
        </div>
        ${renderTopHeads(summary.topHeads)}
      </section>
      <section class="table-panel" aria-labelledby="accounts-title">
        <div class="panel-heading">
          <h2 id="accounts-title">Account Balances</h2>
          <span>${summary.accountBalances.length} account${
            summary.accountBalances.length === 1 ? "" : "s"
          }</span>
        </div>
        ${renderAccountBalances(summary.accountBalances)}
      </section>
      <section class="table-panel" aria-labelledby="subcategories-title">
        <div class="panel-heading">
          <h2 id="subcategories-title">Subcategories</h2>
          <span>${summary.topSubcategories.length} drilldown${
            summary.topSubcategories.length === 1 ? "" : "s"
          }</span>
        </div>
        ${renderSubcategories(summary.topSubcategories)}
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
      ${renderDiagnostics(summary)}
    </section>
    <div class="detail-grid">
      <section class="table-panel" aria-labelledby="preview-title">
        <div class="panel-heading">
          <h2 id="preview-title">Transaction Preview</h2>
          <span>${filteredRecords.length} shown · ${escapeHtml(result.dateFormat.toUpperCase())} dates</span>
        </div>
        ${renderTransactionTable(filteredRecords)}
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
  bindExportButton(summary);
}

function metricCard(label: string, value: string): string {
  return `
    <article class="metric">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </article>
  `;
}

function mappingSelect(
  label: string,
  key: keyof ImportMapping,
  columns: string[],
  selected = "",
  required = false
): string {
  return `
    <label>
      ${escapeHtml(label)}
      <select data-mapping-key="${escapeHtml(String(key))}"${required ? " required" : ""}>
        <option value="">${required ? "Choose column" : "Not used"}</option>
        ${columns
          .map(
            (column) =>
              `<option value="${escapeHtml(column)}"${column === selected ? " selected" : ""}>${escapeHtml(
                column
              )}</option>`
          )
          .join("")}
      </select>
    </label>
  `;
}

function dateFormatOption(format: DateFormat, selected: DateFormat): string {
  const labels: Record<DateFormat, string> = {
    ymd: "YYYY-MM-DD",
    mdy: "MM/DD/YYYY",
    dmy: "DD/MM/YYYY"
  };

  return `<option value="${format}"${format === selected ? " selected" : ""}>${labels[format]}</option>`;
}

function trendGrainOption(grain: PeriodGrain, selected: PeriodGrain): string {
  return `<option value="${grain}"${grain === selected ? " selected" : ""}>${trendGrainLabel(grain)}</option>`;
}

function trendGrainLabel(grain: PeriodGrain): string {
  const labels: Record<PeriodGrain, string> = {
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly"
  };

  return labels[grain];
}

function renderRawPreview(result: CsvImportResult): string {
  const columns = Object.keys(result.rawRows[0] || {}).slice(0, 8);
  if (!columns.length) return `<p class="empty">No rows found in this CSV.</p>`;

  return `
    <div class="table-wrap mapping-preview">
      <table>
        <thead>
          <tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr>
        </thead>
        <tbody>
          ${result.rawRows
            .slice(0, 4)
            .map(
              (row) => `
                <tr>
                  ${columns.map((column) => `<td>${escapeHtml(row[column] || "")}</td>`).join("")}
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderMappingValidation(readiness: ImportReadiness): string {
  const canApply = !readiness.missingRequiredColumns.length && readiness.acceptedRows > 0;
  const coverageItems = readiness.optionalCoverage
    .map(
      (item) =>
        `<li><strong>${escapeHtml(importFieldLabel(item.key))}</strong><span>${escapeHtml(
          item.column
        )} · ${item.filledRows}/${readiness.rawRows} filled</span></li>`
    )
    .join("");

  return `
    <section class="mapping-validation ${canApply ? "ready" : "blocked"}" aria-label="Import validation">
      <div>
        <strong>${readiness.acceptedRows}/${readiness.rawRows} rows ready</strong>
        <span>${readiness.rejectedRows} row${readiness.rejectedRows === 1 ? "" : "s"} would be rejected with this mapping.</span>
      </div>
      <ul>
        ${
          readiness.missingRequiredColumns.length
            ? `<li><strong>Missing required</strong><span>${readiness.missingRequiredColumns
                .map(importFieldLabel)
                .join(", ")}</span></li>`
            : ""
        }
        <li><strong>Invalid dates</strong><span>${readiness.invalidDateRows}</span></li>
        <li><strong>Invalid amounts</strong><span>${readiness.invalidAmountRows}</span></li>
      </ul>
      ${
        coverageItems
          ? `<ol class="coverage-list">${coverageItems}</ol>`
          : `<p class="empty">Optional fields are not mapped yet.</p>`
      }
    </section>
  `;
}

function importFieldLabel(value: string): string {
  const labels: Record<string, string> = {
    date: "Date",
    amount: "Amount",
    type: "Flow / Type",
    account: "Account",
    runningBalance: "Running Balance",
    head: "Head",
    parent: "Group",
    subcategory: "Subcategory",
    counterparty: "Counterparty",
    description: "Description"
  };

  return labels[value] ?? value;
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

function filterSelect(
  label: string,
  key: FilterableField,
  values: string[],
  selected: string
): string {
  return `
    <label>
      ${escapeHtml(label)}
      <select data-filter-key="${escapeHtml(key)}">
        <option value="all">All ${escapeHtml(label.toLowerCase())}</option>
        ${values
          .map(
            (value) =>
              `<option value="${escapeHtml(value)}"${value === selected ? " selected" : ""}>${escapeHtml(
                value
              )}</option>`
          )
          .join("")}
      </select>
    </label>
  `;
}

function flowOptions(records: TransactionRecord[]): string[] {
  return optionValues(records, "flow");
}

function renderTransactionTable(records: TransactionRecord[]): string {
  if (!records.length) return `<p class="empty">No valid transaction rows yet.</p>`;

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Flow</th>
            <th>Head</th>
            <th>Subcategory</th>
            <th>Counterparty</th>
            <th>Description</th>
            <th class="number">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${records
            .slice(0, 8)
            .map(
              (record) => `
                <tr>
                  <td>${escapeHtml(record.dateISO)}</td>
                  <td><span class="pill ${record.flow}">${escapeHtml(record.flow)}</span></td>
                  <td>${escapeHtml(record.head)}</td>
                  <td>${escapeHtml(record.subcategory)}</td>
                  <td>${escapeHtml(record.counterparty)}</td>
                  <td>${escapeHtml(record.description)}</td>
                  <td class="number">${escapeHtml(formatMoney(record.amount))}</td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderTrend(periods: PeriodSummary[]): string {
  if (!periods.length) return `<p class="empty">No monthly trend yet.</p>`;

  const maxValue = Math.max(...periods.map((period) => Math.max(period.revenue, period.outflow)), 1);

  return `
    <div class="trend-list">
      ${periods
        .map(
          (period) => `
            <article class="trend-row">
              <div class="trend-meta">
                <strong>${escapeHtml(period.period)}</strong>
                <span>${escapeHtml(formatMoney(period.netCash))} net</span>
              </div>
              <div class="bars" aria-label="${escapeHtml(period.period)} revenue and outflow">
                <span class="bar revenue-bar" style="width: ${barWidth(period.revenue, maxValue)}%"></span>
                <span class="bar outflow-bar" style="width: ${barWidth(period.outflow, maxValue)}%"></span>
              </div>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderTopHeads(heads: HeadSummary[]): string {
  if (!heads.length) return `<p class="empty">No category/head totals yet.</p>`;

  return `
    <ol class="head-list">
      ${heads
        .map(
          (head) => `
            <li>
              <div>
                <strong>${escapeHtml(head.head)}</strong>
                <span>${head.count} transaction${head.count === 1 ? "" : "s"}</span>
              </div>
              <span class="pill ${head.flow}">${escapeHtml(formatMoney(head.amount))}</span>
            </li>
          `
        )
        .join("")}
    </ol>
  `;
}

function renderAccountBalances(accounts: AccountBalance[]): string {
  if (!accounts.length) return `<p class="empty">No account data in this import yet.</p>`;

  return `
    <ol class="account-list">
      ${accounts
        .map(
          (account) => `
            <li>
              <div>
                <strong>${escapeHtml(account.account)}</strong>
                <span>${account.source === "runningBalance" ? "imported balance" : "net activity"}</span>
              </div>
              <strong>${escapeHtml(formatMoney(account.balance))}</strong>
            </li>
          `
        )
        .join("")}
    </ol>
  `;
}

function renderSubcategories(subcategories: SubcategorySummary[]): string {
  if (!subcategories.length) return `<p class="empty">No subcategory data in this import yet.</p>`;

  return `
    <ol class="head-list">
      ${subcategories
        .map(
          (item) => `
            <li>
              <div>
                <strong>${escapeHtml(item.subcategory)}</strong>
                <span>${escapeHtml(item.head)} · ${item.count} transaction${
                  item.count === 1 ? "" : "s"
                }</span>
              </div>
              <span class="pill ${item.flow}">${escapeHtml(formatMoney(item.amount))}</span>
            </li>
          `
        )
        .join("")}
    </ol>
  `;
}

function renderWarnings(summary: FinanceSummary): string {
  if (!summary.warnings.length) {
    return `<p class="empty">No import warnings from the current checks.</p>`;
  }

  return `
    <ul class="warning-list">
      ${summary.warnings.map((warning) => renderWarning(warning)).join("")}
    </ul>
  `;
}

function renderDiagnostics(summary: FinanceSummary): string {
  const duplicateItems = summary.diagnostics.duplicateGroups
    .slice(0, 4)
    .map((group) => {
      const record = group.records[0];
      return `<li><strong>${escapeHtml(record.dateISO)} ${escapeHtml(record.account)}</strong><span>${escapeHtml(
        record.description
      )} · ${escapeHtml(formatMoney(record.amount))} · ${group.records.length} matches</span></li>`;
    })
    .join("");
  const transferItems = summary.diagnostics.transferCandidates
    .slice(0, 4)
    .map(
      (transfer) =>
        `<li><strong>${escapeHtml(transfer.dateISO)} ${escapeHtml(formatMoney(transfer.amount))}</strong><span>${escapeHtml(
          transfer.fromAccount
        )} to ${escapeHtml(transfer.toAccount)}</span></li>`
    )
    .join("");

  if (!duplicateItems && !transferItems) {
    return `<p class="empty">No duplicate or transfer candidates from the current checks.</p>`;
  }

  return `
    <div class="diagnostics-grid">
      <div>
        <h3>Possible Duplicates</h3>
        ${duplicateItems ? `<ul class="diagnostics-list">${duplicateItems}</ul>` : `<p class="empty">None found.</p>`}
      </div>
      <div>
        <h3>Possible Transfers</h3>
        ${transferItems ? `<ul class="diagnostics-list">${transferItems}</ul>` : `<p class="empty">None found.</p>`}
      </div>
    </div>
  `;
}

function renderWarning(warning: QualityWarning): string {
  return `
    <li class="${warning.level}">
      <strong>${escapeHtml(warning.level)}</strong>
      <span>${escapeHtml(warning.message)}</span>
    </li>
  `;
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
    renderImportResult(activeImport.result, activeImport.sourceName);
    document.querySelector<HTMLButtonElement>("#reset-filters")?.focus();
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

function bindExportButton(visibleSummary: FinanceSummary): void {
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
  document.querySelector<HTMLButtonElement>("#export-trend")?.addEventListener("click", () => {
    if (!activeImport) return;
    downloadText(
      monthlyTrendCsvFilename(activeImport.sourceName, new Date(), activeTrendGrain),
      buildMonthlyTrendCsv(visibleSummary.periodTrend),
      "text/csv;charset=utf-8"
    );
  });
}

function renderRejectedRows(result: CsvImportResult): string {
  const detected = [
    ["Date", result.mapping.date || "missing"],
    ["Amount", result.mapping.amount || "missing"],
    ["Type", result.mapping.type || "not used"],
    ["Head", result.mapping.head || "fallback"],
    ["Subcategory", result.mapping.subcategory || "fallback"],
    ["Counterparty", result.mapping.counterparty || "fallback"],
    ["Description", result.mapping.description || "fallback"]
  ];

  return `
    <dl class="mapping-list">
      ${detected
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
    ${
      result.rejectedRows.length
        ? `<ul class="issues">
            ${result.rejectedRows
              .slice(0, 5)
              .map(
                (issue) => `
                  <li>
                    <strong>Row ${issue.rowNumber}</strong>
                    <span>${escapeHtml(issue.reason)}</span>
                  </li>
                `
              )
              .join("")}
          </ul>`
        : `<p class="empty">No rejected rows in this import.</p>`
    }
  `;
}

function renderForecast(forecast: ForecastResult): string {
  const minCash = Math.min(...forecast.weeks.map((week) => week.projectedCash), 0);
  const maxCash = Math.max(...forecast.weeks.map((week) => week.projectedCash), 1);
  const range = maxCash - minCash || 1;

  return `
    ${
      forecast.rejectedEvents.length
        ? `<ul class="forecast-issues">
            ${forecast.rejectedEvents
              .map((event) => `<li>${escapeHtml(event)}</li>`)
              .join("")}
          </ul>`
        : ""
    }
    <div class="forecast-list">
      ${forecast.weeks
        .map((week) => renderForecastWeek(week, minCash, range))
        .join("")}
    </div>
  `;
}

function renderForecastWeek(week: ForecastWeek, minCash: number, range: number): string {
  const width = Math.max(4, Math.round(((week.projectedCash - minCash) / range) * 100));

  return `
    <article class="forecast-week">
      <div>
        <strong>${escapeHtml(week.weekStartISO)}</strong>
        <span>${escapeHtml(formatMoney(week.eventNet))} events</span>
      </div>
      <div class="forecast-bar-track">
        <span class="forecast-bar" style="width: ${width}%"></span>
      </div>
      <strong>${escapeHtml(formatMoney(week.projectedCash))}</strong>
    </article>
  `;
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

function downloadJson(filename: string, value: unknown): void {
  downloadText(filename, `${JSON.stringify(value, null, 2)}\n`, "application/json");
}

function downloadText(filename: string, value: string, type: string): void {
  const blob = new Blob([value], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function barWidth(value: number, maxValue: number): number {
  return Math.max(3, Math.round((value / maxValue) * 100));
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };
    return entities[char];
  });
}
