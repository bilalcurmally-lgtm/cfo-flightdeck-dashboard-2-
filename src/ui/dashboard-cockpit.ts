import type { AuditMetric, AuditedCockpit } from "../finance/audit";
import type { CockpitViewModel, ReviewBreakdown } from "../finance/cockpit-kpis";
import { escapeHtml } from "./html";
import { renderLineageDrawer } from "./lineage-drawer";
import { renderReviewDrawer, type ReviewDrawerItem } from "./review-drawer";

export interface CockpitFormatters {
  formatMoney: (value: number) => string;
  formatRunway: (months: number | null) => string;
}

interface CockpitTile {
  label: string;
  value: string;
  meta?: string;
  modifier?: "primary" | "anchor" | "tight" | "review";
  metric?: AuditMetric;
  review?: boolean;
}

export function renderCockpitStrip(
  viewModel: CockpitViewModel | AuditedCockpit,
  formatters: CockpitFormatters,
  reviewItems: readonly ReviewDrawerItem[] = []
): string {
  const empty = !viewModel.hasRows;
  const reviewTotal = reviewItems.length > 0 ? reviewItems.length : viewModel.review.total;
  const showReview = reviewTotal > 0;
  const dash = "—";
  const runwayModifier = viewModel.runwayTone === "tight" ? "tight" : "anchor";

  const tiles = [
    renderTile({
      label: "Revenue",
      value: empty ? dash : formatters.formatMoney(viewModel.revenue),
      meta: empty ? "no rows in current filter" : `${viewModel.inflowCount} rows`,
      metric: "revenue"
    }),
    renderTile({
      label: "Outflow",
      value: empty ? dash : formatters.formatMoney(viewModel.outflow),
      meta: empty ? "no rows in current filter" : `${viewModel.outflowCount} rows`,
      metric: "outflow"
    }),
    renderTile({
      label: "Net cash",
      value: empty ? dash : signedMoney(viewModel.netCash, formatters.formatMoney),
      meta: empty ? "" : `${viewModel.inflowCount + viewModel.outflowCount} rows`,
      modifier: "primary",
      metric: "netCash"
    }),
    renderTile({
      label: "Avg burn",
      value: empty ? dash : formatters.formatMoney(viewModel.averageMonthlyOutflow),
      meta: empty ? "no rows in current filter" : "per month",
      metric: "averageMonthlyOutflow"
    }),
    renderTile({
      label: "Runway",
      value: empty ? dash : formatters.formatRunway(viewModel.runwayMonths),
      meta: empty ? "" : runwayMeta(viewModel, formatters),
      modifier: runwayModifier,
      metric: "runwayMonths"
    }),
    showReview
      ? renderTile({
          label: "Needs review",
          value: String(reviewTotal),
          meta: reviewItems.length > 0 ? reviewItemsMeta(reviewItems) : reviewMeta(viewModel.review),
          modifier: "review",
          review: true
        })
      : ""
  ].join("");

  // Five metric tiles by default (Revenue, Outflow, Net cash, Avg burn, Runway);
  // the optional review tile makes six and needs the wider grid track.
  const rootClass = showReview ? "bw-cockpit bw-cockpit--6" : "bw-cockpit";
  return `
    <section class="${rootClass}" role="group" aria-label="Cockpit summary">${tiles}</section>
    ${renderLineagePanel(viewModel, formatters, reviewItems)}
  `;
}

function renderTile({ label, value, meta, modifier, metric, review }: CockpitTile): string {
  const classes = ["bw-kpi", modifier ? `bw-kpi--${modifier}` : ""].filter(Boolean).join(" ");
  const metaClass = modifier === "anchor" || modifier === "tight" ? "bw-kpi__tone" : "bw-kpi__meta";

  if (review) {
    return `
      <button class="${classes}" type="button" data-bw-review-trigger aria-expanded="false">
        <span class="bw-kpi__label">${escapeHtml(label)}</span>
        <span class="bw-kpi__value">${escapeHtml(value)}</span>
        ${meta ? `<span class="${metaClass}">${escapeHtml(meta)}</span>` : ""}
      </button>
    `;
  }

  if (metric) {
    return `
      <button class="${classes}" type="button" data-bw-lineage-trigger="${escapeHtml(metric)}" aria-expanded="false">
        <span class="bw-kpi__label">${escapeHtml(label)}</span>
        <span class="bw-kpi__value">${escapeHtml(value)}</span>
        ${meta ? `<span class="${metaClass}">${escapeHtml(meta)}</span>` : ""}
      </button>
    `;
  }

  return `
    <div class="${classes}">
      <span class="bw-kpi__label">${escapeHtml(label)}</span>
      <span class="bw-kpi__value">${escapeHtml(value)}</span>
      ${meta ? `<span class="${metaClass}">${escapeHtml(meta)}</span>` : ""}
    </div>
  `;
}

