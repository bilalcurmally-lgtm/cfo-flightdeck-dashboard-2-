import type { DateFormat, ImportMapping, PeriodGrain } from "../finance/types";
import type { FilterableField } from "../finance/filters";
import { escapeHtml } from "./html";

export function metricCard(label: string, value: string): string {
  return `
    <article class="metric">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </article>
  `;
}

export function mappingSelect(
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

export function dateFormatOption(format: DateFormat, selected: DateFormat): string {
  const labels: Record<DateFormat, string> = {
    ymd: "YYYY-MM-DD",
    mdy: "MM/DD/YYYY",
    dmy: "DD/MM/YYYY"
  };

  return `<option value="${format}"${format === selected ? " selected" : ""}>${labels[format]}</option>`;
}

export function trendGrainOption(grain: PeriodGrain, selected: PeriodGrain): string {
  return `<option value="${grain}"${grain === selected ? " selected" : ""}>${trendGrainLabel(grain)}</option>`;
}

export function trendGrainLabel(grain: PeriodGrain): string {
  const labels: Record<PeriodGrain, string> = {
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly"
  };
  return labels[grain];
}

export function filterSelect(
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

export function reviewPresetButton(
  preset: string,
  label: string,
  activePreset: string,
  disabled = false
): string {
  return `
    <button
      class="preset-chip ${preset === activePreset ? "active" : ""}"
      data-review-preset="${preset}"
      type="button"
      aria-pressed="${preset === activePreset}"
      ${disabled ? "disabled" : ""}
    >
      ${escapeHtml(label)}
    </button>
  `;
}
