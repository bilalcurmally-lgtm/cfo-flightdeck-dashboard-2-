import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SAMPLE_DATASETS } from "./sample-datasets";
import { importTransactionsFromCsv } from "./transactions";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

describe("public sample datasets", () => {
  it.each(SAMPLE_DATASETS)("imports $label into useful demo records", (sample) => {
      const csv = readFileSync(resolve(projectRoot, "public", sample.path.replace(/^\//, "")), "utf8");
      const result = importTransactionsFromCsv(csv);

      expect(result.records.length).toBeGreaterThanOrEqual(9);
      expect(result.rejectedRows.length).toBeGreaterThanOrEqual(1);
      expect(result.records.some((record) => record.flow === "revenue")).toBe(true);
      expect(result.records.some((record) => record.flow === "outflow")).toBe(true);
      expect(result.records.some((record) => record.account !== "Unassigned Account")).toBe(true);
    });
});
