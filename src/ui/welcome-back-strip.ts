// src/ui/welcome-back-strip.ts
import { escapeHtml } from "./html";
import type { ImportComparison } from "../workspace/import-history";
import { explainRunwayChange, type RunwayInputs } from "../finance/metric-diagnostics";

interface StripFormatters {
  formatMoney: (value: number) => string;
  formatRunway: (value: number | null) => string;
}

/** Pull a metric's previous/current snapshot values out of the KPI deltas. */
function runwayInputsFromDeltas(
  comparison: ImportComparison,
  side: "previous" | "current"
): RunwayInputs {
  const valueOf = (key: string): number | null => {
    const delta = comparison.kpiDeltas.find((d) => d.key === key);
    return delta ? delta[side] : null;
  };
  return {
    runwayMonths: valueOf("runwayMonths"),
    cashOnHand: valueOf("cashOnHand"),
    averageMonthlyOutflow: valueOf("averageMonthlyOutflow")
  };
}

function baselineDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "last import" : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function renderWelcomeBackStrip(
  comparison: ImportComparison,
  { formatMoney, formatRunway }: StripFormatters,
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

  // "Why did runway change?" — only when we can attribute it to cash/burn drivers
  // (captured on newer imports), so legacy baselines don't duplicate the delta line.
  const explanation = explainRunwayChange(
    runwayInputsFromDeltas(comparison, "previous"),
    runwayInputsFromDeltas(comparison, "current"),
    { formatMoney, formatRunway }
  );
  const whyLine =
    explanation.drivers.length > 0
      ? `<p class="bw-welcome__why">${escapeHtml(explanation.headline)}</p>`
      : "";

  return `
    <section class="bw-welcome ${tone}" data-bw-welcome-strip role="status">
      <div class="bw-welcome__body">
        <p class="bw-welcome__text">Since your last import (${escapeHtml(baselineDate(comparison.baseline.importedAt))}): ${clauses.join("; ")}.</p>
        ${whyLine}
      </div>
      <button type="button" class="bw-welcome__dismiss" data-bw-welcome-dismiss aria-label="Dismiss">×</button>
    </section>
  `;
}