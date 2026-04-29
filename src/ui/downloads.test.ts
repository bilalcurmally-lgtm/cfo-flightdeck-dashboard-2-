import { describe, expect, it } from "vitest";
import { filteredTransactionsFilename } from "./downloads";

describe("filteredTransactionsFilename", () => {
  it("uses the shared safe export stem for filtered CSV names", () => {
    expect(
      filteredTransactionsFilename("Founder Sample.xlsx", new Date("2026-04-29T00:00:00Z"))
    ).toBe("founder-sample-2026-04-29-filtered-transactions.csv");
  });

  it("falls back to a stable source name for unsafe input", () => {
    expect(filteredTransactionsFilename("...", new Date("2026-04-29T00:00:00Z"))).toBe(
      "finance-2026-04-29-filtered-transactions.csv"
    );
  });
});
