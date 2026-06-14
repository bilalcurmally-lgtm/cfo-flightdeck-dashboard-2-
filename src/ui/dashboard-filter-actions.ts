import type { FilterableField } from "../finance/filters";
import type { CsvImportResult } from "../finance/types";
import {
  resetDashboardFilters,
  selectDashboardFilter,
  selectDashboardFilters,
  selectReviewPreset,
  selectTrendGrain,
  type DashboardViewState
} from "../store/view-state";

export interface ActiveDashboardImport {
  result: CsvImportResult;
  sourceName: string;
}

export interface DashboardFilterActionRoot {
  querySelectorAll<T extends Element = Element>(selector: string): Iterable<T> | ArrayLike<T>;
  querySelector<T extends Element = Element>(selector: string): T | null;
}

export interface DashboardFilterActionBindings {
  root?: DashboardFilterActionRoot;
  getActiveImport: () => ActiveDashboardImport | null;
  getViewState: () => DashboardViewState;
  setViewState: (state: DashboardViewState) => void;
  renderActiveImport: (activeImport: ActiveDashboardImport) => void;
}

export function bindDashboardFilterActions({
  root = document,
  getActiveImport,
  getViewState,
  setViewState,
  renderActiveImport
}: DashboardFilterActionBindings): void {
  Array.from(root.querySelectorAll<HTMLSelectElement>("[data-filter-key]")).forEach((select) => {
    select.addEventListener("change", () => {
      const activeImport = getActiveImport();
      if (!activeImport) return;

      const key = select.dataset.filterKey as FilterableField | undefined;
      if (!key) return;
      setViewState(selectDashboardFilter(getViewState(), key, select.value));
      renderActiveImport(activeImport);
      root.querySelector<HTMLSelectElement>(`[data-filter-key="${key}"]`)?.focus();
    });
  });

  Array.from(root.querySelectorAll<HTMLInputElement>("[data-date-filter-key]")).forEach((input) => {
    input.addEventListener("change", () => {
      const activeImport = getActiveImport();
      if (!activeImport) return;

      const key = input.dataset.dateFilterKey as "dateFrom" | "dateTo" | undefined;
      if (!key) return;
      setViewState(selectDashboardFilter(getViewState(), key, input.value));
      renderActiveImport(activeImport);
      root.querySelector<HTMLInputElement>(`[data-date-filter-key="${key}"]`)?.focus();
    });
  });

  root.querySelector<HTMLSelectElement>("#trend-grain")?.addEventListener("change", (event) => {
    const activeImport = getActiveImport();
    if (!activeImport) return;

    const value = (event.target as HTMLSelectElement).value;
    const previousViewState = getViewState();
    const nextViewState = selectTrendGrain(previousViewState, value);
    if (nextViewState === previousViewState) return;
    setViewState(nextViewState);
    renderActiveImport(activeImport);
    root.querySelector<HTMLSelectElement>("#trend-grain")?.focus();
  });

  root.querySelector<HTMLButtonElement>("#reset-filters")?.addEventListener("click", () => {
    const activeImport = getActiveImport();
    if (!activeImport) return;

    setViewState(resetDashboardFilters(getViewState()));
    renderActiveImport(activeImport);
    root.querySelector<HTMLButtonElement>("#reset-filters")?.focus();
  });

  Array.from(root.querySelectorAll<HTMLButtonElement>("[data-review-preset]")).forEach((button) => {
    button.addEventListener("click", () => {
      const activeImport = getActiveImport();
      if (!activeImport) return;

      const preset = button.dataset.reviewPreset;
      const previousViewState = getViewState();
      const nextViewState = selectReviewPreset(previousViewState, preset);
      if (nextViewState === previousViewState) return;
      setViewState(nextViewState);
      renderActiveImport(activeImport);
      root.querySelector<HTMLButtonElement>(`[data-review-preset="${preset}"]`)?.focus();
    });
  });

  Array.from(root.querySelectorAll<HTMLButtonElement>("[data-drilldown-flow], [data-drilldown-account], [data-drilldown-head], [data-drilldown-subcategory]")).forEach((button) => {
    button.addEventListener("click", () => {
      const activeImport = getActiveImport();
      if (!activeImport) return;

      const nextFilters = drilldownFilters(button.dataset);
      if (!Object.keys(nextFilters).length) return;
      setViewState(selectDashboardFilters(getViewState(), nextFilters));
      renderActiveImport(activeImport);
      focusFirstMatchingDrilldown(root, nextFilters);
    });
  });
}

function drilldownFilters(dataset: DOMStringMap) {
  return {
    ...(dataset.drilldownFlow ? { flow: dataset.drilldownFlow } : {}),
    ...(dataset.drilldownAccount ? { account: dataset.drilldownAccount } : {}),
    ...(dataset.drilldownHead ? { head: dataset.drilldownHead } : {}),
    ...(dataset.drilldownSubcategory ? { subcategory: dataset.drilldownSubcategory } : {})
  };
}

function focusFirstMatchingDrilldown(
  root: DashboardFilterActionRoot,
  filters: ReturnType<typeof drilldownFilters>
): void {
  const selector = Object.entries(filters)
    .map(([key, value]) => `[data-drilldown-${key}="${cssEscape(value)}"]`)
    .join("");
  root.querySelector<HTMLButtonElement>(selector)?.focus();
}

function cssEscape(value: string): string {
  return globalThis.CSS?.escape ? globalThis.CSS.escape(value) : value.replace(/"/g, '\\"');
}
