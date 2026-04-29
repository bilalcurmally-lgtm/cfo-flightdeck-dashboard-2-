import { describe, expect, it } from "vitest";
import { parseCsv } from "./csv";

describe("parseCsv", () => {
  it("parses a simple CSV with headers", () => {
    const rows = parseCsv("Name,Age,City\nAlice,30,NYC\nBob,25,LA");

    expect(rows).toEqual([
      { Name: "Alice", Age: "30", City: "NYC" },
      { Name: "Bob", Age: "25", City: "LA" }
    ]);
  });

  it("strips a leading BOM", () => {
    expect(parseCsv("\uFEFFA,B\n1,2")).toEqual([{ A: "1", B: "2" }]);
  });

  it("handles CRLF and CR-only line endings", () => {
    expect(parseCsv("A,B\r\n1,2\r\n3,4")).toHaveLength(2);
    expect(parseCsv("A,B\r1,2\r3,4")).toHaveLength(2);
  });

  it("handles quoted fields with commas, escaped quotes, and newlines", () => {
    const rows = parseCsv('A,B\n"he said ""hi""",value\n"line1\nline2","foo, bar"');

    expect(rows[0].A).toBe('he said "hi"');
    expect(rows[1]).toEqual({ A: "line1\nline2", B: "foo, bar" });
  });

  it("handles unclosed quotes gracefully", () => {
    expect(parseCsv('A,B\n"unclosed,value')).toEqual([{ A: "unclosed,value", B: "" }]);
  });

  it("trims headers and cell values", () => {
    expect(parseCsv(" A , B \n 1 , 2 ")).toEqual([{ A: "1", B: "2" }]);
  });

  it("skips blank rows before the header", () => {
    expect(parseCsv(",,\nA,B,C\n1,2,3")).toEqual([{ A: "1", B: "2", C: "3" }]);
  });

  it("fills missing trailing cells with empty strings", () => {
    expect(parseCsv("A,B,C\n1")).toEqual([{ A: "1", B: "", C: "" }]);
  });

  it("preserves duplicate headers with stable suffixes", () => {
    expect(parseCsv("Date,Amount,Amount\n2026-03-01,100,200")).toEqual([
      { Date: "2026-03-01", Amount: "100", Amount_2: "200" }
    ]);
  });

  it("returns an empty array for empty input", () => {
    expect(parseCsv("")).toEqual([]);
  });
});
