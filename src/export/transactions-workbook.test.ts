import { DOMParser } from "@xmldom/xmldom";
import { beforeAll, describe, expect, it } from "vitest";
import type { TransactionRecord } from "../finance/types";
import { parseExcelWorkbook } from "../import/excel";
import {
  buildTransactionsWorkbook,
  transactionsWorkbookFilename
} from "./transactions-workbook";

beforeAll(() => {
  Object.defineProperty(globalThis, "DOMParser", {
    configurable: true,
    value: DOMParser
  });
});

describe("buildTransactionsWorkbook", () => {
  it("exports normalized transaction records as an xlsx workbook", async () => {
    const workbook = buildTransactionsWorkbook([record()]);
    const sheets = await parseExcelWorkbook(workbook);

    expect(workbook.type).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(sheets.map((sheet) => sheet.name)).toEqual(["Transactions"]);
    expect(sheets[0].rows).toEqual([
      {
        Date: "2026-03-01",
        "Source Sheet": "Mar 2026",
        Flow: "outflow",
        Account: "Checking",
        Head: "Software",
        Parent: "Operating Costs",
        Subcategory: "Design",
        Description: "Tool subscription",
        Counterparty: "Adobe",
        Amount: "220",
        "Signed Net": "-220",
        "Running Balance": "1800"
      }
    ]);
  });
});

describe("transactionsWorkbookFilename", () => {
  it("creates a stable xlsx filename", () => {
    expect(
      transactionsWorkbookFilename(
        "Sample Finance.csv",
        new Date("2026-04-26T00:00:00Z")
      )
    ).toBe("sample-finance-normalized-transactions-2026-04-26.xlsx");
  });
});

function record(): TransactionRecord {
  return {
    id: "2026-03-01-0",
    date: new Date("2026-03-01T00:00:00"),
    dateISO: "2026-03-01",
    periodDaily: "2026-03-01",
    periodWeekly: "2026-02-23",
    periodMonthly: "2026-03",
    sourceSheet: "Mar 2026",
    head: "Software",
    parent: "Operating Costs",
    subcategory: "Design",
    description: "Tool subscription",
    counterparty: "Adobe",
    account: "Checking",
    flow: "outflow",
    amount: 220,
    signedNet: -220,
    runningBalance: 1800
  };
}
