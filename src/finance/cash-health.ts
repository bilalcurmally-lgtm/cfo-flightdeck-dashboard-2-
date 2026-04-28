import type { TransactionRecord } from "./types";

export interface CashHealth {
  averageMonthlyOutflow: number;
  runwayMonths: number | null;
  largestTransaction: TransactionRecord | null;
  revenueConcentration: number;
}

export function calculateCashHealth(records: TransactionRecord[], cashOnHand: number): CashHealth {
  const monthlyOutflows = new Map<string, number>();
  let largestTransaction: TransactionRecord | null = null;

  for (const record of records) {
    if (!largestTransaction || record.amount > largestTransaction.amount) largestTransaction = record;
    if (record.flow !== "outflow") continue;
    monthlyOutflows.set(
      record.periodMonthly,
      (monthlyOutflows.get(record.periodMonthly) ?? 0) + record.amount
    );
  }

  const averageMonthlyOutflow = average([...monthlyOutflows.values()]);

  return {
    averageMonthlyOutflow,
    runwayMonths:
      cashOnHand > 0 && averageMonthlyOutflow > 0 ? cashOnHand / averageMonthlyOutflow : null,
    largestTransaction,
    revenueConcentration: calculateRevenueConcentration(records)
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
