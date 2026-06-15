import type { TransactionRecord } from "./types";

export type BudgetScope = "head" | "subcategory";
export type BudgetFlow = "revenue" | "outflow";
export type BudgetVarianceStatus = "under" | "on-track" | "over" | "no-budget";

export interface BudgetEntry {
  id: string;
  month: string;
  scope: BudgetScope;
  key: string;
  flow: BudgetFlow;
  amount: number;
  note?: string;
}

export interface BudgetVarianceRow {
  id: string;
  month: string;
  scope: BudgetScope;
  key: string;
  flow: BudgetFlow;
  budgeted: number | null;
  actual: number;
  variance: number;
  variancePercent: number | null;
  status: BudgetVarianceStatus;
  note?: string;
}

const ON_TRACK_TOLERANCE = 0.05;

export function subcategoryBudgetKey(head: string, subcategory: string): string {
  return `${head} / ${subcategory}`;
}

export function createBudgetEntry(
  input: Omit<BudgetEntry, "id"> & { id?: string }
): BudgetEntry {
  return {
    id: input.id ?? `budget-${Date.now()}`,
    month: input.month,
    scope: input.scope,
    key: input.key.trim(),
    flow: input.flow,
    amount: Math.max(0, input.amount),
    note: input.note?.trim() || undefined
  };
}

export function validateBudgetEntry(entry: BudgetEntry): string[] {
  const problems: string[] = [];
  if (!/^\d{4}-\d{2}$/.test(entry.month)) problems.push("month must be YYYY-MM");
  if (!entry.key.trim()) problems.push("key is required");
  if (!Number.isFinite(entry.amount) || entry.amount < 0) problems.push("amount must be >= 0");
  if (entry.scope === "subcategory" && !entry.key.includes(" / ")) {
    problems.push("subcategory key must use 'Head / Subcategory'");
  }
  return problems;
}

export function compareBudgetToActual(
  budgets: readonly BudgetEntry[],
  records: readonly TransactionRecord[]
): BudgetVarianceRow[] {
  const budgetedRows = budgets.map((entry) => {
    const actual = actualAmountForBudget(records, entry);
    const variance = actual - entry.amount;
    const variancePercent = entry.amount > 0 ? variance / entry.amount : null;

    return {
      id: entry.id,
      month: entry.month,
      scope: entry.scope,
      key: entry.key,
      flow: entry.flow,
      budgeted: entry.amount,
      actual,
      variance,
      variancePercent,
      status: varianceStatus(entry.flow, entry.amount, actual),
      note: entry.note
    };
  });

  const budgetedKeys = new Set(budgets.map(budgetKey));
  const unbudgetedRows = collectUnbudgetedActuals(records, budgets).filter(
    (row) => !budgetedKeys.has(budgetKey(row))
  );

  return [...budgetedRows, ...unbudgetedRows].sort(compareVarianceRows);
}

function collectUnbudgetedActuals(
  records: readonly TransactionRecord[],
  budgets: readonly BudgetEntry[]
): BudgetVarianceRow[] {
  const activeMonths = new Set(budgets.map((entry) => entry.month));
  const activeScopes = new Set(budgets.map((entry) => entry.scope));
  if (activeMonths.size === 0) return [];

  const grouped = new Map<string, BudgetVarianceRow>();

  for (const record of records) {
    if (!activeMonths.has(record.periodMonthly)) continue;

    for (const scope of activeScopes) {
      const key = scope === "head" ? record.head : subcategoryBudgetKey(record.head, record.subcategory);
      const groupKey = `${record.periodMonthly}|${scope}|${key}|${record.flow}`;
      const existing = grouped.get(groupKey);
      if (existing) {
        existing.actual += record.amount;
        existing.variance = existing.actual;
        continue;
      }

      grouped.set(groupKey, {
        id: `unbudgeted-${groupKey}`,
        month: record.periodMonthly,
        scope,
        key,
        flow: record.flow,
        budgeted: null,
        actual: record.amount,
        variance: record.amount,
        variancePercent: null,
        status: "no-budget"
      });
    }
  }

  return [...grouped.values()];
}

function actualAmountForBudget(
  records: readonly TransactionRecord[],
  entry: Pick<BudgetEntry, "month" | "scope" | "key" | "flow">
): number {
  return records
    .filter(
      (record) =>
        record.periodMonthly === entry.month &&
        record.flow === entry.flow &&
        matchesBudgetScope(record, entry.scope, entry.key)
    )
    .reduce((total, record) => total + record.amount, 0);
}

function matchesBudgetScope(
  record: TransactionRecord,
  scope: BudgetScope,
  key: string
): boolean {
  if (scope === "head") return record.head === key;
  const [head, subcategory] = key.split(" / ").map((part) => part.trim());
  return record.head === head && record.subcategory === subcategory;
}

function varianceStatus(
  flow: BudgetFlow,
  budgeted: number,
  actual: number
): BudgetVarianceStatus {
  if (budgeted <= 0) return actual > 0 ? "over" : "on-track";
  const variancePercent = (actual - budgeted) / budgeted;
  if (Math.abs(variancePercent) <= ON_TRACK_TOLERANCE) return "on-track";
  if (flow === "revenue") return actual >= budgeted ? "over" : "under";
  return actual >= budgeted ? "over" : "under";
}

function budgetKey(
  entry: Pick<BudgetEntry, "month" | "scope" | "key" | "flow">
): string {
  return `${entry.month}|${entry.scope}|${entry.key}|${entry.flow}`;
}

function compareVarianceRows(left: BudgetVarianceRow, right: BudgetVarianceRow): number {
  return (
    left.month.localeCompare(right.month) ||
    left.flow.localeCompare(right.flow) ||
    left.scope.localeCompare(right.scope) ||
    left.key.localeCompare(right.key)
  );
}
