import { describe, expect, it } from "vitest";
import { escapeHtml, formatDateRange } from "./html";

describe("escapeHtml", () => {
  it("escapes characters that can break rendered HTML", () => {
    expect(escapeHtml(`<a href="x">Tom & Jerry's</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#039;s&lt;/a&gt;"
    );
  });
});

describe("formatDateRange", () => {
  it("formats full, open-start, open-end, and empty date ranges", () => {
    expect(formatDateRange("2026-03-01", "2026-03-31")).toBe("2026-03-01 to 2026-03-31");
    expect(formatDateRange("2026-03-01", "")).toBe("From 2026-03-01");
    expect(formatDateRange("", "2026-03-31")).toBe("Through 2026-03-31");
    expect(formatDateRange("", "")).toBe("All dates");
  });
});
