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
    <div class="forecast-list">
      ${forecast.weeks
        .map((week) => renderForecastWeek(week, minCash, range, formatMoney))
        .join("")}
    </div>
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
