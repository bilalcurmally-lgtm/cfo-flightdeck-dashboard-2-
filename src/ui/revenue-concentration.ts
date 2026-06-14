import type {
  RevenueConcentration,
  RevenueConcentrationItem
} from "../finance/metric-diagnostics";
import { escapeHtml } from "./html";

/**
 * Adds revenue dependency context to the revenue audit drawer. Pure and escaped;
 * renders nothing for ledgers without revenue.
 */
export function renderRevenueConcentration(
  concentration: RevenueConcentration,
  formatMoney: (value: number) => string
): string {
  if (concentration.total === 0) return "";

  return `
    <div class="bw-contributors">
      <span class="bw-lineage__section-label">Revenue concentration</span>
      <div class="bw-contributors__columns">
        ${renderColumn("Top head", concentration.heads, formatMoney)}
        ${renderColumn("Top counterparty", concentration.counterparties, formatMoney)}
      </div>
    </div>
  `;
}

function renderColumn(
  title: string,
  items: readonly RevenueConcentrationItem[],
  formatMoney: (value: number) => string
): string {
  if (items.length === 0) return "";
  const rows = items
    .map(
      (item) => `
        <li class="bw-contributors__row">
          <span class="bw-contributors__label">${escapeHtml(item.label)}</span>
          <span class="bw-contributors__amount">${escapeHtml(formatMoney(item.amount))}</span>
          <span class="bw-contributors__share">${escapeHtml(formatShare(item.share))}</span>
        </li>
      `
    )
    .join("");

  return `
    <div class="bw-contributors__col">
      <span class="bw-contributors__col-title">${escapeHtml(title)}</span>
      <ul class="bw-contributors__list">${rows}</ul>
    </div>
  `;
}

function formatShare(share: number): string {
  return `${Math.round(share * 100)}%`;
}
