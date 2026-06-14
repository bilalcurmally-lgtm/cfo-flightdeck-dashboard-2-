import type { MetricLineage, RowRef } from "./audit";
import type { ImportIssue, PeriodGrain, TransactionRecord } from "./types";
import { calculateCashHealth, type CashHealth } from "./cash-health";
import { analyzeImportDiagnostics, type ImportDiagnostics } from "./diagnostics";
import { grainKey } from "./date";

export interface PeriodSummary {
  period: string;
  revenue: number;
  outflow: number;
  netCash: number;
}

export interface HeadSummary {
  head: string;
  flow: TransactionRecord["flow"];
  amount: number;
  count: number;
}

export interface SubcategorySummary {
  head: string;
  subcategory: string;
  flow: TransactionRecord["flow"];
  amount: number;
  count: number;
}

export interface AccountBalance {
  account: string;
  balance: number;
  source: "runningBalance" | "netActivity";
}

export interface QualityWarning {
  level: "info" | "warning";
  message: string;
}

export interface FinanceSummary {
  revenue: number;
  outflow: number;
  netCash: number;
  transactionCount: number;
  periodTrend: PeriodSummary[];
  topHeads: HeadSummary[];
  topSubcategories: SubcategorySummary[];
  accountBalances: AccountBalance[];
  diagnostics: ImportDiagnostics;
  warnings: QualityWarning[];
  cashHealth: CashHealth;
  lineage: {
    revenue: MetricLineage;
    outflow: MetricLineage;
    netCash: MetricLineage;
  };
}

export function summarizeTransactions(
  records: TransactionRecord[],
  rejectedRows: ImportIssue[] = [],
  cashOnHand = 0,
  trendGrain: PeriodGrain = "monthly"
): FinanceSummary {
  const flowTotals = summarizeFlowTotals(records);
  const revenue = flowTotals.revenue.total;
  const outflow = flowTotals.outflow.total;
  const netCash = revenue - outflow;
  const cashHealth = calculateCashHealth(records, cashOnHand);
  const diagnostics = analyzeImportDiagnostics(records);

  return {
    revenue,
    outflow,
    netCash,
    transactionCount: records.length,
    periodTrend: summarizeByPeriod(records, trendGrain),
    topHeads: summarizeTopHeads(records),
    topSubcategories: summarizeTopSubcategories(records),
    accountBalances: summarizeAccountBalances(records),
    diagnostics,
    warnings: buildQualityWarnings(records, rejectedRows, cashHealth, diagnostics),
    cashHealth,
    lineage: {
      revenue: {
        metric: "revenue",
        value: revenue,
        formulaText: "Revenue = sum of revenue rows",
        plainEnglish: `Revenue is the sum of ${flowTotals.revenue.rows.length} imported revenue row${
          flowTotals.revenue.rows.length === 1 ? "" : "s"
        }.`,
        direct: flowTotals.revenue.rows,
        assumptions: [],
        excluded: []
      },
      outflow: {
        metric: "outflow",
        value: outflow,
        formulaText: "Outflow = sum of outflow rows",
        plainEnglish: `Outflow is the sum of ${flowTotals.outflow.rows.length} imported outflow row${
          flowTotals.outflow.rows.length === 1 ? "" : "s"
        }.`,
        direct: flowTotals.outflow.rows,
        assumptions: [],
        excluded: []
      },
      netCash: {
        metric: "netCash",
        value: netCash,
        formulaText: "Net cash = revenue - outflow",
        plainEnglish: "Net cash subtracts imported outflow from imported revenue.",
        direct: flowTotals.allRows,
        derived: {
          label: "Net cash",
          value: netCash,
          op: "subtract",
          children: [
            {
              label: "Revenue",
              value: revenue,
              op: "sum",
              rows: flowTotals.revenue.rows
            },
            {
              label: "Outflow",
              value: outflow,
              op: "sum",
              rows: flowTotals.outflow.rows
            }
          ]
        },
        assumptions: [],
        excluded: []
      }
    }
  };
}

interface FlowTotals {
  revenue: { total: number; rows: RowRef[] };
  outflow: { total: number; rows: RowRef[] };
  allRows: RowRef[];
}

function summarizeFlowTotals(records: TransactionRecord[]): FlowTotals {
  const totals = {
    revenue: { total: 0, rows: [] as RowRef[] },
    outflow: { total: 0, rows: [] as RowRef[] },
    allRows: [] as RowRef[]
  };

  for (const record of records) {
    const row = toRowRef(record);
    totals[record.flow].total += record.amount;
    totals[record.flow].rows.push(row);
    totals.allRows.push(row);
  }

  return totals;
}

function summarizeByPeriod(records: TransactionRecord[], grain: PeriodGrain): PeriodSummary[] {
  const periods = new Map<string, PeriodSummary>();

  for (const record of records) {
    const period = grainKey(record, grain);
    const summary =
      periods.get(period) ??
      ({
        period,
        revenue: 0,
        outflow: 0,
        netCash: 0
      } satisfies PeriodSummary);

    if (record.flow === "revenue") summary.revenue += record.amount;
    else summary.outflow += record.amount;
    summary.netCash = summary.revenue - summary.outflow;
    periods.set(period, summary);
  }

  return [...periods.values()].sort((a, b) => a.period.localeCompare(b.period));
}

