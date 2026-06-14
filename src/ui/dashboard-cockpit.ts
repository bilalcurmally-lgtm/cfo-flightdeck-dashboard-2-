import type { AuditMetric, AuditedCockpit } from "../finance/audit";
import type { CockpitViewModel, ReviewBreakdown } from "../finance/cockpit-kpis";
import type { NonOperatingSummary } from "../finance/non-operating";
import type { ReadinessReport } from "../finance/readiness";
import type { NetCashContributors } from "../finance/metric-diagnostics";
import { escapeHtml } from "./html";
import { renderLineageDrawer } from "./lineage-drawer";
import { renderNetCashContributors } from "./net-cash-contributors";
import { renderReadinessWidget, renderReadinessDrawer } from "./readiness-panel";
import { renderReviewDrawer, type ReviewDrawerItem } from "./review-drawer";
import { renderCategoryReviewDrawer } from "./category-review-drawer";
import type { CategoryReviewItem } from "./category-review-queue";

export interface CockpitFormatters {
  formatMoney: (value: number) => string;
  formatRunway: (months: number | null) => string;
}

/** Trust-cluster data threaded from the view model (non-operating split + category-review suggestions). */
export interface CockpitExtras {
  nonOperating?: NonOperatingSummary;
  categoryItems?: readonly CategoryReviewItem[];
  readiness?: ReadinessReport;
  netCashContributors?: NetCashContributors;
}

interface CockpitTile {
  label: string;
  value: string;
  meta?: string;
  modifier?: "primary" | "anchor" | "tight" | "review";
  metric?: AuditMetric;
  kpi?: string;
  review?: boolean;
}

export function renderCockpitStrip(
  viewModel: CockpitViewModel | AuditedCockpit,
  formatters: CockpitFormatters,
  reviewItems: readonly ReviewDrawerItem[] = [],
  extras: CockpitExtras = {}
): string {
  const empty = !viewModel.hasRows;
  const reviewTotal = reviewItems.length > 0 ? reviewItems.length : viewModel.review.total;
  const showReview = reviewTotal > 0;
  const dash = "—";
  const runwayModifier = viewModel.runwayTone === "tight" ? "tight" : "anchor";

  const nonOperating = extras.nonOperating;
  const showNonOperating = !!nonOperating && (nonOperating.total !== 0 || nonOperating.rows.length > 0);
  const categoryItems = extras.categoryItems ?? [];
  const showCategoryReview = categoryItems.length > 0;

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
      metric: "runwayMonths",
      kpi: "runway"
    }),
    showReview
      ? renderTile({
          label: "Needs review",
          value: String(reviewTotal),
          meta: reviewItems.length > 0 ? reviewItemsMeta(reviewItems) : reviewMeta(viewModel.review),
          modifier: "review",
          review: true
        })
      : "",
    showNonOperating ? renderNonOperatingTile(nonOperating!, formatters) : "",
    showCategoryReview ? renderCategoryReviewTile(categoryItems) : ""
  ].join("");

  // Five metric tiles by default (Revenue, Outflow, Net cash, Avg burn, Runway);
  // the optional review / non-operating / category-review tiles widen the grid.
  const tileCount =
    5 + (showReview ? 1 : 0) + (showNonOperating ? 1 : 0) + (showCategoryReview ? 1 : 0);
  const rootClass = tileCount > 5 ? `bw-cockpit bw-cockpit--${tileCount}` : "bw-cockpit";
  const readiness = extras.readiness;
  return `
    ${readiness ? renderReadinessWidget(readiness) : ""}
    <section class="${rootClass}" role="group" aria-label="Cockpit summary">${tiles}</section>
    ${renderLineagePanel(viewModel, formatters, reviewItems, nonOperating, categoryItems, readiness, extras.netCashContributors)}
  `;
}

function renderNonOperatingTile(
  nonOperating: NonOperatingSummary,
  formatters: CockpitFormatters
): string {
  return `
    <button class="bw-kpi bw-kpi--nonop" type="button" data-tile="non-operating" data-bw-nonop-trigger aria-expanded="false">
      <span class="bw-kpi__label">Non-operating</span>
      <span class="bw-kpi__value">${escapeHtml(signedMoney(nonOperating.total, formatters.formatMoney))}</span>
      <span class="bw-kpi__meta">${escapeHtml(nonOperatingMeta(nonOperating, formatters))}</span>
    </button>
  `;
}

