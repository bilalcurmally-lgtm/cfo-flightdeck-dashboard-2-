import { describe, expect, it } from "vitest";
import { detectImportMapping, importTransactionsFromCsv } from "./transactions";

describe("detectImportMapping", () => {
  it("detects the minimum required finance columns", () => {
    const mapping = detectImportMapping([
      {
        "Transaction Date": "2024-03-15",
        Amount: "100",
        Category: "Sales",
        Memo: "Invoice"
      }
    ]);

    expect(mapping.date).toBe("Transaction Date");
    expect(mapping.amount).toBe("Amount");
    expect(mapping.head).toBe("Category");
    expect(mapping.description).toBe("Memo");
  });

  it("detects optional account and running balance columns separately from category", () => {
    const mapping = detectImportMapping([
      {
        Date: "2024-03-15",
        Amount: "100",
        Account: "Checking",
        Balance: "1200",
        Category: "Sales"
      }
    ]);

    expect(mapping.account).toBe("Account");
    expect(mapping.runningBalance).toBe("Balance");
    expect(mapping.head).toBe("Category");
  });

  it("detects split debit and credit amount columns", () => {
    const mapping = detectImportMapping([
      {
        Date: "2026-05-01",
        Debit: "1200",
        Credit: "",
        Description: "Rent"
      }
    ]);

    expect(mapping.amount).toBe("");
    expect(mapping.debit).toBe("Debit");
    expect(mapping.credit).toBe("Credit");
  });

  it("detects common bank export aliases for date, description, and counterparty", () => {
    const mapping = detectImportMapping([
      {
        "Txn Date": "2026-05-01",
        Debit: "1200",
        Particulars: "Rent payment",
        Beneficiary: "Office Landlord"
      }
    ]);

    expect(mapping.date).toBe("Txn Date");
    expect(mapping.description).toBe("Particulars");
    expect(mapping.counterparty).toBe("Beneficiary");
  });
});

describe("importTransactionsFromCsv", () => {
  it("turns a sample CSV into tested transaction records", () => {
    const result = importTransactionsFromCsv(`Date,Amount,Type,Category,Group,Description
2024-03-01,2500,revenue,Client Work,Income,March retainer
2024-03-02,-400,outflow,Software,Operating Costs,Tools
2024-03-03,not-money,outflow,Travel,Operating Costs,Taxi`);

    expect(result.records).toHaveLength(2);
    expect(result.rejectedRows).toEqual([
      {
        rowNumber: 4,
        reason: "Invalid amount",
        row: {
          Date: "2024-03-03",
          Amount: "not-money",
          Type: "outflow",
          Category: "Travel",
          Group: "Operating Costs",
          Description: "Taxi"
        }
      }
    ]);
    expect(result.records[0]).toMatchObject({
      dateISO: "2024-03-01",
      amount: 2500,
      flow: "revenue",
      signedNet: 2500,
      head: "Client Work",
      account: "Unassigned Account",
      runningBalance: null
    });
    expect(result.records[1]).toMatchObject({
      amount: 400,
      flow: "outflow",
      signedNet: -400
    });
  });

  it("reports missing required columns without throwing", () => {
    const result = importTransactionsFromCsv("Memo,Category\nInvoice,Sales");

    expect(result.records).toEqual([]);
    expect(result.rejectedRows).toEqual([
      {
        rowNumber: 2,
        reason: "No date column detected",
        row: { Memo: "Invoice", Category: "Sales" }
      }
    ]);
  });

  it("uses reviewed mapping overrides when source columns are unusual", () => {
    const result = importTransactionsFromCsv("When,Delta,Kind,Note\n2024-03-15,750,income,Invoice", {
      mapping: {
        date: "When",
        amount: "Delta",
        type: "Kind",
        description: "Note"
      }
    });

    expect(result.records).toHaveLength(1);
    expect(result.mapping).toMatchObject({
      date: "When",
      amount: "Delta",
      type: "Kind",
      description: "Note"
    });
    expect(result.records[0]).toMatchObject({
      dateISO: "2024-03-15",
      amount: 750,
      flow: "revenue",
      description: "Invoice"
    });
  });

  it("imports split debit and credit columns as outflow and revenue records", () => {
    const result = importTransactionsFromCsv(`Date,Debit,Credit,Description
2026-05-01,1200,,Rent
2026-05-02,,3000,Client payment`, {
      mapping: {
        date: "Date",
        amount: "",
        debit: "Debit",
        credit: "Credit",
        description: "Description"
      }
    });

    expect(result.records).toHaveLength(2);
    expect(result.records[0]).toMatchObject({
      flow: "outflow",
      amount: 1200,
      signedNet: -1200,
      description: "Rent"
    });
    expect(result.records[1]).toMatchObject({
      flow: "revenue",
      amount: 3000,
      signedNet: 3000,
      description: "Client payment"
    });
  });
});
