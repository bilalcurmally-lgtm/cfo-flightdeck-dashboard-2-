import { describe, expect, it } from "vitest";
import { formatCurrency, formatRunway } from "./formatters";

describe("formatCurrency", () => {
  it("formats values with the requested currency code", () => {
    expect(formatCurrency(1234, "USD")).toContain("$");
    expect(formatCurrency(1234, "PKR")).toMatch(/PKR|Rs|₨/);
  });
});

describe("formatRunway", () => {
  it("formats runway months or missing data", () => {
    expect(formatRunway(2.25)).toBe("2.3 months");
    expect(formatRunway(null)).toBe("Not enough data");
  });
});
