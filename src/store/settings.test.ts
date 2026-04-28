import { describe, expect, it } from "vitest";
import { clearSettings, DEFAULT_SETTINGS, loadSettings, saveSettings } from "./settings";

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
