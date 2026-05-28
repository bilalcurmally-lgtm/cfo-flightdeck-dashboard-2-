import type { CockpitViewModel, ReviewBreakdown } from "../finance/cockpit-kpis";
import { escapeHtml } from "./html";

export interface CockpitFormatters {
  formatMoney: (value: number) => string;
  formatRunway: (months: number | null) => string;
}

interface CockpitTile {
  label: string;
  value: string;
  meta?: string;
  modifier?: "primary" | "anchor" | "tight" | "review";
}

export function renderCockpitStrip(
  viewModel: CockpitViewModel,
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
      meta: empty ? "no rows in current filter" : `${viewModel.inflowCount} rows`
    }),
    renderTile({
      label: "Outflow",
      value: empty ? dash : formatters.formatMoney(viewModel.outflow),
      meta: empty ? "no rows in current filter" : `${viewModel.outflowCount} rows`
    }),
    renderTile({
      label: "Net cash",
      value: empty ? dash : signedMoney(viewModel.netCash, formatters.formatMoney),
      meta: empty ? "" : `${viewModel.inflowCount + viewModel.outflowCount} rows`,
      modifier: "primary"
    }),
    renderTile({
      label: "Runway",
      value: empty ? dash : formatters.formatRunway(viewModel.runwayMonths),
      meta: empty ? "" : runwayMeta(viewModel, formatters),
      modifier: runwayModifier
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
  return `<section class="${rootClass}" role="group" aria-label="Cockpit summary">${tiles}</section>`;
}

function renderTile({ label, value, meta, modifier }: CockpitTile): string {
  const classes = ["bw-kpi", modifier ? `bw-kpi--${modifier}` : ""].filter(Boolean).join(" ");
  const metaClass = modifier === "anchor" || modifier === "tight" ? "bw-kpi__tone" : "bw-kpi__meta";

  return `
    <div class="${classes}">
      <span class="bw-kpi__label">${escapeHtml(label)}</span>
      <span class="bw-kpi__value">${escapeHtml(value)}</span>
      ${meta ? `<span class="${metaClass}">${escapeHtml(meta)}</span>` : ""}
    </div>
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
