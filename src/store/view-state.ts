import { DEFAULT_FILTERS, type DashboardFilters } from "../finance/filters";
import { isReviewPreset, type ReviewPreset } from "../finance/review-presets";
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

export function selectDashboardFilter(
  state: DashboardViewState,
  key: keyof DashboardFilters,
  value: string
): DashboardViewState {
  return {
    ...state,
    filters: {
      ...state.filters,
      [key]: value
    }
  };
}

export function selectTrendGrain(state: DashboardViewState, value: string): DashboardViewState {
  if (value !== "daily" && value !== "weekly" && value !== "monthly") return state;
  return {
    ...state,
    trendGrain: value
  };
}

export function selectReviewPreset(state: DashboardViewState, value: string | undefined): DashboardViewState {
  if (!isReviewPreset(value)) return state;
  return {
    ...state,
    reviewPreset: value
  };
}
