import type { PeriodSummary } from "../finance/summary";
import type { PeriodGrain } from "../finance/types";

export function buildMonthlyTrendCsv(periods: PeriodSummary[]): string {
  const header = "period,revenue,outflow,netCash";
  const lines = periods.map((period) =>
    [period.period, period.revenue, period.outflow, period.netCash].join(",")
  );

  return [header, ...lines].join("\n");
}

export function monthlyTrendCsvFilename(
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

  return `${safeSource || "finance"}-visible-${grain}-trend-${dateStamp}.csv`;
}
