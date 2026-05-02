import { describe, expect, it } from "vitest";
import {
  createDashboardViewState,
  resetDashboardFilters,
  selectDashboardFilter,
  selectReviewPreset,
  selectTransaction,
  selectTrendGrain
} from "./view-state";

describe("createDashboardViewState", () => {
  it("starts the dashboard on the full monthly review view", () => {
    expect(createDashboardViewState()).toEqual({
      filters: {
        flow: "all",
        account: "all",
        head: "all",
        subcategory: "all",
        counterparty: "all",
        dateFrom: "",
        dateTo: ""
      },
      trendGrain: "monthly",
      reviewPreset: "all",
      selectedTransactionId: ""
    });
  });
});

describe("resetDashboardFilters", () => {
  it("keeps trend and selected row while clearing filters and preset", () => {
    const state = {
      ...createDashboardViewState(),
      filters: {
        ...createDashboardViewState().filters,
        flow: "revenue",
        account: "Checking"
      },
      trendGrain: "weekly" as const,
      reviewPreset: "duplicates" as const,
      selectedTransactionId: "txn-1"
    };

    expect(resetDashboardFilters(state)).toEqual({
      ...state,
      filters: createDashboardViewState().filters,
      reviewPreset: "all"
    });
  });
});

describe("selectTransaction", () => {
  it("updates the selected transaction without changing the rest of the state", () => {
    const state = createDashboardViewState();

    expect(selectTransaction(state, "txn-2")).toEqual({
      ...state,
      selectedTransactionId: "txn-2"
    });
  });
});

describe("selectDashboardFilter", () => {
  it("updates one filter without changing other dashboard state", () => {
    const state = createDashboardViewState();

    expect(selectDashboardFilter(state, "account", "Checking")).toEqual({
      ...state,
      filters: {
        ...state.filters,
        account: "Checking"
      }
    });
  });
});

describe("selectTrendGrain", () => {
  it("accepts known trend grains and ignores unknown values", () => {
    const state = createDashboardViewState();

    expect(selectTrendGrain(state, "weekly")).toEqual({
      ...state,
      trendGrain: "weekly"
    });
    expect(selectTrendGrain(state, "quarterly")).toBe(state);
  });
});

describe("selectReviewPreset", () => {
  it("accepts known review presets and ignores unknown values", () => {
    const state = createDashboardViewState();

    expect(selectReviewPreset(state, "duplicates")).toEqual({
      ...state,
      reviewPreset: "duplicates"
    });
    expect(selectReviewPreset(state, "largest")).toBe(state);
  });
});
