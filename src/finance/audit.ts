import type { CockpitViewModel } from "./cockpit-kpis";
import type { CashFlow } from "./types";

export type LineageKind = "direct" | "derived" | "assumption" | "excluded";

export interface RowRef {
  id: string;
  dateISO: string;
  amount: number;
  head: string;
  flow: CashFlow;
}

export interface Assumption {
  label: string;
  value: number | string;
  source: string;
}

export interface CalcNode {
  label: string;
  value: number;
  op: "sum" | "subtract" | "avg" | "divide" | "count" | "identity";
  rows?: RowRef[];
  children?: CalcNode[];
}

export interface ExclusionRef {
  id: string;
  reason: string;
  confidence: "high" | "medium" | "low";
}

export type AuditMetric =
  | "revenue"
  | "outflow"
  | "netCash"
  | "averageMonthlyOutflow"
  | "runwayMonths";

export interface MetricLineage {
  metric: AuditMetric;
  value: number | null;
  formulaText: string;
  plainEnglish: string;
  direct: RowRef[];
  derived?: CalcNode;
  assumptions: Assumption[];
  excluded: ExclusionRef[];
}

export type MetricLineageMap = Record<AuditMetric, MetricLineage>;

export interface AuditedCockpit extends CockpitViewModel {
  lineage: MetricLineageMap;
}

