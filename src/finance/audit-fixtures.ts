import type { AuditMetric } from "./audit";
import type { CashHealth } from "./cash-health";
import type { FinanceSummary } from "./summary";

function placeholderMetricLineage(metric: AuditMetric, value: number | null) {
  return {
    metric,
    value,
    formulaText: "Placeholder formula for a hand-built test fixture.",
    plainEnglish: "Placeholder lineage for a hand-built test fixture.",
    direct: [],
    assumptions: [],
    excluded: []
  };
}

/**
 * Test-only placeholder lineage for hand-built {@link FinanceSummary} fixtures.
 * Phase A1 made `FinanceSummary.lineage` required; fixtures that don't assert on
 * lineage use this to satisfy the type. Pass the fixture's own numbers to keep
 * `lineage.value` consistent with the metric value where a test cares.
 */
export function placeholderSummaryLineage(
  revenue = 0,
  outflow = 0,
  netCash = 0
): FinanceSummary["lineage"] {
  return {
    revenue: placeholderMetricLineage("revenue", revenue),
    outflow: placeholderMetricLineage("outflow", outflow),
    netCash: placeholderMetricLineage("netCash", netCash)
  };
}

/**
 * Test-only placeholder lineage for hand-built {@link CashHealth} fixtures.
 *
 * Phase A1 made `CashHealth.lineage` a required field so that "every cash-health
 * value carries its audit lineage" is a compile-time guarantee. Fixtures that
 * exercise unrelated features (export payloads, renderers, cockpit tone, etc.)
 * don't assert on lineage, so this stamps a structurally valid, value-mirroring
 * lineage without forcing each fixture to spell one out.
 *
 * Values default to the cockpit's "no data" semantics (0 outflow, null runway).
 * Pass the fixture's own numbers to keep `lineage.value` consistent with the
 * metric value where a test cares.
 */
export function placeholderCashHealthLineage(
  averageMonthlyOutflow = 0,
  runwayMonths: number | null = null
): CashHealth["lineage"] {
  return {
    averageMonthlyOutflow: {
      metric: "averageMonthlyOutflow",
      value: averageMonthlyOutflow,
      formulaText: "Average monthly outflow = monthly outflow total / month count",
      plainEnglish: "Placeholder lineage for a hand-built test fixture.",
      direct: [],
      assumptions: [],
      excluded: []
    },
    runwayMonths: {
      metric: "runwayMonths",
      value: runwayMonths,
      formulaText: "Runway = cash on hand / average monthly outflow",
      plainEnglish: "Placeholder lineage for a hand-built test fixture.",
      direct: [],
      assumptions: [],
      excluded: []
    }
  };
}
