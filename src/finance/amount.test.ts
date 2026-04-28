import { describe, expect, it } from "vitest";
import { classifyFlow, parseAmount } from "./amount";

describe("parseAmount", () => {
  it("parses numbers, currencies, commas, decimals, and parenthesized negatives", () => {
    expect(parseAmount("1500")).toBe(1500);
    expect(parseAmount("$1,500")).toBe(1500);
    expect(parseAmount("€2000")).toBe(2000);
    expect(parseAmount("£3000")).toBe(3000);
    expect(parseAmount("99.50")).toBe(99.5);
    expect(parseAmount("(500)")).toBe(-500);
  });

  it("returns null for missing or non-numeric input", () => {
    expect(parseAmount(null)).toBeNull();
    expect(parseAmount(undefined)).toBeNull();
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
  });

  it("keeps zero as a valid amount", () => {
    expect(parseAmount("0")).toBe(0);
  });
});

describe("classifyFlow", () => {
  const revenueTokens = ["revenue", "inflow", "sales"];
  const outflowTokens = ["outflow", "expense", "payment"];

  it("classifies by token before falling back to amount sign", () => {
    expect(classifyFlow("sales income", 100, revenueTokens, outflowTokens)).toBe("revenue");
    expect(classifyFlow("expense item", 100, revenueTokens, outflowTokens)).toBe("outflow");
    expect(classifyFlow("", 100, revenueTokens, outflowTokens)).toBe("revenue");
    expect(classifyFlow("", -100, revenueTokens, outflowTokens)).toBe("outflow");
  });

  it("lets revenue token matches take precedence when aliases overlap", () => {
    expect(classifyFlow("cash flow", 100, ["cash"], ["cash"])).toBe("revenue");
  });
});
