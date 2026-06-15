import { describe, expect, it } from "vitest";
import { rec } from "./classification-overrides.test";
import {
  compareBudgetToActual,
  createBudgetEntry,
  subcategoryBudgetKey,
  validateBudgetEntry
} from "./budget";

describe("compareBudgetToActual", () => {
  it("computes variance for head-level monthly budgets", () => {
    const rows = compareBudgetToActual(
      [
        createBudgetEntry({
          month: "2026-05",
          scope: "head",
          key: "Client",
          flow: "revenue",
          amount: 5000
        })
      ],
      [
        rec({ head: "Client", flow: "revenue", amount: 5200, signedNet: 5200, periodMonthly: "2026-05" }),
        rec({ head: "Rent", flow: "outflow", amount: 1000, signedNet: -1000, periodMonthly: "2026-05" })
      ]
    );

    expect(rows.find((row) => row.key === "Client" && row.budgeted === 5000)).toMatchObject({
      key: "Client",
      budgeted: 5000,
      actual: 5200,
      variance: 200,
      status: "on-track"
    });
  });

  it("flags over and under spend against outflow budgets", () => {
    const rows = compareBudgetToActual(
      [
        createBudgetEntry({
          month: "2026-05",
          scope: "head",
          key: "Rent",
          flow: "outflow",
          amount: 1000
        })
      ],
      [rec({ head: "Rent", flow: "outflow", amount: 1500, signedNet: -1500, periodMonthly: "2026-05" })]
    );

    expect(rows[0].status).toBe("over");
    expect(rows[0].variance).toBe(500);
  });

  it("adds no-budget rows for actuals in budget months without a matching plan", () => {
    const rows = compareBudgetToActual(
      [
        createBudgetEntry({
          month: "2026-05",
          scope: "head",
          key: "Client",
          flow: "revenue",
          amount: 5000
        })
      ],
      [rec({ head: "Software", flow: "outflow", amount: 300, signedNet: -300, periodMonthly: "2026-05" })]
    );

    expect(rows.some((row) => row.status === "no-budget" && row.key === "Software")).toBe(true);
    expect(rows.some((row) => row.status === "no-budget" && row.scope === "subcategory")).toBe(false);
  });

  it("supports subcategory keys", () => {
    const key = subcategoryBudgetKey("Client", "Retainer");
    const rows = compareBudgetToActual(
      [
        createBudgetEntry({
          month: "2026-05",
          scope: "subcategory",
          key,
          flow: "revenue",
          amount: 2000
        })
      ],
      [
        rec({
          head: "Client",
          subcategory: "Retainer",
          flow: "revenue",
          amount: 1800,
          signedNet: 1800,
          periodMonthly: "2026-05"
        })
      ]
    );

    expect(rows.find((row) => row.scope === "subcategory" && row.key === key)).toMatchObject({
      scope: "subcategory",
      key,
      actual: 1800,
      status: "under"
    });
  });
});

describe("validateBudgetEntry", () => {
  it("requires a month, key, and non-negative amount", () => {
    expect(
      validateBudgetEntry({
        id: "budget-invalid",
        month: "bad",
        scope: "head",
        key: "",
        flow: "revenue",
        amount: -1
      })
    ).toEqual(
      expect.arrayContaining([
        "month must be YYYY-MM",
        "key is required",
        "amount must be >= 0"
      ])
    );
  });
});
