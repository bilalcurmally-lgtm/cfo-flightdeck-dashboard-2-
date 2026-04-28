import type { PeriodSummary } from "../finance/summary";
import type { PeriodGrain } from "../finance/types";

export interface TrendSvgOptions {
  title?: string;
  subtitle?: string;
  currency?: string;
}

export function buildTrendSvg(periods: PeriodSummary[], options: TrendSvgOptions = {}): string {
  const width = 1200;
  const height = 720;
  const chartX = 92;
  const chartY = 150;
  const chartWidth = 1016;
  const chartHeight = 420;
  const maxValue = Math.max(...periods.map((period) => Math.max(period.revenue, period.outflow)), 1);
  const groupWidth = periods.length ? chartWidth / periods.length : chartWidth;
  const barWidth = Math.min(28, Math.max(10, groupWidth * 0.28));
  const title = options.title ?? "Visible Trend";
  const subtitle = options.subtitle ?? `${periods.length} period${periods.length === 1 ? "" : "s"} exported`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">${escapeSvg(title)}</title>
  <desc id="desc">${escapeSvg(subtitle)}</desc>
  <rect width="1200" height="720" fill="#fffaf2"/>
  <rect x="36" y="36" width="1128" height="648" rx="18" fill="#f7f4ed" stroke="#d8d0c3"/>
  <text x="92" y="92" fill="#17211d" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="34" font-weight="700">${escapeSvg(title)}</text>
  <text x="92" y="124" fill="#5d6b64" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="18">${escapeSvg(subtitle)}</text>
  <g transform="translate(${chartX} ${chartY})">
    ${axisTicks(maxValue, chartWidth, chartHeight, options.currency)}
    ${periods.length ? bars(periods, maxValue, groupWidth, barWidth, chartHeight) : emptyState(chartWidth, chartHeight)}
  </g>
  <g font-family="Inter, Segoe UI, Arial, sans-serif" font-size="18">
    <rect x="92" y="620" width="20" height="20" rx="4" fill="#5a8f68"/>
    <text x="122" y="637" fill="#40534a">Revenue</text>
    <rect x="230" y="620" width="20" height="20" rx="4" fill="#b9694d"/>
    <text x="260" y="637" fill="#40534a">Outflow</text>
  </g>
</svg>`;
}

export function trendSvgFilename(
  sourceName: string,
  generatedAt = new Date(),
  grain: PeriodGrain = "monthly"
): string {
  const safeSource = sourceName
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  const dateStamp = generatedAt.toISOString().slice(0, 10);

  return `${safeSource || "finance"}-visible-${grain}-trend-${dateStamp}.svg`;
}

function axisTicks(maxValue: number, chartWidth: number, chartHeight: number, currency = "USD"): string {
  return [0, 0.25, 0.5, 0.75, 1]
    .map((ratio) => {
      const y = chartHeight - chartHeight * ratio;
      const value = maxValue * ratio;
      return `
        <line x1="0" y1="${round(y)}" x2="${chartWidth}" y2="${round(y)}" stroke="#e5ded3"/>
        <text x="-12" y="${round(y + 6)}" text-anchor="end" fill="#5d6b64" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="14">${escapeSvg(
          formatMoney(value, currency)
        )}</text>`;
    })
    .join("");
}

function bars(
  periods: PeriodSummary[],
  maxValue: number,
  groupWidth: number,
  barWidth: number,
  chartHeight: number
): string {
  return periods
    .map((period, index) => {
      const center = groupWidth * index + groupWidth / 2;
      const revenueHeight = (period.revenue / maxValue) * chartHeight;
      const outflowHeight = (period.outflow / maxValue) * chartHeight;
      const label = period.period.length > 12 ? `${period.period.slice(0, 11)}...` : period.period;
      return `
        <rect x="${round(center - barWidth - 3)}" y="${round(chartHeight - revenueHeight)}" width="${round(
          barWidth
        )}" height="${round(revenueHeight)}" rx="5" fill="#5a8f68"/>
        <rect x="${round(center + 3)}" y="${round(chartHeight - outflowHeight)}" width="${round(
          barWidth
        )}" height="${round(outflowHeight)}" rx="5" fill="#b9694d"/>
        <text x="${round(center)}" y="${chartHeight + 34}" text-anchor="middle" fill="#40534a" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="14">${escapeSvg(
          label
        )}</text>
        <text x="${round(center)}" y="${chartHeight + 58}" text-anchor="middle" fill="${
          period.netCash >= 0 ? "#25543a" : "#743522"
        }" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="13">${escapeSvg(
          period.netCash >= 0 ? "net +" : "net "
        )}${round(period.netCash)}</text>`;
    })
    .join("");
}

function emptyState(chartWidth: number, chartHeight: number): string {
  return `
    <rect x="0" y="0" width="${chartWidth}" height="${chartHeight}" rx="12" fill="#fffaf2" stroke="#e5ded3"/>
    <text x="${chartWidth / 2}" y="${chartHeight / 2}" text-anchor="middle" fill="#5d6b64" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="22">No trend data in this view</text>`;
}

function formatMoney(value: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(value);
}

function escapeSvg(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };
    return entities[char];
  });
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
