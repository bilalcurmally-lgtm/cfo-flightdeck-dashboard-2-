import type { AuditedCockpit } from "./audit";
import { deriveCockpit, type DeriveCockpitInput } from "./cockpit-kpis";

export function deriveAuditedCockpit(input: DeriveCockpitInput): AuditedCockpit {
  const cockpit = deriveCockpit(input);

  return {
    ...cockpit,
    lineage: {
      revenue: input.summary.lineage.revenue,
      outflow: input.summary.lineage.outflow,
      netCash: input.summary.lineage.netCash,
      averageMonthlyOutflow: input.summary.cashHealth.lineage.averageMonthlyOutflow,
      runwayMonths: input.summary.cashHealth.lineage.runwayMonths
    }
  };
}
