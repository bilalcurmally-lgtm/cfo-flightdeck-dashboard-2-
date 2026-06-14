import type { LargestTransactionInfluence } from "../finance/metric-diagnostics";
import { escapeHtml } from "./html";

/**
 * Shows whether one transaction is dominating the current period. Pure and
 * escaped; empty ledgers render nothing.
 */
export function renderLargestTransactionInfluence(
  influence: LargestTransactionInfluence | null,
  formatMoney: (value: number) => string
): string {
  if (!influence) return "";

  return `
    <div class="bw-contributors bw-contributors--single">
      <span class="bw-lineage__section-label">Largest transaction</span>
      <ul class="bw-contributors__list">
        <li class="bw-contributors__row bw-contributors__row--wide">
          <span class="bw-contributors__label">
            ${escapeHtml(influence.label)}
            <small>${escapeHtml(`${influence.dateISO} · ${influence.counterparty} · ${influence.head}`)}</small>
          </span>
          <span class="bw-contributors__amount">${escapeHtml(formatMoney(influence.amount))}</span>
          <span class="bw-contributors__share">${escapeHtml(formatShare(influence.shareOfActivity))}</span>
        </li>
      </ul>
      <p class="bw-contributors__note">
        Net cash impact: ${escapeHtml(signedMoney(influence.signedImpact, formatMoney))}
      </p>
    </div>
  `;
}

function formatShare(share: number): string {
  return `${Math.round(share * 100)}%`;
}

function signedMoney(value: number, formatMoney: (value: number) => string): string {
  return value > 0 ? `+${formatMoney(value)}` : formatMoney(value);
}
