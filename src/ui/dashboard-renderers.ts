import type { CsvImportResult, ImportedRow, TransactionRecord } from "../finance/types";
import type {
  AccountBalance,
  FinanceSummary,
  HeadSummary,
  PeriodSummary,
  QualityWarning,
  SubcategorySummary
} from "../finance/summary";
import { escapeHtml } from "./html";

type MoneyFormatter = (value: number) => string;

export function renderTransactionTable(
  records: TransactionRecord[],
  selectedTransactionId: string,
  formatMoney: MoneyFormatter
): string {
  if (!records.length) return `<p class="empty">No valid transaction rows yet.</p>`;

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Review</th>
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
                <tr class="${record.id === selectedTransactionId ? "selected-row" : ""}">
                  <td>
                    <button class="row-action" data-transaction-id="${escapeHtml(record.id)}" type="button">
                      ${record.id === selectedTransactionId ? "Open" : "View"}
                    </button>
                  </td>
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

export function renderTransactionDetail(
  record: TransactionRecord | null,
  result: CsvImportResult,
  formatMoney: MoneyFormatter
): string {
  if (!record) return `<p class="empty">Select a transaction row to inspect its normalized fields and raw source values.</p>`;

  const rawRow = result.rawRows[recordSourceIndex(record)] ?? {};
  const normalized = [
    ["Date", record.dateISO],
    ["Flow", record.flow],
    ["Amount", formatMoney(record.amount)],
    ["Signed Net", formatMoney(record.signedNet)],
    ["Head", record.head],
    ["Group", record.parent],
    ["Subcategory", record.subcategory],
    ["Counterparty", record.counterparty],
    ["Account", record.account],
    ["Running Balance", record.runningBalance === null ? "Not mapped" : formatMoney(record.runningBalance)],
    ["Description", record.description]
  ];

  return `
    <div class="transaction-detail">
      <dl class="detail-list">
        ${normalized
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
      <div>
        <h3>Raw Row</h3>
        ${renderRawRowList(rawRow)}
      </div>
    </div>
  `;
}

export function renderTrend(periods: PeriodSummary[], formatMoney: MoneyFormatter): string {
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

export function renderTopHeads(heads: HeadSummary[], formatMoney: MoneyFormatter): string {
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

export function renderAccountBalances(accounts: AccountBalance[], formatMoney: MoneyFormatter): string {
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

export function renderSubcategories(
  subcategories: SubcategorySummary[],
  formatMoney: MoneyFormatter
): string {
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

export function renderWarnings(summary: FinanceSummary): string {
  if (!summary.warnings.length) {
    return `<p class="empty">No import warnings from the current checks.</p>`;
  }

  return `
    <ul class="warning-list">
      ${summary.warnings.map((warning) => renderWarning(warning)).join("")}
    </ul>
  `;
}

export function renderDiagnostics(summary: FinanceSummary, formatMoney: MoneyFormatter): string {
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

export function renderReportTransactionTable(
  records: TransactionRecord[],
  formatMoney: MoneyFormatter
): string {
  if (!records.length) return `<p class="empty">No valid transaction rows in this view.</p>`;

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Flow</th>
            <th>Head</th>
            <th>Counterparty</th>
            <th>Description</th>
            <th class="number">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${records
            .map(
              (record) => `
                <tr>
                  <td>${escapeHtml(record.dateISO)}</td>
                  <td>${escapeHtml(record.flow)}</td>
                  <td>${escapeHtml(record.head)}</td>
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

function renderRawRowList(row: ImportedRow): string {
  const entries = Object.entries(row);
  if (!entries.length) return `<p class="empty">No raw row values found.</p>`;

  return `
    <dl class="raw-row-list">
      ${entries
        .map(
          ([key, value]) => `
            <div>
              <dt>${escapeHtml(key)}</dt>
              <dd>${escapeHtml(value || "blank")}</dd>
            </div>
          `
        )
        .join("")}
    </dl>
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

function recordSourceIndex(record: TransactionRecord): number {
  const match = record.id.match(/-(\d+)$/);
  return match ? Number(match[1]) : -1;
}

function barWidth(value: number, maxValue: number): number {
  return Math.max(3, Math.round((value / maxValue) * 100));
}
