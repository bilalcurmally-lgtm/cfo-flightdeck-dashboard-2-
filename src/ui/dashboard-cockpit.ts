import type { AuditMetric, AuditedCockpit } from "../finance/audit";
import type { CockpitViewModel, ReviewBreakdown } from "../finance/cockpit-kpis";
import { escapeHtml } from "./html";
import { renderLineageDrawer } from "./lineage-drawer";

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
}

export function renderCockpitStrip(
  viewModel: CockpitViewModel | AuditedCockpit,
  formatters: CockpitFormatters
): string {
  const empty = !viewModel.hasRows;
  const showReview = viewModel.review.total > 0;
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
      label: "Runway",
      value: empty ? dash : formatters.formatRunway(viewModel.runwayMonths),
      meta: empty ? "" : runwayMeta(viewModel, formatters),
      modifier: runwayModifier,
      metric: "runwayMonths"
    }),
    showReview
      ? renderTile({
          label: "Needs review",
          value: String(viewModel.review.total),
          meta: reviewMeta(viewModel.review),
          modifier: "review"
        })
      : ""
  ].join("");

  const rootClass = showReview ? "bw-cockpit" : "bw-cockpit bw-cockpit--4";
  return `
    <section class="${rootClass}" role="group" aria-label="Cockpit summary">${tiles}</section>
    ${renderLineagePanel(viewModel, formatters)}
  `;
}

function renderTile({ label, value, meta, modifier, metric }: CockpitTile): string {
  const classes = ["bw-kpi", modifier ? `bw-kpi--${modifier}` : ""].filter(Boolean).join(" ");
  const metaClass = modifier === "anchor" || modifier === "tight" ? "bw-kpi__tone" : "bw-kpi__meta";

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
  formatters: CockpitFormatters
): string {
  if (!("lineage" in viewModel)) return "";

  const templateMetrics: AuditMetric[] = ["revenue", "outflow", "netCash", "runwayMonths"];
  const templates = templateMetrics
    .map(
      (metric) => `
        <template data-bw-lineage-template="${escapeHtml(metric)}">
          ${renderLineageDrawer(viewModel.lineage[metric], formatters)}
        </template>
      `
    )
    .join("");

  return `
    <aside class="bw-lineage-panel" data-bw-lineage-panel role="dialog" aria-modal="false" aria-label="KPI audit trail" hidden>
      <div class="bw-lineage-panel__bar">
        <span class="bw-lineage-panel__title">Audit trail</span>
        <button class="bw-lineage-panel__close" type="button" data-bw-lineage-close aria-label="Close audit trail">×</button>
      </div>
      <div class="bw-lineage-panel__body" data-bw-lineage-active></div>
    </aside>
    <div class="bw-lineage-templates" hidden>${templates}</div>
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
