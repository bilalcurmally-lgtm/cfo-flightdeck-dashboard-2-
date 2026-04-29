import { DEFAULT_FILTERS, type DashboardFilters } from "../finance/filters";
import type { ReviewPreset } from "../finance/review-presets";
import type { PeriodGrain } from "../finance/types";

export interface DashboardViewState {
  filters: DashboardFilters;
  trendGrain: PeriodGrain;
  reviewPreset: ReviewPreset;
  selectedTransactionId: string;
}

export function createDashboardViewState(): DashboardViewState {
  return {
    filters: { ...DEFAULT_FILTERS },
    trendGrain: "monthly",
    reviewPreset: "all",
    selectedTransactionId: ""
  };
}

export function resetDashboardFilters(state: DashboardViewState): DashboardViewState {
  return {
    ...state,
    filters: { ...DEFAULT_FILTERS },
    reviewPreset: "all"
  };
}

export function selectTransaction(
  state: DashboardViewState,
  selectedTransactionId: string
): DashboardViewState {
  return {
    ...state,
    selectedTransactionId
  };
}
