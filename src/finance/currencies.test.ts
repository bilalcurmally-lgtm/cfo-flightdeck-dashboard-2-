import { describe, expect, it } from "vitest";
import { currencyOptions, supportedCurrencyCodes } from "./currencies";

describe("supportedCurrencyCodes", () => {
  it("covers the broad ISO currency set", () => {
    const codes = supportedCurrencyCodes();

    expect(codes.length).toBeGreaterThanOrEqual(150);
    expect(codes).toEqual([...codes].sort());
    expect(codes).toEqual(expect.arrayContaining(["USD", "PKR", "EUR", "JPY", "XOF", "VUV"]));
  });
});

describe("currencyOptions", () => {
  it("labels currencies with code first", () => {
    const usd = currencyOptions("en").find((option) => option.code === "USD");

    expect(usd?.label).toMatch(/^USD\b/);
  });
});
