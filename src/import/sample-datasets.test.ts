import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { importTransactionsFromCsv } from "./transactions";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

describe("public sample datasets", () => {
  it.each(["sample-freelancer.csv", "sample-agency.csv", "sample-founder.csv"])(
    "imports %s into useful demo records",
    (filename) => {
      const csv = readFileSync(resolve(projectRoot, "public", filename), "utf8");
      const result = importTransactionsFromCsv(csv);

      expect(result.records.length).toBeGreaterThanOrEqual(9);
      expect(result.rejectedRows.length).toBeGreaterThanOrEqual(1);
      expect(result.records.some((record) => record.flow === "revenue")).toBe(true);
      expect(result.records.some((record) => record.flow === "outflow")).toBe(true);
      expect(result.records.some((record) => record.account !== "Unassigned Account")).toBe(true);
    }
  );
});
