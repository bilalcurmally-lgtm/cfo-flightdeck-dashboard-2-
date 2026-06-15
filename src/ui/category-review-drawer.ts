// src/ui/category-review-drawer.ts
import type { CashFlow } from "../finance/types";
import type { CategoryReviewItem } from "./category-review-queue";
import { escapeHtml } from "./html";

const GROUP_OPTIONS = ["Income", "Operating Costs", "Delivery Costs", "Internal", "Financing"];
const FLOW_OPTIONS: { value: CashFlow; label: string }[] = [
  { value: "revenue", label: "Revenue (in)" }, { value: "outflow", label: "Outflow (out)" },
];

const sel = (v: string, cur: string) => v === cur ? " selected" : "";

export function renderCategoryReviewDrawer(items: readonly CategoryReviewItem[]): string {
  if (items.length === 0) {
    return `<section class="bw-review" role="region" aria-label="Category review"><p class="bw-review__empty">No categories need review.</p></section>`;
  }
  return `<section class="bw-review bw-category-review" role="region" aria-label="Category review">
    <header class="bw-review__head">
      <span class="bw-review__eyebrow">Category review</span>
      <p class="bw-review__intro">Review suggested for rows that can distort operating KPIs. Changing Type or Group re-derives the cockpit immediately.</p>
    </header>
    <ul class="bw-review__list">
      ${items.map((it) => `
    <li class="category-review-item" data-category-id="${escapeHtml(it.id)}" data-acted="${it.acted}">
      <div class="category-review-item__label">${escapeHtml(it.label)}</div>
      <label>Type <select data-role="flow-select" data-category-id="${escapeHtml(it.id)}" aria-label="Type for ${escapeHtml(it.label)}">
        ${FLOW_OPTIONS.map((o) => `<option value="${o.value}"${sel(o.value, it.flow)}>${escapeHtml(o.label)}</option>`).join("")}
      </select></label>
      <label>Group <select data-role="group-select" data-category-id="${escapeHtml(it.id)}" aria-label="Group for ${escapeHtml(it.label)}">
        ${GROUP_OPTIONS.map((g) => `<option value="${escapeHtml(g)}"${sel(g, it.parent)}>${escapeHtml(g)}</option>`).join("")}
      </select></label>
      <button type="button" data-role="confirm" data-category-id="${escapeHtml(it.id)}">Looks right</button>
      ${it.acted ? `<button type="button" data-role="save-rule" data-category-id="${escapeHtml(it.id)}">Remember for future imports</button>` : ""}
      ${it.acted ? `<button type="button" data-role="reset" data-category-id="${escapeHtml(it.id)}">Reset</button>` : ""}
    </li>`).join("")}
    </ul>
  </section>`;
}
