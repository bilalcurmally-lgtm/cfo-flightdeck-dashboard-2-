import { escapeHtml } from "./html";

export type ReviewDrawerItemKind = "duplicate" | "transfer" | "rejected";

export interface ReviewDrawerItem {
  id: string;
  kind: ReviewDrawerItemKind;
  title: string;
  body: string;
  rowIds: string[];
  confidence: "high" | "medium" | "low";
  excluded: boolean;
}

export interface ReviewDrawerOptions {
  updatedLabel: string;
}

export function renderReviewDrawer(
  items: readonly ReviewDrawerItem[],
  options: ReviewDrawerOptions
): string {
  if (items.length === 0) {
    return `
      <section class="bw-review" role="region" aria-label="Review queue">
        <p class="bw-review__empty">Nothing to review — your numbers look clean.</p>
        ${renderLiveRegion(options.updatedLabel)}
      </section>
    `;
  }

  return `
    <section class="bw-review" role="region" aria-label="Review queue">
      <header class="bw-review__head">
        <span class="bw-review__eyebrow">Review suggested</span>
        <p class="bw-review__intro">These checks are conservative. Excluding an item re-derives the cockpit immediately; including it restores the row to KPI math.</p>
      </header>
      <ul class="bw-review__list">
        ${items.map(renderReviewItem).join("")}
      </ul>
      ${renderLiveRegion(options.updatedLabel)}
    </section>
  `;
}

function renderReviewItem(item: ReviewDrawerItem): string {
  const action = item.excluded ? "Include in KPIs" : "Exclude from KPIs";
  const toggle = item.rowIds.length
    ? `<button
        class="bw-review__toggle"
        type="button"
        data-bw-review-toggle="${escapeHtml(item.id)}"
        aria-pressed="${item.excluded ? "true" : "false"}"
      >${escapeHtml(action)}</button>`
    : "";

  return `
    <li class="bw-review__item bw-review__item--${escapeHtml(item.kind)}">
      <div class="bw-review__copy">
        <span class="bw-review__confidence">${escapeHtml(item.confidence)} confidence</span>
        <strong>${escapeHtml(item.title)}</strong>
        <p>${escapeHtml(item.body)}</p>
      </div>
      ${toggle}
    </li>
  `;
}

function renderLiveRegion(label: string): string {
  return `<p class="bw-review__live" aria-live="polite">${escapeHtml(label)}</p>`;
}
