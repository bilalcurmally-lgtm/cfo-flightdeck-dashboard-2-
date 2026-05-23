import { DOMParser } from "@xmldom/xmldom";
import { beforeAll, describe, expect, it } from "vitest";
import { combineCompatibleExcelSheets, parseExcelWorkbook } from "./excel";
import { importTransactionsFromRows } from "./transactions";
import { analyzeImportReadiness } from "./validation";
import { summarizeTransactions } from "../finance/summary";
import { buildDashboardView } from "../finance/dashboard-view";
import { DEFAULT_FILTERS } from "../finance/filters";
import {
  buildReviewerExportReport,
  buildTransactionsCsvExport,
  buildTrendCsvExport
} from "../export/dashboard-export-payloads";
import {
  buildNorthstarWorkbookBlob,
  NORTHSTAR_MONTHLY_SHEETS,
  NORTHSTAR_NOTES_SHEET,
  NORTHSTAR_TARGETS_SHEET,
  NORTHSTAR_TRANSACTIONS_ROWS,
  makeWorkbookBlob
} from "./excel-test-fixtures";

beforeAll(() => {
  Object.defineProperty(globalThis, "DOMParser", {
    configurable: true,
    value: DOMParser
  });
});

describe("Northstar Trading Co. fictional workbook fixture", () => {
  it("parses every fictional sheet with the expected names and raw row counts", async () => {
    const workbook = buildNorthstarWorkbookBlob();
    const sheets = await parseExcelWorkbook(workbook);

    expect(sheets.map((sheet) => sheet.name)).toEqual([
      "Transactions",
      "Jan 2026",
      "Feb 2026",
      "Mar 2026",
      "Grouped Totals",
      "Bank Export",
      "Notes",
      "Quarterly Targets"
    ]);

    const byName = Object.fromEntries(sheets.map((sheet) => [sheet.name, sheet]));

    // Header + 17 data rows on the master Transactions sheet
    expect(byName.Transactions.rawRowCount).toBe(NORTHSTAR_TRANSACTIONS_ROWS.length);
    expect(byName.Transactions.rows).toHaveLength(NORTHSTAR_TRANSACTIONS_ROWS.length - 1);

    // Monthly sheets keep their row counts after header detection
    for (const sheet of NORTHSTAR_MONTHLY_SHEETS) {
      expect(byName[sheet.name].rows).toHaveLength(sheet.rows.length - 1);
    }

    // Grouped sheet expands to one row per (data row x amount column).
    // 2 data rows x 4 amount columns = 8 expanded rows.
    expect(byName["Grouped Totals"].rows).toHaveLength(8);

    // Bank export header row is row 2 (title above), so 7 data rows
    expect(byName["Bank Export"].rows).toHaveLength(7);

    // Helper sheets parse but don't pretend to be transactional
    expect(byName.Notes.rows).toHaveLength(NORTHSTAR_NOTES_SHEET.rows.length - 1);
    expect(byName["Quarterly Targets"].rows).toHaveLength(
      NORTHSTAR_TARGETS_SHEET.rows.length - 1
    );
  });

  it("combines compatible monthly sheets and skips helper/incompatible sheets with clear reasons", async () => {
    const workbook = makeWorkbookBlob([
      ...NORTHSTAR_MONTHLY_SHEETS,
      NORTHSTAR_NOTES_SHEET,
      NORTHSTAR_TARGETS_SHEET
    ]);

    const sheets = await parseExcelWorkbook(workbook);
    const combined = combineCompatibleExcelSheets(sheets);

    expect(combined.includedSheets).toEqual(["Jan 2026", "Feb 2026", "Mar 2026"]);

    const monthlyTotal = NORTHSTAR_MONTHLY_SHEETS.reduce(
      (total, sheet) => total + sheet.rows.length - 1,
      0
    );
    expect(combined.rows).toHaveLength(monthlyTotal);

    // Worksheet provenance column is added to every combined row
    expect(combined.rows.every((row) => typeof row.Worksheet === "string")).toBe(true);
    const provenance = new Set(combined.rows.map((row) => row.Worksheet));
    expect(provenance).toEqual(new Set(["Jan 2026", "Feb 2026", "Mar 2026"]));

    expect(combined.skippedSheets).toEqual([
      { name: "Notes", reason: "No date and amount/debit/credit columns detected" },
      {
        name: "Quarterly Targets",
        reason: "No date and amount/debit/credit columns detected"
      }
    ]);
  });

  it("imports the clean master Transactions sheet with no rejected rows", async () => {
    const workbook = buildNorthstarWorkbookBlob();
    const sheets = await parseExcelWorkbook(workbook);
    const transactions = sheets.find((sheet) => sheet.name === "Transactions");
    expect(transactions).toBeDefined();

    const result = importTransactionsFromRows(transactions!.rows);

    expect(result.rejectedRows).toEqual([]);
    expect(result.records).toHaveLength(NORTHSTAR_TRANSACTIONS_ROWS.length - 1);

    // Mapping is auto-detected from human-friendly headers
    expect(result.mapping.date).toBe("Date");
    expect(result.mapping.amount).toBe("Amount");
    expect(result.mapping.head).toBe("Head");
    expect(result.mapping.parent).toBe("Parent Group");
    expect(result.mapping.subcategory).toBe("Subcategory");
    expect(result.mapping.account).toBe("Account");
    expect(result.mapping.counterparty).toBe("Vendor / Customer");
    expect(result.mapping.runningBalance).toBe("Running Balance");
    expect(result.mapping.type).toBe("Flow");

    // Revenue / outflow classifications come from the Flow column
    const revenueAmount = result.records
      .filter((record) => record.flow === "revenue")
      .reduce((total, record) => total + record.amount, 0);
    const outflowAmount = result.records
      .filter((record) => record.flow === "outflow")
      .reduce((total, record) => total + record.amount, 0);
    expect(revenueAmount).toBe(1_910_000);
    expect(outflowAmount).toBe(1_834_500);

    // Running balance is parsed through to records when the column is mapped
    const lastHbl = result.records
      .filter((record) => record.account === "HBL Current")
      .slice(-1)[0];
    expect(lastHbl?.runningBalance).toBe(809_000);
  });

  it("imports the messy bank export sheet with correct signed flow", async () => {
    const workbook = buildNorthstarWorkbookBlob();
    const sheets = await parseExcelWorkbook(workbook);
    const bank = sheets.find((sheet) => sheet.name === "Bank Export");
    expect(bank).toBeDefined();

    const result = importTransactionsFromRows(bank!.rows);

    expect(result.mapping.date).toBe("Txn Date");
    expect(result.mapping.debit).toBe("Debit Amount");
    expect(result.mapping.credit).toBe("Credit Amount");
    expect(result.mapping.amount).toBe("");
    expect(result.mapping.runningBalance).toBe("Balance");
    expect(result.mapping.counterparty).toBe("Beneficiary");
    expect(result.mapping.description).toBe("Particulars");

    expect(result.rejectedRows).toEqual([]);
    expect(result.records).toHaveLength(7);

    // Each row's expected (date, flow, amount) after sign normalization.
    // Covers: trailing minus, DR/CR suffixes, Excel serial date, Unicode minus, "PKR 1,200.50-".
    const projected = result.records.map((record) => ({
      dateISO: record.dateISO,
      flow: record.flow,
      amount: record.amount,
      signedNet: record.signedNet,
      counterparty: record.counterparty
    }));
    expect(projected).toEqual([
      {
        dateISO: "2026-01-05",
        flow: "revenue",
        amount: 850_000,
        signedNet: 850_000,
        counterparty: "Northwind Imports"
      },
      {
        dateISO: "2026-01-08",
        flow: "outflow",
        amount: 150_000,
        signedNet: -150_000,
        counterparty: "Snowdrop Realty"
      },
      // Excel serial date 46034 normalizes to 2026-01-12
      {
        dateISO: "2026-01-12",
        flow: "outflow",
        amount: 8_500,
        signedNet: -8_500,
        counterparty: "PTCL"
      },
      {
        dateISO: "2026-01-15",
        flow: "outflow",
        amount: 420_000,
        signedNet: -420_000,
        counterparty: "Internal Staff"
      },
      {
        dateISO: "2026-01-20",
        flow: "revenue",
        amount: 180_000,
        signedNet: 180_000,
        counterparty: "Crescent Logistics"
      },
      {
        dateISO: "2026-01-28",
        flow: "outflow",
        amount: 3_500,
        signedNet: -3_500,
        counterparty: "Atlas Stationers"
      },
      {
        dateISO: "2026-01-30",
        flow: "outflow",
        amount: 1_200.5,
        signedNet: -1_200.5,
        counterparty: "Daraz"
      }
    ]);

    // Running balance flows through from the bank export
    expect(result.records.map((record) => record.runningBalance)).toEqual([
      1_850_000,
      1_700_000,
      1_691_500,
      1_271_500,
      1_451_500,
      1_448_000,
      1_446_799.5
    ]);
  });

  it("expands the grouped parent/child sheet with blank-child fallback", async () => {
    const workbook = buildNorthstarWorkbookBlob();
    const sheets = await parseExcelWorkbook(workbook);
    const grouped = sheets.find((sheet) => sheet.name === "Grouped Totals");
    expect(grouped).toBeDefined();

    const result = importTransactionsFromRows(grouped!.rows);

    expect(result.rejectedRows).toEqual([]);

    const summary = result.records.map(({ dateISO, parent, head, flow, signedNet }) => ({
      dateISO,
      parent,
      head,
      flow,
      signedNet
    }));

    expect(summary).toEqual([
      { dateISO: "2026-01-31", parent: "Revenue", head: "Sales", flow: "revenue", signedNet: 850_000 },
      { dateISO: "2026-01-31", parent: "Revenue", head: "Retainer", flow: "revenue", signedNet: 180_000 },
      // Blank child header falls back to the parent group as the head
      { dateISO: "2026-01-31", parent: "Expense", head: "Expense", flow: "outflow", signedNet: -150_000 },
      { dateISO: "2026-01-31", parent: "Expense", head: "Internet", flow: "outflow", signedNet: -8_500 },
      { dateISO: "2026-02-28", parent: "Revenue", head: "Sales", flow: "revenue", signedNet: 240_000 },
      { dateISO: "2026-02-28", parent: "Revenue", head: "Retainer", flow: "revenue", signedNet: 50_000 },
      { dateISO: "2026-02-28", parent: "Expense", head: "Expense", flow: "outflow", signedNet: -150_000 },
      { dateISO: "2026-02-28", parent: "Expense", head: "Internet", flow: "outflow", signedNet: -9_200 }
    ]);
  });

  it("uses a unique worksheet column when combining monthly sheets that already share headers", async () => {
    const workbook = makeWorkbookBlob(NORTHSTAR_MONTHLY_SHEETS);
    const sheets = await parseExcelWorkbook(workbook);
    const combined = combineCompatibleExcelSheets(sheets);

    expect(combined.includedSheets).toEqual(["Jan 2026", "Feb 2026", "Mar 2026"]);
    expect(combined.skippedSheets).toEqual([]);
    expect(Object.keys(combined.rows[0])).toContain("Worksheet");

    const importResult = importTransactionsFromRows(combined.rows);

    expect(importResult.rejectedRows).toEqual([]);
    expect(importResult.records).toHaveLength(10);
    expect(new Set(importResult.records.map((record) => record.sourceSheet))).toEqual(
      new Set(["Jan 2026", "Feb 2026", "Mar 2026"])
    );
    expect(
      buildReviewerExportReport({
        sourceName: "Northstar monthly tabs",
        result: importResult,
        cashOnHand: 0,
        futureEventsText: "",
        trendGrain: "monthly",
        generatedAt: new Date("2026-04-01T00:00:00Z")
      }).import.sourceSheets
    ).toEqual([
      { name: "Jan 2026", acceptedRows: 4 },
      { name: "Feb 2026", acceptedRows: 3 },
      { name: "Mar 2026", acceptedRows: 3 }
    ]);

    const revenueAmount = importResult.records
      .filter((record) => record.flow === "revenue")
      .reduce((total, record) => total + record.amount, 0);
    const outflowAmount = importResult.records
      .filter((record) => record.flow === "outflow")
      .reduce((total, record) => total + record.amount, 0);
    expect(revenueAmount).toBe(850_000 + 180_000 + 240_000 + 75_000 + 560_000);
    expect(outflowAmount).toBe(150_000 + 8_500 + 150_000 + 150_000 + 430_000);
  });

  it("reports accepted and rejected rows through analyzeImportReadiness", async () => {
    const workbook = buildNorthstarWorkbookBlob();
    const sheets = await parseExcelWorkbook(workbook);
    const transactions = sheets.find((sheet) => sheet.name === "Transactions");
    const result = importTransactionsFromRows(transactions!.rows);

    const readiness = analyzeImportReadiness(
      transactions!.rows,
      result.mapping,
      result.dateFormat
    );

    expect(readiness.rawRows).toBe(NORTHSTAR_TRANSACTIONS_ROWS.length - 1);
    expect(readiness.acceptedRows).toBe(NORTHSTAR_TRANSACTIONS_ROWS.length - 1);
    expect(readiness.rejectedRows).toBe(0);
    expect(readiness.invalidDateRows).toBe(0);
    expect(readiness.invalidAmountRows).toBe(0);
    expect(readiness.missingRequiredColumns).toEqual([]);

    // Optional coverage tracks which optional columns are populated and on how many rows
    const coverageByKey = Object.fromEntries(
      readiness.optionalCoverage.map((entry) => [entry.key, entry])
    );
    expect(coverageByKey.account).toMatchObject({ column: "Account" });
    expect(coverageByKey.account.filledRows).toBe(NORTHSTAR_TRANSACTIONS_ROWS.length - 1);
    // Subcategory and description have one intentionally blank row in the fixture
    expect(coverageByKey.subcategory.filledRows).toBe(
      NORTHSTAR_TRANSACTIONS_ROWS.length - 2
    );
    expect(coverageByKey.description.filledRows).toBe(
      NORTHSTAR_TRANSACTIONS_ROWS.length - 2
    );
  });

  it("builds export payloads against the imported Transactions fixture", async () => {
    const workbook = buildNorthstarWorkbookBlob();
    const sheets = await parseExcelWorkbook(workbook);
    const transactions = sheets.find((sheet) => sheet.name === "Transactions");
    const result = importTransactionsFromRows(transactions!.rows);

    const generatedAt = new Date("2026-04-01T00:00:00Z");

    const transactionsCsv = buildTransactionsCsvExport("Northstar", result.records, generatedAt);
    const lines = transactionsCsv.contents.split("\n");
    expect(lines).toHaveLength(result.records.length + 1);
    expect(lines[0]).toBe(
      "date,sourceSheet,flow,account,head,parent,subcategory,description,counterparty,amount,signedNet,runningBalance"
    );
    expect(transactionsCsv.filename).toContain("northstar");
    expect(transactionsCsv.filename.endsWith(".csv")).toBe(true);

    const trendCsv = buildTrendCsvExport(
      "Northstar",
      summarizeTransactions(result.records, result.rejectedRows, 0, "monthly"),
      "monthly",
      generatedAt
    );
    const trendLines = trendCsv.contents.split("\n");
    expect(trendLines[0]).toBe("period,revenue,outflow,netCash");
    expect(trendLines).toHaveLength(4); // header + 3 months

    const reviewerReport = buildReviewerExportReport({
      sourceName: "Northstar",
      result,
      cashOnHand: 0,
      futureEventsText: "",
      trendGrain: "monthly",
      generatedAt
    });
    expect(reviewerReport.sourceName).toBe("Northstar");
    expect(reviewerReport.import.acceptedRows).toBe(result.records.length);
    expect(reviewerReport.import.rejectedRows).toBe(0);
    expect(reviewerReport.import.sourceSheets).toEqual([]);
    expect(reviewerReport.summary.revenue).toBe(1_910_000);
    expect(reviewerReport.summary.outflow).toBe(1_834_500);
    expect(reviewerReport.summary.netCash).toBe(75_500);
    expect(reviewerReport.monthlyTrend.map((period) => period.period)).toEqual([
      "2026-01",
      "2026-02",
      "2026-03"
    ]);
  });

  it("builds a dashboard view from the Transactions fixture", async () => {
    const workbook = buildNorthstarWorkbookBlob();
    const sheets = await parseExcelWorkbook(workbook);
    const transactions = sheets.find((sheet) => sheet.name === "Transactions");
    const result = importTransactionsFromRows(transactions!.rows);

    const view = buildDashboardView({
      result,
      filters: DEFAULT_FILTERS,
      trendGrain: "monthly",
      reviewPreset: "all",
      selectedTransactionId: "",
      cashOnHand: 50_000,
      futureEventsText: ""
    });

    expect(view.filteredRecords).toHaveLength(result.records.length);
    expect(view.summary.revenue).toBe(1_910_000);
    expect(view.summary.outflow).toBe(1_834_500);
    expect(view.summary.netCash).toBe(75_500);
    expect(view.summary.transactionCount).toBe(result.records.length);

    // Monthly trend covers Jan-Mar 2026
    expect(view.summary.periodTrend.map((period) => period.period)).toEqual([
      "2026-01",
      "2026-02",
      "2026-03"
    ]);
    const jan = view.summary.periodTrend.find((period) => period.period === "2026-01");
    expect(jan).toEqual({
      period: "2026-01",
      revenue: 1_035_000,
      outflow: 614_000,
      netCash: 421_000
    });

    // Top heads include the dominant categories from the fixture
    const headNames = view.summary.topHeads.map((entry) => entry.head);
    expect(headNames).toContain("Sales");
    expect(headNames).toContain("Salaries");
    expect(headNames).toContain("Rent");

    // Subcategory rollups
    const subcategoryNames = view.summary.topSubcategories.map((entry) => entry.subcategory);
    expect(subcategoryNames).toContain("Wholesale");
    expect(subcategoryNames).toContain("Staff payroll");

    // Account balances appear for each known account
    const accountNames = view.summary.accountBalances.map((entry) => entry.account);
    expect(accountNames).toEqual(
      expect.arrayContaining(["HBL Current", "Meezan Savings", "Petty Cash"])
    );

    expect(view.selectedRecord).not.toBeNull();
    expect(view.forecast.weeks.length).toBeGreaterThan(0);
  });
});
