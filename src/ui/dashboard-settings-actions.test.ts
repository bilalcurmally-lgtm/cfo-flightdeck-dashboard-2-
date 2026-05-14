import { describe, expect, it } from "vitest";
import type { AppSettings } from "../store/settings";
import { bindDashboardSettingsActions, type DashboardSettingsActionRoot } from "./dashboard-settings-actions";

describe("bindDashboardSettingsActions", () => {
  it("persists settings changes, rerenders, and restores focus", () => {
    const elements = {
      "#cash-on-hand": input("2500"),
      "#future-events": textarea("2026-05-01, 100, Client", 10),
      "#currency-select": input("PKR"),
      "#reset-settings": button()
    };
    let settings: AppSettings = { currency: "USD", cashOnHand: 0, futureEventsText: "" };
    const saved: AppSettings[] = [];
    let clearCount = 0;
    const renderSources: string[] = [];

    bindDashboardSettingsActions({
      root: root(elements),
      getActiveImport: () => ({ result: {}, sourceName: "sample.csv" }),
      getSettings: () => settings,
      setSettings: (nextSettings) => {
        settings = nextSettings;
      },
      renderActiveImport: (activeImport) => {
        renderSources.push(activeImport.sourceName);
      },
      save: (nextSettings) => {
        saved.push(nextSettings);
      },
      clear: () => {
        clearCount += 1;
      }
    });

    elements["#cash-on-hand"].fire("input");
    expect(settings.cashOnHand).toBe(2500);
    expect(elements["#cash-on-hand"].focusCount).toBe(1);

    elements["#future-events"].value = "2026-05-02, -50, Hosting";
    elements["#future-events"].selectionStart = 8;
    elements["#future-events"].fire("input");
    expect(settings.futureEventsText).toBe("2026-05-02, -50, Hosting");
    expect(elements["#future-events"].selectionRange).toEqual([8, 8]);

    elements["#currency-select"].value = "EUR";
    elements["#currency-select"].fire("change");
    expect(settings.currency).toBe("EUR");

    elements["#reset-settings"].fire("click");
    expect(settings).toEqual({ currency: "USD", cashOnHand: 0, futureEventsText: "" });
    expect(clearCount).toBe(1);
    expect(saved).toHaveLength(3);
    expect(renderSources).toEqual(["sample.csv", "sample.csv", "sample.csv", "sample.csv"]);
  });

  it("ignores input when no import is active", () => {
    const elements = {
      "#cash-on-hand": input("2500"),
      "#future-events": textarea("", 0),
      "#currency-select": input("PKR"),
      "#reset-settings": button()
    };
    let settings: AppSettings = { currency: "USD", cashOnHand: 0, futureEventsText: "" };

    bindDashboardSettingsActions({
      root: root(elements),
      getActiveImport: () => null,
      getSettings: () => settings,
      setSettings: (nextSettings) => {
        settings = nextSettings;
      },
      renderActiveImport: () => {
        throw new Error("render should not run without an active import");
      },
      save: () => {
        throw new Error("save should not run without an active import");
      },
      clear: () => {
        throw new Error("clear should not run without an active import");
      }
    });

    elements["#cash-on-hand"].fire("input");
    elements["#future-events"].fire("input");
    elements["#currency-select"].fire("change");
    elements["#reset-settings"].fire("click");

    expect(settings).toEqual({ currency: "USD", cashOnHand: 0, futureEventsText: "" });
  });
});

type FakeElement = ReturnType<typeof input>;

function root(elements: Record<string, FakeElement>): DashboardSettingsActionRoot {
  return {
    querySelector: (selector: string) => elements[selector] ?? null
  } as unknown as DashboardSettingsActionRoot;
}

function input(value: string) {
  const listeners = new Map<string, () => void>();
  const element = {
    value,
    selectionStart: 0,
    selectionRange: [] as number[],
    focusCount: 0,
    addEventListener: (event: string, listener: () => void) => {
      listeners.set(event, listener);
    },
    fire: (event: string) => {
      listeners.get(event)?.();
    },
    focus: () => {
      element.focusCount += 1;
    },
    setSelectionRange: (start: number, end: number) => {
      element.selectionRange = [start, end];
    }
  };
  return element;
}

function textarea(value: string, selectionStart: number) {
  const element = input(value);
  element.selectionStart = selectionStart;
  return element;
}

function button() {
  return input("");
}