function summarizeTopHeads(records: TransactionRecord[], limit = 5): HeadSummary[] {
  const heads = new Map<string, HeadSummary>();

  for (const record of records) {
    const key = `${record.flow}:${record.head}`;
    const summary =
      heads.get(key) ??
      ({
        head: record.head,
        flow: record.flow,
        amount: 0,
        count: 0
      } satisfies HeadSummary);

    summary.amount += record.amount;
    summary.count += 1;
    heads.set(key, summary);
  }

  return [...heads.values()].sort((a, b) => b.amount - a.amount).slice(0, limit);
}

function summarizeTopSubcategories(records: TransactionRecord[], limit = 5): SubcategorySummary[] {
  const subcategories = new Map<string, SubcategorySummary>();

  for (const record of records) {
    if (record.subcategory === "Unassigned Subcategory") continue;

    const key = `${record.flow}:${record.head}:${record.subcategory}`;
    const summary =
      subcategories.get(key) ??
      ({
        head: record.head,
        subcategory: record.subcategory,
        flow: record.flow,
        amount: 0,
        count: 0
      } satisfies SubcategorySummary);

    summary.amount += record.amount;
    summary.count += 1;
    subcategories.set(key, summary);
  }

  return [...subcategories.values()].sort((a, b) => b.amount - a.amount).slice(0, limit);
}

function summarizeAccountBalances(records: TransactionRecord[]): AccountBalance[] {
  const byAccount = new Map<string, TransactionRecord[]>();

  for (const record of records) {
    const accountRecords = byAccount.get(record.account) ?? [];
    accountRecords.push(record);
    byAccount.set(record.account, accountRecords);
  }

  return [...byAccount.entries()]
    .map(([account, accountRecords]) => {
      const latestWithBalance = [...accountRecords]
        .filter((record) => record.runningBalance !== null)
        .sort((a, b) => b.date.getTime() - a.date.getTime())[0];

      if (latestWithBalance?.runningBalance !== null && latestWithBalance?.runningBalance !== undefined) {
        return {
          account,
          balance: latestWithBalance.runningBalance,
          source: "runningBalance" as const
        };
      }

      return {
        account,
        balance: accountRecords.reduce((total, record) => total + record.signedNet, 0),
        source: "netActivity" as const
      };
    })
    .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));
}

function buildQualityWarnings(
  records: TransactionRecord[],
  rejectedRows: ImportIssue[],
  cashHealth: CashHealth,
  diagnostics: ImportDiagnostics
): QualityWarning[] {
  const warnings: QualityWarning[] = [];
  const fallbackHeadCount = records.filter((record) => record.head === "Unassigned Head").length;
  const fallbackDescriptionCount = records.filter(
    (record) => record.description === "Unassigned"
  ).length;
  const fallbackCounterpartyCount = records.filter(
    (record) => record.counterparty === "Unassigned Counterparty"
  ).length;
  const zeroAmountCount = records.filter((record) => record.amount === 0).length;

  if (!records.length) {
    warnings.push({
      level: "warning",
      message: "No valid transaction rows were imported."
    });
  }

  if (rejectedRows.length) {
    warnings.push({
      level: "warning",
      message: `${rejectedRows.length} row${rejectedRows.length === 1 ? "" : "s"} rejected during import.`
    });
  }

  if (fallbackHeadCount) {
    warnings.push({
      level: "info",
      message: `${fallbackHeadCount} row${fallbackHeadCount === 1 ? "" : "s"} missing a category/head.`
    });
  }

  if (fallbackDescriptionCount) {
    warnings.push({
      level: "info",
      message: `${fallbackDescriptionCount} row${
        fallbackDescriptionCount === 1 ? "" : "s"
      } missing a description.`
    });
  }

  if (fallbackCounterpartyCount) {
    warnings.push({
      level: "info",
      message: `${fallbackCounterpartyCount} row${
        fallbackCounterpartyCount === 1 ? "" : "s"
      } missing a vendor/customer.`
    });
  }

  if (zeroAmountCount) {
    warnings.push({
      level: "info",
      message: `${zeroAmountCount} row${zeroAmountCount === 1 ? "" : "s"} imported with a zero amount.`
    });
  }

  if (diagnostics.duplicateGroups.length) {
    warnings.push({
      level: "warning",
      message: `${diagnostics.duplicateGroups.length} possible duplicate group${
        diagnostics.duplicateGroups.length === 1 ? "" : "s"
      } found.`
    });
  }

  if (diagnostics.transferCandidates.length) {
    warnings.push({
      level: "info",
      message: `${diagnostics.transferCandidates.length} possible transfer${
        diagnostics.transferCandidates.length === 1 ? "" : "s"
      } found.`
    });
  }

  if (cashHealth.revenueConcentration >= 0.75) {
    warnings.push({
      level: "warning",
      message: `${Math.round(
        cashHealth.revenueConcentration * 100
      )}% of revenue comes from one head.`
    });
  }

  if (cashHealth.largestTransaction && cashHealth.largestTransaction.amount >= records.reduce((total, record) => total + record.amount, 0) * 0.5) {
    warnings.push({
      level: "info",
      message: `Largest transaction is ${cashHealth.largestTransaction.head} at ${cashHealth.largestTransaction.amount}.`
    });
  }

  return warnings;
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
