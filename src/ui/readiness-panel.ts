import type { ReadinessReport, ReadinessStatus } from "../finance/readiness";
import { escapeHtml } from "./html";

const STATUS_LABEL: Record<ReadinessStatus, string> = {
  ready: "Ready",
  partial: "Ready with caveats",
  "needs-review": "Needs review",
  empty: "No data"
};

/**
 * Compact trust widget that sits above the cockpit tiles. Shows the readiness
 * status and headline with a button that opens the detail drawer. Non-blocking:
 * renders nothing for an empty dashboard so it never gates the first import.
 */
export function renderReadinessWidget(report: ReadinessReport): string {
  if (report.status === "empty") return "";
  const actionable = report.signals.filter((signal) => signal.severity !== "info").length;
  const cta = actionable > 0 ? "Review details" : "View checks";

  return `
    <section class="bw-readiness bw-readiness--${report.status}" role="group" aria-label="Dashboard readiness">
      <span class="bw-readiness__status">${escapeHtml(STATUS_LABEL[report.status])}</span>
      <span class="bw-readiness__headline">${escapeHtml(report.headline)}</span>
      <button class="bw-readiness__details" type="button" data-bw-readiness-trigger aria-expanded="false">${escapeHtml(cta)}</button>
    </section>
  `;
}

/** Drawer body: the readiness signals that produced the status, or an all-clear. */
export function renderReadinessDrawer(report: ReadinessReport): string {
  if (report.signals.length === 0) {
    return `
      <section class="bw-readiness-drawer" role="region" aria-label="Dashboard readiness detail">
        <p class="bw-readiness-drawer__headline">${escapeHtml(report.headline)}</p>
        <p class="bw-readiness-drawer__clear">Every readiness check passed.</p>
      </section>
    `;
  }

  const items = report.signals
    .map(
      (signal) => `
        <li class="bw-readiness__signal bw-readiness__signal--${signal.severity}">
          <span class="bw-readiness__signal-label">${escapeHtml(signal.label)}</span>
          <span class="bw-readiness__signal-detail">${escapeHtml(signal.detail)}</span>
        </li>
      `
    )
    .join("");

  return `
    <section class="bw-readiness-drawer" role="region" aria-label="Dashboard readiness detail">
      <p class="bw-readiness-drawer__headline">${escapeHtml(report.headline)}</p>
      <ul class="bw-readiness__signals">${items}</ul>
    </section>
  `;
}
