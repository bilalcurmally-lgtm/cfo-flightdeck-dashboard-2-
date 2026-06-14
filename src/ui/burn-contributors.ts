import type { BurnContributor, BurnContributors } from "../finance/metric-diagnostics";
import { escapeHtml } from "./html";

/**
 * Adds a deterministic "what drives burn" explainer to the average-burn drawer.
 * Pure and escaped; empty ledgers render nothing.
 */
export function renderBurnContributors(
  contributors: BurnContributors,
  formatMoney: (value: number) => string
): string {
  if (contributors.total === 0 || (contributors.heads.length === 0 && contributors.subcategories.length === 0)) {
    return "";
  }

  return `
    <div class="bw-contributors">
      <span class="bw-lineage__section-label">What's driving burn</span>
      <div class="bw-contributors__columns">
        ${renderColumn("By head", contributors.heads, formatMoney)}
        ${renderColumn("By subcategory", contributors.subcategories, formatMoney)}
      </div>
    </div>
  `;
}

function renderColumn(
  title: string,
  items: readonly BurnContributor[],
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
