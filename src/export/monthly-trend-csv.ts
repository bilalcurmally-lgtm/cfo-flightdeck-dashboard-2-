import type { PeriodSummary } from "../finance/summary";
import type { PeriodGrain } from "../finance/types";
import { exportDateStamp, safeExportStem } from "./filenames";

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
  return `${safeExportStem(sourceName)}-visible-${grain}-trend-${exportDateStamp(generatedAt)}.csv`;
}
