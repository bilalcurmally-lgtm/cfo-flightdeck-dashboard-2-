import { DOMParser } from "@xmldom/xmldom";
import { beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_FILTERS } from "../finance/filters";
import { buildDashboardView } from "../finance/dashboard-view";
import { rec } from "../finance/classification-overrides.test";
import { assessReadiness, buildReadinessInput } from "../finance/readiness";
import type { CsvImportResult, ImportIssue, TransactionRecord } from "../finance/types";
import { parseExcelWorkbook } from "../import/excel";
import {
  accountantWorkbookFilename,
  buildAccountantWorkbook,
  type AccountantWorkbookInput
} from "./accountant-workbook";

beforeAll(() => {
  Object.defineProperty(globalThis, "DOMParser", {
    configurable: true,
    value: DOMParser
  });
});

describe("buildAccountantWorkbook", () => {
  it("exports all six accountant workbook sheets", async () => {
    const workbook = buildAccountantWorkbook(fixture());
    const sheets = await parseExcelWorkbook(workbook);

    expect(sheets.map((sheet) => sheet.name)).toEqual([
      "Summary",
      "KPI Audit",
      "Normalized Ledger",
      "Exclusions And Review",
      "Rejected Rows",
      "Diagnostics"
    ]);
    expect(sheets[1].rows.length).toBeGreaterThanOrEqual(6);
    expect(JSON.stringify(sheets[1].rows)).toContain("Rejected Rows");
    expect(sheets[2].rows[0]).toMatchObject({
      Date: "2026-05-04",
      "Override Applied": "no",
      Operating: "yes"
    });
  });

  it("keeps numeric amount cells in the normalized ledger", async () => {
    const workbook = buildAccountantWorkbook(fixture());
    const sheets = await parseExcelWorkbook(workbook);
    const ledgerRow = sheets[2].rows.find((row) => row.Date === "2026-05-04");

    expect(ledgerRow).toMatchObject({
      Amount: "100",
      "Signed Net": "100",
      "Override Applied": "no",
      Operating: "yes"
    });
  });

  it("marks classification overrides on the normalized ledger", async () => {
    const overrides = new Map<string, { flow?: "revenue" | "outflow" }>([
      ["txn-1", { flow: "outflow" }]
    ]);
    const input = fixture({ overrides });
    const sheets = await parseExcelWorkbook(buildAccountantWorkbook(input));
    const ledgerRow = sheets[2].rows.find((row) => row.Date === "2026-05-04");

    expect(ledgerRow?.["Override Applied"]).toBe("yes");
    expect(ledgerRow?.Flow).toBe("outflow");
    expect(ledgerRow?.Operating).toBe("yes");
  });

  it("exports rejected rows with dynamic raw columns", async () => {
    const input = fixture({
      result: importResult([record()], [
        {
          rowNumber: 4,
          reason: "Missing amount",
          row: { Date: "2026-05-05", Amount: "", Head: "Client" }
        }
      ])
    });
    const sheets = await parseExcelWorkbook(buildAccountantWorkbook(input));

    expect(sheets[4].rows).toEqual([
      {
        "Row Number": "4",
        Reason: "Missing amount",
        Amount: "",
        Date: "2026-05-05",
        Head: "Client"
      }
    ]);
  });

  it("lists non-operating rows on the exclusions sheet", async () => {
    const records = [
      rec({ id: "draw", flow: "outflow", parent: "Operating Costs", head: "Owner Draw", amount: 1000 }),
      rec({ id: "client", flow: "revenue", parent: "Income", head: "Client", amount: 2500, signedNet: 2500 })
    ];
    const input = fixture({
      result: importResult(records),
      overrides: new Map([["draw", { parent: "Internal" }]])
    });
    const sheets = await parseExcelWorkbook(buildAccountantWorkbook(input));
    const exclusion = sheets[3].rows.find((row) => row.Head === "Owner Draw");

    expect(exclusion?.["Exclusion Reason"]).toBe("non-operating");
  });

  it("lists review exclusions and review-preset rows", async () => {
    const records = [
      record("transfer-in", "revenue", "Transfer", 1000, "Savings"),
      record("transfer-out", "outflow", "Transfer", 1000, "Checking"),
      record("client", "revenue", "Client", 2500),
      record("rent", "outflow", "Rent", 500)
    ];
    const view = buildDashboardView({
      result: importResult(records),
      filters: DEFAULT_FILTERS,
      trendGrain: "monthly",
      reviewPreset: "revenue",
      selectedTransactionId: "",
      cashOnHand: 3000,
      futureEventsText: "",
      deriveExcludedTransactionIds: () => ["transfer-in", "transfer-out"]
    });
    const input = fixture({
      result: importResult(records),
      view,
      reviewPreset: "revenue"
    });
    const sheets = await parseExcelWorkbook(buildAccountantWorkbook(input));

    expect(
      sheets[3].rows.find((row) => row.Head === "Transfer" && row.Flow === "revenue")?.[
        "Exclusion Reason"
      ]
    ).toBe("review exclusion");
    expect(sheets[3].rows.find((row) => row.Head === "Rent")?.["Exclusion Reason"]).toBe(
      "review preset"
    );
  });

  it("flags pending category review rows on the exclusions sheet", async () => {
    const records = [
      rec({ id: "draw", flow: "outflow", parent: "Operating Costs", head: "Owner Draw", amount: 1000 })
    ];
    const input = fixture({
      result: importResult(records)
    });
    const sheets = await parseExcelWorkbook(buildAccountantWorkbook(input));
    const exclusion = sheets[3].rows.find((row) => row.Head === "Owner Draw");

    expect(exclusion?.["Exclusion Reason"]).toBe("needs category review");
    expect(exclusion?.["Category Review Reasons"]).toContain("keyword");
  });

  it("escapes special characters in workbook cells", async () => {
    const records = [
      {
        ...record(),
        description: 'Tool & "Suite" <beta>'
      }
    ];
    const workbook = buildAccountantWorkbook(
      fixture({
        result: importResult(records)
      })
    );

    expect(workbook.size).toBeGreaterThan(0);
  });

  it("includes diagnostics sections when filter impact is present", async () => {
    const records = [
      record("transfer-in", "revenue", "Transfer", 1000, "Savings"),
      record("transfer-out", "outflow", "Transfer", 1000, "Checking"),
      record("client", "revenue", "Client", 2500),
      record("rent", "outflow", "Rent", 500)
    ];
    const view = buildDashboardView({
      result: importResult(records),
      filters: DEFAULT_FILTERS,
      trendGrain: "monthly",
      reviewPreset: "all",
      selectedTransactionId: "",
      cashOnHand: 3000,
      futureEventsText: "",
      deriveExcludedTransactionIds: () => ["transfer-in", "transfer-out"]
    });
    const sheets = await parseExcelWorkbook(
      buildAccountantWorkbook(
        fixture({
          result: importResult(records),
          view
        })
      )
    );
    const diagnostics = JSON.stringify(sheets[5]);

    expect(diagnostics).toContain("Filter Exclusion Impact");
    expect(diagnostics).toContain("Hidden Records");
    expect(diagnostics).toContain("Client");
  });
});

