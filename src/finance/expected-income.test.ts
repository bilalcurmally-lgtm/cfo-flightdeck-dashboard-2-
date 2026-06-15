import { describe, expect, it } from "vitest";
import {
  activeExpectedIncomeEvents,
  createExpectedIncomeEvent,
  resolveForecastEvents,
  validateExpectedIncomeEvent
} from "./expected-income";

describe("resolveForecastEvents", () => {
  it("merges structured expected income with legacy text events", () => {
    const resolved = resolveForecastEvents(
      [
        createExpectedIncomeEvent({
          dueDate: "2026-06-15",
          amount: 3000,
          label: "Client retainer",
          status: "expected"
        })
      ],
      "2026-07-01, 1200, Follow-up invoice"
    );

    expect(resolved.events).toEqual([
      { dateISO: "2026-06-15", amount: 3000, label: "Client retainer (expected)" },
      { dateISO: "2026-07-01", amount: 1200, label: "Follow-up invoice" }
    ]);
    expect(resolved.structuredCount).toBe(1);
    expect(resolved.textCount).toBe(1);
    expect(resolved.rejectedEvents).toEqual([]);
  });

  it("keeps text parser rejections and skips received structured events", () => {
    const resolved = resolveForecastEvents(
      [
        createExpectedIncomeEvent({
          dueDate: "2026-06-15",
          amount: 3000,
          label: "Paid already",
          status: "received"
        })
      ],
      "soon, nope, Mystery"
    );

    expect(resolved.events).toEqual([]);
    expect(resolved.rejectedEvents).toEqual(["Line 1: soon, nope, Mystery"]);
    expect(
      activeExpectedIncomeEvents([
        createExpectedIncomeEvent({
          dueDate: "2026-06-15",
          amount: 3000,
          label: "Paid already",
          status: "received"
        })
      ])
    ).toEqual([]);
  });

  it("dedupes text events that match structured events", () => {
    const resolved = resolveForecastEvents(
      [
        createExpectedIncomeEvent({
          dueDate: "2026-06-15",
          amount: 3000,
          label: "Client retainer",
          status: "tentative"
        })
      ],
      "2026-06-15, 3000, Client retainer (tentative)"
    );

    expect(resolved.events).toHaveLength(1);
    expect(resolved.textCount).toBe(0);
  });

  it("dedupes text events using the operator label before status suffixes are added", () => {
    const resolved = resolveForecastEvents(
      [
        createExpectedIncomeEvent({
          dueDate: "2026-06-15",
          amount: 3000,
          label: "Client retainer",
          status: "expected"
        })
      ],
      "2026-06-15, 3000, Client retainer"
    );

    expect(resolved.events).toEqual([
      { dateISO: "2026-06-15", amount: 3000, label: "Client retainer (expected)" }
    ]);
    expect(resolved.textCount).toBe(0);
  });
});

describe("validateExpectedIncomeEvent", () => {
  it("requires a valid due date and positive amount", () => {
    expect(
      validateExpectedIncomeEvent({
        id: "income-invalid",
        dueDate: "bad",
        amount: 0,
        label: "",
        status: "expected"
      })
    ).toEqual(
      expect.arrayContaining(["dueDate must be YYYY-MM-DD", "amount must be > 0", "label is required"])
    );
  });
});
