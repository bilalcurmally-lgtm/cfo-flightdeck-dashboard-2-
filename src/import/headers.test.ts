import { describe, expect, it } from "vitest";
import { normalizeImportedHeaders } from "./headers";

describe("normalizeImportedHeaders", () => {
  it("keeps duplicate columns addressable with stable suffixes", () => {
    expect(normalizeImportedHeaders(["Date", "Amount", "Amount", "Date", ""])).toEqual([
      "Date",
      "Amount",
      "Amount_2",
      "Date_2",
      "column_5"
    ]);
  });
});
