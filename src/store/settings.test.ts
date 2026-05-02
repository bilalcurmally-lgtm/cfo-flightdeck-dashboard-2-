import { describe, expect, it } from "vitest";
import {
  clearSettings,
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  selectCashOnHand,
  selectCurrency,
  selectFutureEventsText
} from "./settings";

describe("settings storage", () => {
  it("loads defaults when storage is empty", () => {
    expect(loadSettings(storage())).toEqual(DEFAULT_SETTINGS);
  });

  it("round-trips valid settings", () => {
    const fakeStorage = storage();
    const settings = { currency: "PKR", cashOnHand: 1200, futureEventsText: "2026-05-01, 500, Paid" };

    saveSettings(settings, fakeStorage);

    expect(loadSettings(fakeStorage)).toEqual(settings);
  });

  it("recovers from corrupt settings", () => {
    const fakeStorage = storage();
    fakeStorage.setItem("billu-works-dashboard-v2-settings", "{nope");

    expect(loadSettings(fakeStorage)).toEqual(DEFAULT_SETTINGS);
  });

  it("clears saved settings", () => {
    const fakeStorage = storage();
    saveSettings({ currency: "PKR", cashOnHand: 1200, futureEventsText: "2026-05-01, 500, Paid" }, fakeStorage);

    clearSettings(fakeStorage);

    expect(loadSettings(fakeStorage)).toEqual(DEFAULT_SETTINGS);
  });
});

describe("settings transitions", () => {
  it("updates cash on hand while clamping invalid values to zero", () => {
    const settings = { ...DEFAULT_SETTINGS, currency: "PKR" };

    expect(selectCashOnHand(settings, 2500)).toEqual({ ...settings, cashOnHand: 2500 });
    expect(selectCashOnHand(settings, -100)).toEqual({ ...settings, cashOnHand: 0 });
    expect(selectCashOnHand(settings, Number.NaN)).toEqual({ ...settings, cashOnHand: 0 });
  });

  it("updates future events text and currency", () => {
    const settings = { ...DEFAULT_SETTINGS, cashOnHand: 500 };

    expect(selectFutureEventsText(settings, "2026-05-01, 500, Paid")).toEqual({
      ...settings,
      futureEventsText: "2026-05-01, 500, Paid"
    });
    expect(selectCurrency(settings, "PKR")).toEqual({ ...settings, currency: "PKR" });
  });
});

function storage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => [...values.keys()][index] ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value)
  };
}
