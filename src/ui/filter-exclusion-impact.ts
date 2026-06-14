import type {
  FilterExclusionDelta,
  FilterExclusionImpact
} from "../finance/metric-diagnostics";
import { escapeHtml } from "./html";

/**
 * Shows how the final visible KPI state differs from the current reviewable
 * ledger after review preset, non-operating exclusions, and review decisions.
 */
export function renderFilterExclusionImpact(
  impact: FilterExclusionImpact | null,
  formatMoney: (value: number) => string
): string {
  if (!impact) return "";

  const rows = impact.deltas.map((delta) => renderDelta(delta, formatMoney)).join("");
  return `
    <div class="bw-contributors bw-contributors--impact">
      <span class="bw-lineage__section-label">Current view impact</span>
      <p class="bw-contributors__note">${escapeHtml(recordSummary(impact.hiddenRecords))}</p>
      <ul class="bw-contributors__list">${rows}</ul>
    </div>
  `;
}

function renderDelta(
  delta: FilterExclusionDelta,
  formatMoney: (value: number) => string
): string {
  return `
    <li class="bw-contributors__row">
      <span class="bw-contributors__label">${escapeHtml(metricLabel(delta.metric))}</span>
      <span class="bw-contributors__amount">${escapeHtml(signedMoney(delta.delta, formatMoney))}</span>
      <span class="bw-contributors__share">${escapeHtml(direction(delta.delta))}</span>
    </li>
  `;
}

function metricLabel(metric: FilterExclusionDelta["metric"]): string {
  switch (metric) {
    case "revenue":
      return "Revenue";
    case "outflow":
      return "Outflow";
    case "netCash":
      return "Net cash";
  }
}

function signedMoney(value: number, formatMoney: (value: number) => string): string {
  if (value > 0) return `+${formatMoney(value)}`;
  if (value < 0) return `-${formatMoney(Math.abs(value))}`;
  return formatMoney(0);
}

function direction(value: number): string {
  if (value > 0) return "up";
  if (value < 0) return "down";
  return "flat";
}

function recordSummary(hiddenRecords: number): string {
  return hiddenRecords === 1 ? "1 row hidden" : `${hiddenRecords} rows hidden`;
}
