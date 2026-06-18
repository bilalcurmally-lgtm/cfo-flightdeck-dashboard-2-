import type { ForecastResult, ForecastWeek } from "../finance/forecast";
import { escapeHtml } from "./html";

type MoneyFormatter = (value: number) => string;

export function renderForecast(forecast: ForecastResult, formatMoney: MoneyFormatter): string {
  const minCash = Math.min(...forecast.weeks.map((week) => week.projectedCash), 0);
  const maxCash = Math.max(...forecast.weeks.map((week) => week.projectedCash), 1);
  const range = maxCash - minCash || 1;

  return `
    ${
      forecast.rejectedEvents.length
        ? `<ul class="forecast-issues">
            ${forecast.rejectedEvents
              .map((event) => `<li>${escapeHtml(event)}</li>`)
              .join("")}
          </ul>`
        : ""
    }
    ${renderForecastChart(forecast, minCash, maxCash, formatMoney)}
    <div class="forecast-list">
      ${forecast.weeks
        .map((week) => renderForecastWeek(week, minCash, range, formatMoney))
        .join("")}
    </div>
  `;
}

function renderForecastChart(
  forecast: ForecastResult,
  minCash: number,
  maxCash: number,
  formatMoney: MoneyFormatter
): string {
  const width = 760;
  const height = 260;
  const padding = { top: 24, right: 34, bottom: 46, left: 86 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const range = maxCash - minCash || 1;
  const weeks = forecast.weeks;

  if (weeks.length === 0) {
    return `
      <figure class="forecast-chart" aria-label="13-week forecast chart">
        <svg viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="forecast-chart-title forecast-chart-desc">
          <title id="forecast-chart-title">13-week forecast path</title>
          <desc id="forecast-chart-desc">No forecast weeks available.</desc>
          <rect class="forecast-chart__frame" x="1" y="1" width="${width - 2}" height="${height - 2}" rx="10"></rect>
          <text class="forecast-chart__empty" x="${width / 2}" y="${height / 2}" text-anchor="middle">No forecast path yet</text>
        </svg>
      </figure>
    `;
  }

  const xFor = (index: number) =>
    padding.left + (weeks.length === 1 ? chartWidth / 2 : (chartWidth * index) / (weeks.length - 1));
  const yFor = (value: number) => padding.top + chartHeight - ((value - minCash) / range) * chartHeight;
  const points = weeks.map((week, index) => `${round(xFor(index))},${round(yFor(week.projectedCash))}`);
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point}`).join(" ");
  const areaPath = `${path} L ${round(xFor(weeks.length - 1))},${padding.top + chartHeight} L ${round(
    xFor(0)
  )},${padding.top + chartHeight} Z`;
  const zeroY = minCash <= 0 && maxCash >= 0 ? yFor(0) : null;
  const tickValues = [maxCash, minCash + range / 2, minCash];
  const eventMarkers = weeks
    .map((week, index) =>
      week.eventNet === 0
        ? ""
        : `<circle class="forecast-chart__event" cx="${round(xFor(index))}" cy="${round(
            yFor(week.projectedCash)
          )}" r="4"><title>${escapeHtml(week.weekStartISO)} event net ${escapeHtml(
            formatMoney(week.eventNet)
          )}</title></circle>`
    )
    .join("");
  const pointMarkers = weeks
    .map(
      (week, index) => `
        <circle class="forecast-chart__point" cx="${round(xFor(index))}" cy="${round(
          yFor(week.projectedCash)
        )}" r="3">
          <title>${escapeHtml(week.weekStartISO)} projected cash ${escapeHtml(formatMoney(week.projectedCash))}</title>
        </circle>`
    )
    .join("");
  const xLabels = weeks
    .filter((_, index) => index === 0 || index === weeks.length - 1 || index % 3 === 0)
    .map((week) => {
      const index = weeks.indexOf(week);
      return `<text class="forecast-chart__x-label" x="${round(xFor(index))}" y="${
        height - 18
      }" text-anchor="middle">${escapeHtml(shortDate(week.weekStartISO))}</text>`;
    })
    .join("");
  const yLabels = tickValues
    .map((value) => {
      const y = yFor(value);
      return `
        <line class="forecast-chart__gridline" x1="${padding.left}" y1="${round(y)}" x2="${
          width - padding.right
        }" y2="${round(y)}"></line>
        <text class="forecast-chart__y-label" x="${padding.left - 12}" y="${round(y + 5)}" text-anchor="end">${escapeHtml(
          formatMoney(value)
        )}</text>`;
    })
    .join("");
  const finalWeek = weeks[weeks.length - 1];

  return `
    <figure class="forecast-chart" aria-label="13-week forecast chart">
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="forecast-chart-title forecast-chart-desc">
        <title id="forecast-chart-title">13-week forecast path</title>
        <desc id="forecast-chart-desc">Projected cash ends at ${escapeHtml(
          formatMoney(finalWeek.projectedCash)
        )} for the week starting ${escapeHtml(finalWeek.weekStartISO)}.</desc>
        <rect class="forecast-chart__frame" x="1" y="1" width="${width - 2}" height="${height - 2}" rx="10"></rect>
        ${yLabels}
        ${zeroY === null ? "" : `<line class="forecast-chart__zero" x1="${padding.left}" y1="${round(zeroY)}" x2="${width - padding.right}" y2="${round(zeroY)}"></line>`}
        <path class="forecast-chart__area" d="${areaPath}"></path>
        <path class="forecast-chart__line" d="${path}"></path>
        ${pointMarkers}
        ${eventMarkers}
        ${xLabels}
      </svg>
      <figcaption>
        <strong>${escapeHtml(formatMoney(finalWeek.projectedCash))}</strong>
        <span>projected cash at week 13</span>
      </figcaption>
    </figure>
  `;
}

function renderForecastWeek(
  week: ForecastWeek,
  minCash: number,
  range: number,
  formatMoney: MoneyFormatter
): string {
  const width = Math.max(4, Math.round(((week.projectedCash - minCash) / range) * 100));

  return `
    <article class="forecast-week">
      <div>
        <strong>${escapeHtml(week.weekStartISO)}</strong>
        <span>${escapeHtml(formatMoney(week.eventNet))} events</span>
      </div>
      <div class="forecast-bar-track">
        <span class="forecast-bar" style="width: ${width}%"></span>
      </div>
      <strong>${escapeHtml(formatMoney(week.projectedCash))}</strong>
    </article>
  `;
}

function shortDate(dateISO: string): string {
  const [, month = "", day = ""] = dateISO.split("-");
  return `${month}/${day}`;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