function renderLineagePanel(
  viewModel: CockpitViewModel | AuditedCockpit,
  formatters: CockpitFormatters,
  reviewItems: readonly ReviewDrawerItem[]
): string {
  if (!("lineage" in viewModel)) return "";

  const templateMetrics: AuditMetric[] = [
    "revenue",
    "outflow",
    "netCash",
    "averageMonthlyOutflow",
    "runwayMonths"
  ];
  const templates = templateMetrics
    .map(
      (metric) => `
        <template data-bw-lineage-template="${escapeHtml(metric)}">
          ${renderLineageDrawer(viewModel.lineage[metric], formatters)}
        </template>
      `
    )
    .join("");
  const reviewTemplate = `
    <template data-bw-review-template>
      ${renderReviewDrawer(reviewItems, {
        updatedLabel: `Runway updated to ${formatters.formatRunway(viewModel.runwayMonths)}`
      })}
    </template>
  `;

  return `
    <aside class="bw-lineage-panel" data-bw-lineage-panel role="dialog" aria-modal="false" aria-label="KPI audit trail" hidden>
      <div class="bw-lineage-panel__bar">
        <span class="bw-lineage-panel__title" data-bw-lineage-panel-title>Audit trail</span>
        <button class="bw-lineage-panel__close" type="button" data-bw-lineage-close aria-label="Close audit trail">×</button>
      </div>
      <div class="bw-lineage-panel__body" data-bw-lineage-active></div>
    </aside>
    <div class="bw-lineage-templates" hidden>${templates}${reviewTemplate}</div>
  `;
}

function signedMoney(value: number, formatMoney: (value: number) => string): string {
  return value > 0 ? `+${formatMoney(value)}` : formatMoney(value);
}

function runwayMeta(viewModel: CockpitViewModel, formatters: CockpitFormatters): string {
  if (viewModel.averageMonthlyOutflow > 0) {
    if (viewModel.runwayTone === "unknown") {
      return `set cash on hand · burn ${formatters.formatMoney(viewModel.averageMonthlyOutflow)}/mo`;
    }
    return `${viewModel.runwayTone} · burn ${formatters.formatMoney(viewModel.averageMonthlyOutflow)}/mo`;
  }
  return viewModel.runwayTone === "unknown" ? "runway unavailable" : "no recorded burn";
}

function reviewMeta(review: ReviewBreakdown): string {
  const parts = [];
  if (review.rejected) parts.push(`${review.rejected} rejected`);
  if (review.duplicates) parts.push(`${review.duplicates} dupe${review.duplicates === 1 ? "" : "s"}`);
  if (review.transfers) parts.push(`${review.transfers} transfer${review.transfers === 1 ? "" : "s"}`);
  return parts.join(" · ");
}

function reviewItemsMeta(items: readonly ReviewDrawerItem[]): string {
  const duplicateCount = items.filter((item) => item.kind === "duplicate").length;
  const transferCount = items.filter((item) => item.kind === "transfer").length;
  const rejectedCount = items.filter((item) => item.kind === "rejected").length;
  const savedCount = items.filter((item) => item.excluded).length;
  const parts = [];
  if (rejectedCount) parts.push(`${rejectedCount} rejected`);
  if (duplicateCount) parts.push(`${duplicateCount} dupe${duplicateCount === 1 ? "" : "s"}`);
  if (transferCount) parts.push(`${transferCount} transfer${transferCount === 1 ? "" : "s"}`);
  if (savedCount) parts.push(`${savedCount} saved decision${savedCount === 1 ? "" : "s"}`);
  return parts.join(" · ");
}
