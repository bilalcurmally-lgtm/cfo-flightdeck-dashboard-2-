import type { TransactionRecord } from "./types";

export type FilterableField = "flow" | "account" | "head" | "subcategory" | "counterparty";

export interface DashboardFilters {
  flow: string;
  account: string;
  head: string;
  subcategory: string;
  counterparty: string;
  dateFrom: string;
  dateTo: string;
}

export const DEFAULT_FILTERS: DashboardFilters = {
  flow: "all",
  account: "all",
  head: "all",
  subcategory: "all",
  counterparty: "all",
  dateFrom: "",
  dateTo: ""
};

export function filterTransactions(
  records: TransactionRecord[],
  filters: DashboardFilters
): TransactionRecord[] {
  return records.filter((record) => {
    const fieldMatches = (["flow", "account", "head", "subcategory", "counterparty"] as const).every(
      (key) => filters[key] === "all" || record[key] === filters[key]
    );
    if (!fieldMatches) return false;
    if (filters.dateFrom && record.dateISO < filters.dateFrom) return false;
    if (filters.dateTo && record.dateISO > filters.dateTo) return false;
    return true;
  });
}

export function optionValues(records: TransactionRecord[], key: FilterableField): string[] {
  return [...new Set(records.map((record) => record[key]).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );
}
