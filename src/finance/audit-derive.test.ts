import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SAMPLE_DATASETS } from "../import/sample-datasets";
import { importTransactionsFromCsv } from "../import/transactions";
import { deriveAuditedCockpit } from "./audit-derive";
import { summarizeTransactions } from "./summary";
import type { TransactionRecord } from "./types";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

describe("deriveAuditedCockpit", () => {
  it("keeps cockpit values and lineage values equal for every metric", () => {
    const records = [
      record("r1", "2026-03-01", "revenue", "Client A", 2000),
      record("o1", "2026-03-03", "outflow", "Software", 500),
      record("o2", "2026-04-03", "outflow", "Rent", 700)
    ];
    const summary = summarizeTransactions(records, [], 3600);

    const audited = deriveAuditedCockpit({ summary, records, rejectedRows: [] });

    expect(audited.lineage.revenue.value).toBe(audited.revenue);
    expect(audited.lineage.outflow.value).toBe(audited.outflow);
    expect(audited.lineage.netCash.value).toBe(audited.netCash);
    expect(audited.lineage.averageMonthlyOutflow.value).toBe(audited.averageMonthlyOutflow);
    expect(audited.lineage.runwayMonths.value).toBe(audited.runwayMonths);
  });

  it("foots the netCash audit tree: revenue minus outflow", () => {
    const records = [
      record("r1", "2026-03-01", "revenue", "Client A", 2000),
      record("o1", "2026-03-03", "outflow", "Software", 500),
      record("o2", "2026-04-03", "outflow", "Rent", 700)
    ];
    const summary = summarizeTransactions(records, [], 3600);
    const audited = deriveAuditedCockpit({ summary, records, rejectedRows: [] });

    // P3-1: revenue lineage row ids match exactly the imported revenue rows.
    expect(audited.lineage.revenue.direct.map((row) => row.id)).toEqual(["r1"]);

    // P2-1: netCash subtracts (does not sum) so the tree foots for an auditor.
    const netCashNode = audited.lineage.netCash.derived;
    expect(netCashNode?.op).toBe("subtract");
    expect(netCashNode?.children?.map((child) => child.label)).toEqual(["Revenue", "Outflow"]);
    const revenueValue = netCashNode?.children?.[0]?.value ?? NaN;
    const outflowValue = netCashNode?.children?.[1]?.value ?? NaN;
    expect(revenueValue - outflowValue).toBe(netCashNode?.value);
    expect(netCashNode?.value).toBe(audited.netCash);
  });

  it("keeps explicit lineage for empty imports and null runway", () => {
    const summary = summarizeTransactions([], [], 0);

    const audited = deriveAuditedCockpit({ summary, records: [], rejectedRows: [] });

    expect(audited).toMatchObject({
      revenue: 0,
      outflow: 0,
      netCash: 0,
      runwayMonths: null
    });
    expect(audited.lineage.revenue.direct).toEqual([]);
    expect(audited.lineage.runwayMonths.value).toBeNull();
    expect(audited.lineage.runwayMonths.derived).toBeDefined();
  });

  it.each(SAMPLE_DATASETS)("builds stable audit lineage for $label sample", (sample) => {
    const csv = readFileSync(resolve(projectRoot, "public", sample.path.replace(/^\//, "")), "utf8");
    const result = importTransactionsFromCsv(csv);
    const summary = summarizeTransactions(result.records, result.rejectedRows, 50_000);

    const audited = deriveAuditedCockpit({
      summary,
      records: result.records,
      rejectedRows: result.rejectedRows
    });

    expect({
      label: sample.label,
      revenue: audited.revenue,
      outflow: audited.outflow,
      netCash: audited.netCash,
      averageMonthlyOutflow: audited.averageMonthlyOutflow,
      runwayMonths: audited.runwayMonths,
      revenueRowIds: audited.lineage.revenue.direct.map((row) => row.id),
      outflowRowIds: audited.lineage.outflow.direct.map((row) => row.id),
      runwayFormula: audited.lineage.runwayMonths.formulaText,
      runwayAssumptions: audited.lineage.runwayMonths.assumptions,
      runwayTreeLabels: audited.lineage.runwayMonths.derived?.children?.map((child) => child.label)
    }).toMatchSnapshot();
  });
});

function record(
  id: string,
  dateISO: string,
  flow: TransactionRecord["flow"],
  head: string,
  amount: number
): TransactionRecord {
  return {
    id,
    date: new Date(`${dateISO}T00:00:00`),
    dateISO,
    periodDaily: dateISO,
    periodWeekly: dateISO,
    periodMonthly: dateISO.slice(0, 7),
    head,
    parent: "Group",
    subcategory: "Subcategory",
    description: "Memo",
    counterparty: "Counterparty",
    account: "Operating",
    flow,
    amount,
    signedNet: flow === "revenue" ? amount : -amount,
    runningBalance: null
  };
}
