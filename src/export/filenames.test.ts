import { describe, expect, it } from "vitest";
import { exportDateStamp, safeExportStem } from "./filenames";

describe("safeExportStem", () => {
  it("removes extensions and normalizes unsafe filename characters", () => {
    expect(safeExportStem("Founder Sample.xlsx")).toBe("founder-sample");
    expect(safeExportStem("  CFO / Export !!! ")).toBe("cfo-export");
  });

  it("falls back to a stable generic stem when the source has no safe characters", () => {
    expect(safeExportStem("...")).toBe("finance");
  });
});

describe("exportDateStamp", () => {
  it("uses the UTC calendar date from the generated timestamp", () => {
    expect(exportDateStamp(new Date("2026-04-29T20:30:00Z"))).toBe("2026-04-29");
  });
});
