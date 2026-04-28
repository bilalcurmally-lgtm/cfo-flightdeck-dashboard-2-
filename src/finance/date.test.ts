import { describe, expect, it } from "vitest";
import { detectDateFormat, grainKey, parseDate, startOfWeek, toIsoDate } from "./date";
import type { TransactionRecord } from "./types";

describe("parseDate", () => {
  it("parses ISO, DMY, MDY, YMD, dash-separated, and ISO datetime values", () => {
    expect(toIsoDate(parseDate("2024-03-15")!)).toBe("2024-03-15");
    expect(toIsoDate(parseDate("15/3/2024")!)).toBe("2024-03-15");
    expect(toIsoDate(parseDate("3/15/2024", "mdy")!)).toBe("2024-03-15");
    expect(toIsoDate(parseDate("2024/3/15", "ymd")!)).toBe("2024-03-15");
    expect(toIsoDate(parseDate("15-3-2024")!)).toBe("2024-03-15");
    expect(parseDate("2024-03-15T10:30:00")?.getHours()).toBe(0);
  });

  it("parses two-digit years as 20XX", () => {
    expect(parseDate("15/3/24")?.getFullYear()).toBe(2024);
  });

  it("returns null for empty or unparseable values", () => {
    expect(parseDate(null)).toBeNull();
    expect(parseDate("")).toBeNull();
    expect(parseDate("not-a-date")).toBeNull();
  });
});

describe("period helpers", () => {
  it("formats ISO dates and calculates Monday week starts", () => {
    expect(toIsoDate(new Date(2024, 0, 5))).toBe("2024-01-05");
    expect(toIsoDate(startOfWeek(new Date(2024, 2, 13)))).toBe("2024-03-11");
    expect(toIsoDate(startOfWeek(new Date(2024, 2, 17)))).toBe("2024-03-11");
  });

  it("selects the correct period key by grain", () => {
    const record = {
      periodDaily: "2024-03-15",
      periodWeekly: "2024-03-11",
      periodMonthly: "2024-03"
    } as TransactionRecord;

    expect(grainKey(record, "daily")).toBe("2024-03-15");
    expect(grainKey(record, "weekly")).toBe("2024-03-11");
    expect(grainKey(record, "monthly")).toBe("2024-03");
  });
});

describe("detectDateFormat", () => {
  it("detects DMY, MDY, and default cases", () => {
    expect(detectDateFormat([{ Date: "15/3/2024" }, { Date: "20/5/2024" }], "Date")).toBe(
      "dmy"
    );
    expect(detectDateFormat([{ Date: "3/15/2024" }, { Date: "5/20/2024" }], "Date")).toBe(
      "mdy"
    );
    expect(detectDateFormat([{ Date: "5/3/2024" }, { Date: "2/8/2024" }], "Date")).toBe(
      "dmy"
    );
    expect(detectDateFormat([{ Date: "2024-03-15" }, { Date: "2024/03/16" }], "Date")).toBe(
      "ymd"
    );
    expect(detectDateFormat([], "")).toBe("ymd");
  });
});