function renderCategoryReviewTile(items: readonly CategoryReviewItem[]): string {
  return `
    <button class="bw-kpi bw-kpi--review" type="button" data-tile="category-review" data-bw-category-trigger aria-expanded="false">
      <span class="bw-kpi__label">Category review</span>
      <span class="bw-kpi__value">${escapeHtml(String(items.length))}</span>
      <span class="bw-kpi__meta">suggested recategorization${items.length === 1 ? "" : "s"}</span>
    </button>
  `;
}

function nonOperatingMeta(nonOperating: NonOperatingSummary, formatters: CockpitFormatters): string {
  const parts: string[] = [];
  if (nonOperating.revenueIn) parts.push(`${formatters.formatMoney(nonOperating.revenueIn)} in`);
  if (nonOperating.outflowOut) parts.push(`${formatters.formatMoney(nonOperating.outflowOut)} out`);
  return parts.length > 0 ? `${parts.join(" · ")} · kept in export` : "kept in export";
}

function renderTile({ label, value, meta, modifier, metric, kpi, review }: CockpitTile): string {
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
    const kpiAttr = kpi ? ` data-kpi="${escapeHtml(kpi)}"` : "";
    return `
      <button class="${classes}" type="button" data-bw-lineage-trigger="${escapeHtml(metric)}"${kpiAttr} aria-expanded="false">
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
  reviewItems: readonly ReviewDrawerItem[],
  nonOperating: NonOperatingSummary | undefined,
  categoryItems: readonly CategoryReviewItem[],
  readiness: ReadinessReport | undefined,
  netCashContributors: NetCashContributors | undefined
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
          ${
            metric === "netCash" && netCashContributors
              ? renderNetCashContributors(netCashContributors, formatters.formatMoney)
              : ""
          }
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
  const nonOperatingTemplate = nonOperating
    ? `
    <template data-bw-nonop-template>
      ${renderNonOperatingDrawer(nonOperating, formatters)}
    </template>
  `
    : "";
  const categoryTemplate = `
    <template data-bw-category-template>
      ${renderCategoryReviewDrawer(categoryItems)}
    </template>
  `;
  const readinessTemplate = readiness
    ? `
    <template data-bw-readiness-template>
      ${renderReadinessDrawer(readiness)}
    </template>
  `
    : "";

  return `
    <aside class="bw-lineage-panel" data-bw-lineage-panel role="dialog" aria-modal="false" aria-label="KPI audit trail" hidden>
      <div class="bw-lineage-panel__bar">
        <span class="bw-lineage-panel__title" data-bw-lineage-panel-title>Audit trail</span>
        <button class="bw-lineage-panel__close" type="button" data-bw-lineage-close aria-label="Close audit trail">×</button>
      </div>
      <div class="bw-lineage-panel__body" data-bw-lineage-active></div>
    </aside>
    <div class="bw-lineage-templates" hidden>${templates}${reviewTemplate}${nonOperatingTemplate}${categoryTemplate}${readinessTemplate}</div>
  `;
}

function renderNonOperatingDrawer(
  nonOperating: NonOperatingSummary,
  formatters: CockpitFormatters
): string {
  const rows = nonOperating.rows
    .map(
      (row) => `
      <li class="bw-nonop__row">
        <span class="bw-nonop__row-head">${escapeHtml(row.head || "Uncategorized")}</span>
        <span class="bw-nonop__row-date">${escapeHtml(row.dateISO)}</span>
        <span class="bw-nonop__row-flow">${escapeHtml(row.flow === "revenue" ? "in" : "out")}</span>
        <span class="bw-nonop__row-amount">${escapeHtml(formatters.formatMoney(row.amount))}</span>
      </li>`
    )
    .join("");
  return `
    <section class="bw-nonop" role="region" aria-label="Non-operating money">
      <p class="bw-nonop__intro">Internal transfers and financing moved out of operating KPIs. These rows stay in your export.</p>
      <ul class="bw-nonop__totals">
        <li><span>In</span><strong>${escapeHtml(formatters.formatMoney(nonOperating.revenueIn))}</strong></li>
        <li><span>Out</span><strong>${escapeHtml(formatters.formatMoney(nonOperating.outflowOut))}</strong></li>
        <li><span>Net</span><strong>${escapeHtml(signedMoney(nonOperating.total, formatters.formatMoney))}</strong></li>
      </ul>
      <ul class="bw-nonop__rows">${rows}</ul>
    </section>
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
