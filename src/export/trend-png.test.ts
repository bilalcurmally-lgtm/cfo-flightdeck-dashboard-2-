import { describe, expect, it } from "vitest";
import { trendPngFilename } from "./trend-png";

describe("trendPngFilename", () => {
  it("creates a safe visible trend PNG filename", () => {
    expect(trendPngFilename("Agency Sample.xlsx", new Date("2026-04-28T00:00:00Z"), "daily")).toBe(
      "agency-sample-visible-daily-trend-2026-04-28.png"
    );
  });
});
