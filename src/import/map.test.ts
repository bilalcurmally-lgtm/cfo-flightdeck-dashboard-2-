import { describe, expect, it } from "vitest";
import { matchColumn, mapRowToRecord } from "./map";
import type { ImportMapping } from "../finance/types";

describe("matchColumn", () => {
  const columns = ["Date", "Amount", "Flow Type", "Account Head"];
  const lower = columns.map((column) => column.toLowerCase());

  it("finds exact and partial candidate matches", () => {
    expect(matchColumn(columns, lower, ["date"])).toBe("Date");
    expect(matchColumn(columns, lower, ["posting date", "transaction date", "date"])).toBe("Date");
    expect(matchColumn(columns, lower, ["flow", "direction"])).toBe("Flow Type");
  });

  it("returns an empty string when no candidate matches", () => {
    expect(matchColumn(columns, lower, ["nonexistent"])).toBe("");
    expect(matchColumn([], [], ["date"])).toBe("");
  });
});

describe("mapRowToRecord", () => {
  const mapping: ImportMapping = {
    date: "Date",
    amount: "Amount",
    type: "Type",
    head: "Head",
    parent: "Parent",
    description: "Desc"
  };
  const revenueTokens = ["revenue", "inflow"];
  const outflowTokens = ["outflow", "expense"];

  it("maps a valid imported row to a transaction record", () => {
    const record = mapRowToRecord(
      {
        Date: "15/3/2024",
        Amount: "100",
        Type: "revenue",
        Head: "Sales",
        Parent: "Income",
        Desc: "A sale",
        Subcategory: "Retainer",
        Vendor: "Client A"
      },
      0,
      { ...mapping, subcategory: "Subcategory", counterparty: "Vendor" },
      revenueTokens,
      outflowTokens,
      "dmy"
    );

    expect(record).toMatchObject({
      dateISO: "2024-03-15",
      flow: "revenue",
      amount: 100,
      signedNet: 100,
      head: "Sales",
      parent: "Income",
      subcategory: "Retainer",
      description: "A sale",
      counterparty: "Client A",
      account: "Unassigned Account",
      periodDaily: "2024-03-15",
      periodWeekly: "2024-03-11",
      periodMonthly: "2024-03",
      runningBalance: null
    });
  });

  it("returns null for invalid dates or amounts", () => {
    expect(
      mapRowToRecord({ Date: "not-a-date", Amount: "100" }, 0, mapping, [], [], "dmy")
    ).toBeNull();
    expect(mapRowToRecord({ Date: "15/3/2024", Amount: "abc" }, 0, mapping, [], [], "dmy")).toBeNull();
  });

  it("classifies negative amounts as outflow when no type is present", () => {
    const record = mapRowToRecord(
      { Date: "15/3/2024", Amount: "-50", Type: "", Head: "Expense" },
      0,
      mapping,
      revenueTokens,
      outflowTokens,
      "dmy"
    );

    expect(record?.flow).toBe("outflow");
    expect(record?.amount).toBe(50);
    expect(record?.signedNet).toBe(-50);
  });

  it("applies readable fallbacks for optional fields", () => {
    const record = mapRowToRecord(
      { Date: "15/3/2024", Amount: "100", Type: "" },
      0,
      mapping,
      revenueTokens,
      outflowTokens,
      "dmy"
    );

    expect(record?.head).toBe("Unassigned Head");
    expect(record?.parent).toBe("Unassigned Group");
    expect(record?.description).toBe("Unassigned");
    expect(record?.account).toBe("Unassigned Account");
    expect(record?.subcategory).toBe("Unassigned Subcategory");
    expect(record?.counterparty).toBe("Unassigned Counterparty");
  });

  it("maps optional account and running balance fields", () => {
    const record = mapRowToRecord(
      {
        Date: "2024-03-15",
        Amount: "100",
        Account: "Checking",
        Balance: "1200",
        Head: "Sales"
      },
      0,
      { date: "Date", amount: "Amount", account: "Account", runningBalance: "Balance", head: "Head" },
      revenueTokens,
      outflowTokens,
      "ymd"
    );

    expect(record?.account).toBe("Checking");
    expect(record?.runningBalance).toBe(1200);
  });
});
