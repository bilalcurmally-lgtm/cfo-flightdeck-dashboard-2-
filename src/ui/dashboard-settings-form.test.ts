import { describe, expect, it } from "vitest";
import {
  readCashOnHand,
  readFutureEventsText,
  type DashboardSettingsFormRoot
} from "./dashboard-settings-form";

describe("readCashOnHand", () => {
  it("reads a positive finite value from the cash input", () => {
    expect(readCashOnHand(root({ cashValue: "2500" }), 100)).toBe(2500);
  });

  it("falls back to default settings and clamps invalid values to zero", () => {
    expect(readCashOnHand(root({ cashValue: null }), 500)).toBe(500);
    expect(readCashOnHand(root({ cashValue: "-20" }), 500)).toBe(0);
    expect(readCashOnHand(root({ cashValue: "not money" }), 500)).toBe(0);
  });
});

describe("readFutureEventsText", () => {
  it("reads future events text from the textarea", () => {
    expect(readFutureEventsText(root({ futureEventsValue: "2026-05-01, 100, Client" }), "")).toBe(
      "2026-05-01, 100, Client"
    );
  });

  it("falls back to default settings when the textarea is missing", () => {
    expect(readFutureEventsText(root({ futureEventsValue: null }), "saved event")).toBe("saved event");
  });
});

function root({
  cashValue = null,
  futureEventsValue = null
}: {
  cashValue?: string | null;
  futureEventsValue?: string | null;
}): DashboardSettingsFormRoot {
  return {
    querySelector: (selector: string) => {
      if (selector === "#cash-on-hand" && cashValue !== null) return { value: cashValue };
      if (selector === "#future-events" && futureEventsValue !== null) {
        return { value: futureEventsValue };
      }
      return null;
    }
  } as unknown as DashboardSettingsFormRoot;
}
