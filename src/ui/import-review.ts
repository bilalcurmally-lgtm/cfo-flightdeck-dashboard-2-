import type { CsvImportResult } from "../finance/types";
import type { ImportReadiness } from "../import/validation";
import type { ParsedExcelSheet } from "../import/excel";
import { dateFormatOption, mappingSelect } from "./controls";
import { escapeHtml } from "./html";

export function renderWorksheetOption(sheet: ParsedExcelSheet, index: number): string {
  const columns = Object.keys(sheet.rows[0] || {});
  return `
    <article class="worksheet-option">
      <div class="worksheet-summary">
        <div>
          <strong>${escapeHtml(sheet.name)}</strong>
          <span>${sheet.rows.length} imported row${sheet.rows.length === 1 ? "" : "s"} · ${sheet.rawRowCount} raw row${
            sheet.rawRowCount === 1 ? "" : "s"
          }</span>
          <small>${columns.length ? escapeHtml(columns.slice(0, 6).join(", ")) : "No table-like rows detected"}</small>
        </div>
        ${renderWorksheetPreview(sheet)}
      </div>
      <button data-sheet-index="${index}" type="button"${sheet.rows.length ? "" : " disabled"}>Review Sheet</button>
    </article>
  `;
}

export function renderWorksheetPickerPanel(sheets: ParsedExcelSheet[]): string {
  return `
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
}

function renderWorksheetPreview(sheet: ParsedExcelSheet): string {
  const columns = Object.keys(sheet.rows[0] || {}).slice(0, 4);
  if (!columns.length) return `<p class="empty worksheet-empty">No preview rows available.</p>`;

  return `
    <div class="table-wrap worksheet-preview" aria-label="${escapeHtml(sheet.name)} worksheet preview">
      <table>
        <thead>
          <tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr>
        </thead>
        <tbody>
          ${sheet.rows
            .slice(0, 3)
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

export function renderRawPreview(result: CsvImportResult): string {
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

export function renderMappingReviewPanel(result: CsvImportResult, readiness: ImportReadiness): string {
  const columns = Object.keys(result.rawRows[0] || {});

  return `
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
        ${renderMappingValidation(readiness)}
      </div>
      ${renderRawPreview(result)}
    </section>
  `;
}

export function renderMappingValidation(readiness: ImportReadiness): string {
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

export function renderRejectedRows(result: CsvImportResult): string {
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
