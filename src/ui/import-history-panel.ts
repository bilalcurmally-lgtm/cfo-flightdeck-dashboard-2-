import type { ImportSnapshot } from "../workspace/import-history";
import { escapeHtml } from "./html";

interface PanelFormatters {
  formatRunway: (value: number | null) => string;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric"
      });
}

export function renderImportHistoryPanel(
  imports: readonly ImportSnapshot[],
  { formatRunway }: PanelFormatters
): string {
  if (imports.length === 0) {
    return `
      <div class="bw-history">
        <p class="bw-history__empty">No imports yet.</p>
      </div>
    `;
  }

  const rows = [...imports]
    .reverse()
    .map((snapshot) => {
      const runway = snapshot.kpiSnapshot.runwayMonths ?? null;
      const transactionCount = snapshot.kpiSnapshot.transactionCount ?? null;
      return `
        <li class="bw-history__row">
          <span class="bw-history__date">${escapeHtml(formatDate(snapshot.importedAt))}</span>
          <span class="bw-history__source">${escapeHtml(snapshot.sourceName)}</span>
          <span class="bw-history__txns">${
            transactionCount === null ? "—" : `${transactionCount} txns`
          }</span>
          <span class="bw-history__runway">${escapeHtml(formatRunway(runway))}</span>
        </li>
      `;
    })
    .join("");

  return `
    <div class="bw-history">
      <ul class="bw-history__list">${rows}</ul>
    </div>
  `;
}
