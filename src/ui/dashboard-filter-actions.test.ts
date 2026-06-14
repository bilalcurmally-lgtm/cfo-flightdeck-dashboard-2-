import { describe, expect, it } from "vitest";
import type { CsvImportResult } from "../finance/types";
import { createDashboardViewState, type DashboardViewState } from "../store/view-state";
import {
  bindDashboardFilterActions,
  type ActiveDashboardImport,
  type DashboardFilterActionRoot
} from "./dashboard-filter-actions";

describe("bindDashboardFilterActions", () => {
  it("updates a dashboard field filter and refocuses the rerendered control", () => {
    let state = createDashboardViewState();
    const activeImport = importState();
    const flowSelect = control({ filterKey: "flow" }, "revenue");
    const focusedFlowSelect = control({ filterKey: "flow" }, "revenue");
    let rendered: ActiveDashboardImport | null = null;

    bindDashboardFilterActions({
      root: root({
        all: { "[data-filter-key]": [flowSelect] },
        one: { '[data-filter-key="flow"]': focusedFlowSelect }
      }),
      getActiveImport: () => activeImport,
      getViewState: () => state,
      setViewState: (nextState) => {
        state = nextState;
      },
      renderActiveImport: (nextImport) => {
        rendered = nextImport;
      }
    });

    flowSelect.fire("change");

    expect(state.filters.flow).toBe("revenue");
    expect(rendered).toBe(activeImport);
    expect(focusedFlowSelect.focusCount).toBe(1);
  });

  it("updates trend grain and ignores unsupported values", () => {
    let state = createDashboardViewState();
    const trendSelect = control({}, "weekly");
    let renderCount = 0;

    bindDashboardFilterActions({
      root: root({ one: { "#trend-grain": trendSelect } }),
      getActiveImport: () => importState(),
      getViewState: () => state,
      setViewState: (nextState) => {
        state = nextState;
      },
      renderActiveImport: () => {
        renderCount += 1;
      }
    });

    trendSelect.fire("change");
    expect(state.trendGrain).toBe("weekly");
    expect(renderCount).toBe(1);

    trendSelect.value = "quarterly";
    trendSelect.fire("change");
    expect(state.trendGrain).toBe("weekly");
    expect(renderCount).toBe(1);
  });

  it("resets filters and applies review presets", () => {
    let state: DashboardViewState = {
      ...createDashboardViewState(),
      filters: { ...createDashboardViewState().filters, flow: "outflow" },
      reviewPreset: "outflow"
    };
    const resetButton = control({}, "");
    const duplicateButton = control({ reviewPreset: "duplicates" }, "");
    let renderCount = 0;

    bindDashboardFilterActions({
      root: root({
        all: { "[data-review-preset]": [duplicateButton] },
        one: {
          "#reset-filters": resetButton,
          '[data-review-preset="duplicates"]': duplicateButton
        }
      }),
      getActiveImport: () => importState(),
      getViewState: () => state,
      setViewState: (nextState) => {
        state = nextState;
      },
      renderActiveImport: () => {
        renderCount += 1;
      }
    });

    resetButton.fire("click");
    expect(state.filters.flow).toBe("all");
    expect(state.reviewPreset).toBe("all");

    duplicateButton.fire("click");
    expect(state.reviewPreset).toBe("duplicates");
    expect(renderCount).toBe(2);
  });

  it("applies summary drilldown filters and clears review preset context", () => {
    let state: DashboardViewState = {
      ...createDashboardViewState(),
      reviewPreset: "duplicates"
    };
    const drilldownButton = control(
      {
        drilldownFlow: "outflow",
        drilldownHead: "Software",
        drilldownSubcategory: "Hosting"
      },
      ""
    );
    const focusedDrilldownButton = control({}, "");
    let renderCount = 0;

    bindDashboardFilterActions({
      root: root({
        all: {
          "[data-drilldown-flow], [data-drilldown-account], [data-drilldown-head], [data-drilldown-subcategory]": [
            drilldownButton
          ]
        },
        one: {
          '[data-drilldown-flow="outflow"][data-drilldown-head="Software"][data-drilldown-subcategory="Hosting"]':
            focusedDrilldownButton
        }
      }),
      getActiveImport: () => importState(),
      getViewState: () => state,
      setViewState: (nextState) => {
        state = nextState;
      },
      renderActiveImport: () => {
        renderCount += 1;
      }
    });

    drilldownButton.fire("click");

    expect(state.filters.flow).toBe("outflow");
    expect(state.filters.head).toBe("Software");
    expect(state.filters.subcategory).toBe("Hosting");
    expect(state.reviewPreset).toBe("all");
    expect(renderCount).toBe(1);
    expect(focusedDrilldownButton.focusCount).toBe(1);
  });
});

function root({
  all = {},
  one = {}
}: {
  all?: Record<string, FakeControl[]>;
  one?: Record<string, FakeControl>;
}): DashboardFilterActionRoot {
  return {
    querySelectorAll: (selector: string) => all[selector] ?? [],
    querySelector: (selector: string) => one[selector] ?? null
  } as unknown as DashboardFilterActionRoot;
}

interface FakeControl {
  dataset: Record<string, string>;
  value: string;
  focusCount: number;
  addEventListener: (event: string, listener: (event: { target: FakeControl }) => void) => void;
  focus: () => void;
  fire: (event: string) => void;
}

function control(dataset: Record<string, string>, value: string): FakeControl {
  const listeners = new Map<string, (event: { target: FakeControl }) => void>();
  const element: FakeControl = {
    dataset,
    value,
    focusCount: 0,
    addEventListener: (event, listener) => {
      listeners.set(event, listener);
    },
    focus: () => {
      element.focusCount += 1;
    },
    fire: (event) => {
      listeners.get(event)?.({ target: element });
    }
  };
  return element;
}

function importState(): ActiveDashboardImport {
  return {
    result: {
      rawRows: [],
      records: [],
      rejectedRows: [],
      mapping: { date: "", amount: "" },
      dateFormat: "ymd"
    } satisfies CsvImportResult,
    sourceName: "sample.csv"
  };
}
