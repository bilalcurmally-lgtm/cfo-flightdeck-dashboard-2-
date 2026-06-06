// src/ui/welcome-back-strip.ts
import { escapeHtml } from "./html";
import type { ImportComparison } from "../workspace/import-history";

interface StripFormatters {
  formatMoney: (value: number) => string;
  formatRunway: (value: number | null) => string;
}

function baselineDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "last import" : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function renderWelcomeBackStrip(
  comparison: ImportComparison,
  { formatRunway }: StripFormatters,
): string {
  const runway = comparison.kpiDeltas.find((d) => d.key === "runwayMonths");
  const tone =
    runway?.direction === "down" || comparison.review.added > 0
      ? "bw-welcome--attention"
      : runway?.direction === "up"
        ? "bw-welcome--positive"
        : "bw-welcome--neutral";

  const clauses: string[] = [];
  if (runway && runway.previous !== null && runway.current !== null) {
    clauses.push(`runway ${escapeHtml(formatRunway(runway.previous))} → ${escapeHtml(formatRunway(runway.current))}`);
  }
  if (comparison.addedTransactions > 0) clauses.push(`+${comparison.addedTransactions} transactions`);
  if (comparison.removedTransactions > 0) clauses.push(`−${comparison.removedTransactions} removed`);
  if (comparison.review.added > 0) {
    clauses.push(`${comparison.review.added} new ${comparison.review.added === 1 ? "item" : "items"} to review`);
  }

  return `
    <section class="bw-welcome ${tone}" data-bw-welcome-strip role="status">
      <p class="bw-welcome__text">Since your last import (${escapeHtml(baselineDate(comparison.baseline.importedAt))}): ${clauses.join("; ")}.</p>
      <button type="button" class="bw-welcome__dismiss" data-bw-welcome-dismiss aria-label="Dismiss">×</button>
    </section>
  `;
}