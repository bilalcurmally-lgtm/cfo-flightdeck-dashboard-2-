import { describe, expect, it } from "vitest";
import { analyzeImportReadiness } from "./validation";

describe("analyzeImportReadiness", () => {
  it("summarizes required column and invalid row readiness", () => {
    const readiness = analyzeImportReadiness(
      [
        { Date: "2026-03-01", Amount: "100", Account: "Checking" },
        { Date: "nope", Amount: "50", Account: "" },
        { Date: "2026-03-03", Amount: "bad", Account: "Savings" }
      ],
      { date: "Date", amount: "Amount", account: "Account" },
      "ymd"
    );

    expect(readiness).toMatchObject({
      rawRows: 3,
      acceptedRows: 1,
      rejectedRows: 2,
      missingRequiredColumns: [],
      invalidDateRows: 1,
      invalidAmountRows: 1,
      optionalCoverage: [{ key: "account", column: "Account", filledRows: 2 }]
    });
  });

  it("reports missing required columns", () => {
    const readiness = analyzeImportReadiness([{ Memo: "Invoice" }], { date: "", amount: "" }, "ymd");

    expect(readiness).toMatchObject({
      acceptedRows: 0,
      rejectedRows: 1,
      missingRequiredColumns: ["date", "amount"],
      invalidDateRows: 1,
      invalidAmountRows: 1
    });
  });
});
