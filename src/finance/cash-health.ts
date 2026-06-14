import type { MetricLineage, RowRef } from "./audit";
import type { TransactionRecord } from "./types";

export interface CashHealth {
  averageMonthlyOutflow: number;
  runwayMonths: number | null;
  largestTransaction: TransactionRecord | null;
  revenueConcentration: number;
  lineage: {
    averageMonthlyOutflow: MetricLineage;
    runwayMonths: MetricLineage;
  };
}

export function calculateCashHealth(records: TransactionRecord[], cashOnHand: number): CashHealth {
  const monthlyOutflows = new Map<string, { total: number; rows: RowRef[] }>();
  let largestTransaction: TransactionRecord | null = null;

  for (const record of records) {
    if (!largestTransaction || record.amount > largestTransaction.amount) largestTransaction = record;
    if (record.flow !== "outflow") continue;
    const bucket = monthlyOutflows.get(record.periodMonthly) ?? { total: 0, rows: [] };
    bucket.total += record.amount;
    bucket.rows.push(toRowRef(record));
    monthlyOutflows.set(record.periodMonthly, bucket);
  }

  const monthlyBucketNodes = [...monthlyOutflows.entries()]
    .sort(([periodA], [periodB]) => periodA.localeCompare(periodB))
    .map(([period, bucket]) => ({
      label: `${period} outflow`,
      value: bucket.total,
      op: "sum" as const,
      rows: bucket.rows
    }));
  const averageMonthlyOutflow = average(monthlyBucketNodes.map((bucket) => bucket.value));
  const runwayMonths =
    cashOnHand > 0 && averageMonthlyOutflow > 0 ? cashOnHand / averageMonthlyOutflow : null;
  const averageNode = {
    label: "Average monthly outflow",
    value: averageMonthlyOutflow,
    op: "avg" as const,
    children: monthlyBucketNodes
  };

  return {
    averageMonthlyOutflow,
    runwayMonths,
    largestTransaction,
    revenueConcentration: calculateRevenueConcentration(records),
    lineage: {
      averageMonthlyOutflow: {
        metric: "averageMonthlyOutflow",
        value: averageMonthlyOutflow,
        formulaText: "Average monthly outflow = monthly outflow total / month count",
        plainEnglish: monthlyBucketNodes.length
          ? `Average monthly outflow is based on ${monthlyBucketNodes.length} month${
              monthlyBucketNodes.length === 1 ? "" : "s"
            } with recorded outflows.`
          : "Average monthly outflow is 0 because no outflow rows were imported.",
        direct: monthlyBucketNodes.flatMap((bucket) => bucket.rows ?? []),
        derived: averageNode,
        assumptions: [],
        excluded: []
      },
      runwayMonths: {
        metric: "runwayMonths",
        value: runwayMonths,
        formulaText: "Runway = cash on hand / average monthly outflow",
        plainEnglish:
          runwayMonths === null
            ? "Runway is unknown because cash on hand or average monthly outflow is 0."
            : `Runway uses user-entered cash on hand divided by average monthly outflow.`,
        direct: monthlyBucketNodes.flatMap((bucket) => bucket.rows ?? []),
        derived: {
          label: "Runway",
          value: runwayMonths ?? 0,
          op: "divide",
          children: [
            {
              label: "Cash on hand",
              value: cashOnHand,
              op: "identity"
            },
            averageNode
          ]
        },
        assumptions: [
          {
            label: "Cash on hand",
            value: cashOnHand,
            source: "user-entered"
          }
        ],
        excluded: []
      }
    }
  };
}

function calculateRevenueConcentration(records: TransactionRecord[]): number {
  const revenueRecords = records.filter((record) => record.flow === "revenue");
  const totalRevenue = revenueRecords.reduce((total, record) => total + record.amount, 0);
  if (!totalRevenue) return 0;

  const revenueByHead = new Map<string, number>();
  for (const record of revenueRecords) {
    revenueByHead.set(record.head, (revenueByHead.get(record.head) ?? 0) + record.amount);
  }

  const largestHeadRevenue = Math.max(...revenueByHead.values());
  return largestHeadRevenue / totalRevenue;
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function toRowRef(record: TransactionRecord): RowRef {
  return {
    id: record.id,
    dateISO: record.dateISO,
    amount: record.amount,
    head: record.head,
    flow: record.flow
  };
}