describe("accountantWorkbookFilename", () => {
  it("creates a stable accountant workbook filename", () => {
    expect(
      accountantWorkbookFilename("Sample Finance.csv", new Date("2026-06-15T00:00:00Z"))
    ).toBe("sample-finance-accountant-workbook-2026-06-15.xlsx");
  });
});

function fixture(overrides: Partial<AccountantWorkbookInput> = {}): AccountantWorkbookInput {
  const result = overrides.result ?? importResult([record()]);
  const overrideMap = overrides.overrides ?? new Map();
  const view =
    overrides.view ??
    buildDashboardView({
      result,
      filters: DEFAULT_FILTERS,
      trendGrain: "monthly",
      reviewPreset: overrides.reviewPreset ?? "all",
      selectedTransactionId: "",
      cashOnHand: overrides.cashOnHand ?? 5000,
      futureEventsText: "",
      overrides: overrideMap
    });
  const cashOnHand = overrides.cashOnHand ?? 5000;

  return {
    sourceName: "sample.csv",
    generatedAt: new Date("2026-06-15T12:00:00.000Z"),
    currency: "USD",
    cashOnHand,
    trendGrain: "monthly",
    reviewPreset: "all",
    filters: DEFAULT_FILTERS,
    result,
    view,
    readiness: assessReadiness(
      buildReadinessInput({
        view,
        rejectedRowCount: result.rejectedRows.length,
        cashOnHand
      })
    ),
    overrides: overrideMap,
    excludedReviewItemIds: new Set(),
    formatMoney: (value) => `$${value}`,
    ...overrides
  };
}

function importResult(
  records: TransactionRecord[],
  rejectedRows: ImportIssue[] = []
): CsvImportResult {
  return {
    rawRows: records.map((record) => ({ Date: record.dateISO, Amount: String(record.amount) })),
    records,
    rejectedRows,
    mapping: { date: "Date", amount: "Amount", head: "Head" },
    dateFormat: "ymd"
  };
}

function record(
  id = "txn-1",
  flow: TransactionRecord["flow"] = "revenue",
  head = "Client",
  amount = 100,
  account = "Checking"
): TransactionRecord {
  return {
    id,
    date: new Date("2026-05-04T00:00:00"),
    dateISO: "2026-05-04",
    periodDaily: "2026-05-04",
    periodWeekly: "2026-05-04",
    periodMonthly: "2026-05",
    head,
    parent: flow === "revenue" ? "Income" : "Operating Costs",
    subcategory: "Retainer",
    description: "Design retainer",
    counterparty: "Client Co",
    account,
    flow,
    amount,
    signedNet: flow === "revenue" ? amount : -amount,
    runningBalance: null
  };
}