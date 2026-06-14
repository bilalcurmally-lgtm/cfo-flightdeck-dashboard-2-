import type {
  NetCashContributor,
  NetCashContributors
} from "../finance/metric-diagnostics";
import { escapeHtml } from "./html";

/**
 * Augments the net-cash audit drawer with "what's driving it": the biggest
 * inflows and outflows behind the number. Pure and escaped; renders nothing when
 * there are no contributors so the drawer stays clean for an empty ledger.
 */
export function renderNetCashContributors(
  contributors: NetCashContributors,
  formatMoney: (value: number) => string
): string {
  const { positives, negatives } = contributors;
  if (positives.length === 0 && negatives.length === 0) return "";

  return `
    <div class="bw-contributors">
      <span class="bw-lineage__section-label">What's driving it</span>
      <div class="bw-contributors__columns">
        ${renderColumn("Biggest inflows", positives, formatMoney)}
        ${renderColumn("Biggest outflows", negatives, formatMoney)}
      </div>
    </div>
  `;
}

function renderColumn(
  title: string,
  items: readonly NetCashContributor[],
  formatMoney: (value: number) => string
): string {
  if (items.length === 0) return "";
  const rows = items
    .map(
      (item) => `
        <li class="bw-contributors__row">
          <span class="bw-contributors__label">${escapeHtml(item.label)}</span>
          <span class="bw-contributors__amount">${escapeHtml(formatMoney(item.amount))}</span>
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
