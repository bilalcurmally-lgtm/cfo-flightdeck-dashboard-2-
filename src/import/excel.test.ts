import { DOMParser } from "@xmldom/xmldom";
import { beforeAll, describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import {
  combineCompatibleExcelSheets,
  excelRowsToImportedRows,
  parseExcelWorkbook,
  type ParsedExcelSheet
} from "./excel";
import { importTransactionsFromRows } from "./transactions";

beforeAll(() => {
  Object.defineProperty(globalThis, "DOMParser", {
    configurable: true,
    value: DOMParser
  });
});

describe("excelRowsToImportedRows", () => {
  it("turns worksheet rows into imported rows", () => {
    const rows = excelRowsToImportedRows([
      ["", ""],
      ["Date", "Amount", "Description"],
      [new Date("2026-03-01T00:00:00Z"), 1200, "Invoice"],
      ["2026-03-02", -40, "Tools"]
    ]);

    expect(rows).toEqual([
      { Date: "2026-03-01", Amount: "1200", Description: "Invoice" },
      { Date: "2026-03-02", Amount: "-40", Description: "Tools" }
    ]);
  });

  it("uses fallback headers and skips blank body rows", () => {
    expect(
      excelRowsToImportedRows([
        ["Date", ""],
        ["2026-03-01", 100],
        ["", ""]
      ])
    ).toEqual([{ Date: "2026-03-01", column_2: "100" }]);
  });

  it("skips title rows and starts at the first finance-like header row", () => {
    expect(
      excelRowsToImportedRows([
        ["Monthly bank statement", "", ""],
        ["Generated for review", "", ""],
        ["Date", "Debit", "Credit", "Description"],
        ["2026-05-01", "1200", "", "Rent"],
        ["2026-05-02", "", "3000", "Client payment"]
      ])
    ).toEqual([
      { Date: "2026-05-01", Debit: "1200", Credit: "", Description: "Rent" },
      { Date: "2026-05-02", Debit: "", Credit: "3000", Description: "Client payment" }
    ]);
  });

  it("normalizes numeric Excel serial dates only in date-like columns", () => {
    expect(
      excelRowsToImportedRows([
        ["Txn Date", "Debit Amount", "Reference"],
        [45292, 1200, 45292]
      ])
    ).toEqual([
      {
        "Txn Date": "2024-01-01",
        "Debit Amount": "1200",
        Reference: "45292"
      }
    ]);
  });

  it("preserves duplicate worksheet columns instead of overwriting values", () => {
    expect(
      excelRowsToImportedRows([
        ["Date", "Amount", "Amount"],
        ["2026-03-01", 100, 200]
      ])
    ).toEqual([{ Date: "2026-03-01", Amount: "100", Amount_2: "200" }]);
  });

  it("expands grouped parent and child amount columns into transaction rows", () => {
    const rows = excelRowsToImportedRows([
      ["", "", "Revenue", "", "Expense", ""],
      ["Date", "Description", "Sales", "Retainers", "Rent", "Internet"],
      ["2026-05-01", "May operating totals", 250000, 100000, 50000, 12000]
    ]);

    expect(rows).toEqual([
      {
        Date: "2026-05-01",
        Description: "May operating totals",
        Flow: "Revenue",
        "Parent Group": "Revenue",
        Head: "Sales",
        Amount: "250000"
      },
      {
        Date: "2026-05-01",
        Description: "May operating totals",
        Flow: "Revenue",
        "Parent Group": "Revenue",
        Head: "Retainers",
        Amount: "100000"
      },
      {
        Date: "2026-05-01",
        Description: "May operating totals",
        Flow: "Expense",
        "Parent Group": "Expense",
        Head: "Rent",
        Amount: "50000"
      },
      {
        Date: "2026-05-01",
        Description: "May operating totals",
        Flow: "Expense",
        "Parent Group": "Expense",
        Head: "Internet",
        Amount: "12000"
      }
    ]);

    expect(
      importTransactionsFromRows(rows).records.map(({ head, parent, flow, amount, signedNet }) => ({
        head,
        parent,
        flow,
        amount,
        signedNet
      }))
    ).toEqual([
      { head: "Sales", parent: "Revenue", flow: "revenue", amount: 250000, signedNet: 250000 },
      { head: "Retainers", parent: "Revenue", flow: "revenue", amount: 100000, signedNet: 100000 },
      { head: "Rent", parent: "Expense", flow: "outflow", amount: 50000, signedNet: -50000 },
      { head: "Internet", parent: "Expense", flow: "outflow", amount: 12000, signedNet: -12000 }
    ]);
  });

  it("keeps normal value amount columns flat when a title row appears above the header", () => {
    expect(
      excelRowsToImportedRows([
        ["Monthly bank statement", "", ""],
        ["Date", "Description", "Value"],
        ["2026-05-01", "Client payment", 250000]
      ])
    ).toEqual([{ Date: "2026-05-01", Description: "Client payment", Value: "250000" }]);
  });

  it("keeps parsed sheet metadata available for workbook selection", () => {
    const sheets: ParsedExcelSheet[] = [
      {
        name: "Operating",
        rows: excelRowsToImportedRows([
          ["Date", "Amount"],
          ["2026-03-01", 100]
        ]),
        rawRowCount: 2
      }
    ];

    expect(sheets[0]).toEqual({
      name: "Operating",
      rows: [{ Date: "2026-03-01", Amount: "100" }],
      rawRowCount: 2
    });
  });
});

describe("combineCompatibleExcelSheets", () => {
  it("combines rows from sheets with matching headers and adds worksheet provenance", () => {
    const combined = combineCompatibleExcelSheets([
      sheet("Jan 2026", [
        { Date: "2026-01-01", Amount: "100" },
        { Date: "2026-01-02", Amount: "-25" }
      ]),
      sheet("Feb 2026", [{ Date: "2026-02-01", Amount: "250" }])
    ]);

    expect(combined.rows).toEqual([
      { Date: "2026-01-01", Amount: "100", Worksheet: "Jan 2026" },
      { Date: "2026-01-02", Amount: "-25", Worksheet: "Jan 2026" },
      { Date: "2026-02-01", Amount: "250", Worksheet: "Feb 2026" }
    ]);
    expect(combined.includedSheets).toEqual(["Jan 2026", "Feb 2026"]);
    expect(combined.skippedSheets).toEqual([]);
  });

  it("skips empty and incompatible sheets instead of mixing mismatched workbook layouts", () => {
    const combined = combineCompatibleExcelSheets([
      sheet("Jan 2026", [{ Date: "2026-01-01", Amount: "100" }]),
      sheet("Notes", []),
      sheet("Summary", [{ Category: "Revenue", Total: "100" }])
    ]);

    expect(combined.rows).toEqual([
      { Date: "2026-01-01", Amount: "100", Worksheet: "Jan 2026" }
    ]);
    expect(combined.includedSheets).toEqual(["Jan 2026"]);
    expect(combined.skippedSheets).toEqual([
      { name: "Notes", reason: "No imported rows" },
      { name: "Summary", reason: "No date and amount/debit/credit columns detected" }
    ]);
  });

  it("uses the first transaction-like sheet as the combine base when notes appear first", () => {
    const combined = combineCompatibleExcelSheets([
      sheet("Notes", [{ Topic: "Owner", Detail: "Reviewed by finance" }]),
      sheet("Jan 2026", [{ Date: "2026-01-01", Debit: "100", Credit: "" }]),
      sheet("Feb 2026", [{ Date: "2026-02-01", Debit: "", Credit: "250" }])
    ]);

    expect(combined.rows).toEqual([
      { Date: "2026-01-01", Debit: "100", Credit: "", Worksheet: "Jan 2026" },
      { Date: "2026-02-01", Debit: "", Credit: "250", Worksheet: "Feb 2026" }
    ]);
    expect(combined.includedSheets).toEqual(["Jan 2026", "Feb 2026"]);
    expect(combined.skippedSheets).toEqual([
      { name: "Notes", reason: "No date and amount/debit/credit columns detected" }
    ]);
  });

  it("combines compatible sheets even when the same headers appear in a different order", () => {
    const combined = combineCompatibleExcelSheets([
      sheet("Jan 2026", [{ Date: "2026-01-01", Amount: "100", Description: "Invoice" }]),
      sheet("Feb 2026", [{ Description: "Tools", Amount: "-25", Date: "2026-02-01" }])
    ]);

    expect(combined.rows).toEqual([
      { Date: "2026-01-01", Amount: "100", Description: "Invoice", Worksheet: "Jan 2026" },
      { Description: "Tools", Amount: "-25", Date: "2026-02-01", Worksheet: "Feb 2026" }
    ]);
    expect(combined.includedSheets).toEqual(["Jan 2026", "Feb 2026"]);
    expect(combined.skippedSheets).toEqual([]);
  });

  it("uses a unique worksheet source column when the workbook already has Worksheet", () => {
    const combined = combineCompatibleExcelSheets([
      sheet("Jan 2026", [{ Date: "2026-01-01", Amount: "100", Worksheet: "Office" }])
    ]);

    expect(combined.rows).toEqual([
      {
        Date: "2026-01-01",
        Amount: "100",
        Worksheet: "Office",
        Worksheet_2: "Jan 2026"
      }
    ]);
  });
});

describe("parseExcelWorkbook", () => {
  it("parses and combines a real xlsx workbook with helper and monthly sheets", async () => {
    const workbook = makeWorkbookBlob([
      {
        name: "Notes",
        rows: [
          ["Topic", "Detail"],
          ["Owner", "Reviewed by finance"]
        ]
      },
      {
        name: "Jan 2026",
        rows: [
          ["Monthly bank statement", "", "", ""],
          ["Date", "Debit", "Credit", "Particulars"],
          ["2026-01-01", "PKR 1,200 DR", "", "Rent"]
        ]
      },
      {
        name: "Feb 2026",
        rows: [
          ["Date", "Debit", "Credit", "Particulars"],
          ["2026-02-01", "", "3,000 CR", "Client payment"]
        ]
      }
    ]);

    const sheets = await parseExcelWorkbook(workbook);
    const combined = combineCompatibleExcelSheets(sheets);

    expect(sheets.map((sheet) => sheet.name)).toEqual(["Notes", "Jan 2026", "Feb 2026"]);
    expect(sheets[1].rows).toEqual([
      { Date: "2026-01-01", Debit: "PKR 1,200 DR", Credit: "", Particulars: "Rent" }
    ]);
    expect(combined.rows).toEqual([
      {
        Date: "2026-01-01",
        Debit: "PKR 1,200 DR",
        Credit: "",
        Particulars: "Rent",
        Worksheet: "Jan 2026"
      },
      {
        Date: "2026-02-01",
        Debit: "",
        Credit: "3,000 CR",
        Particulars: "Client payment",
        Worksheet: "Feb 2026"
      }
    ]);
    expect(combined.skippedSheets).toEqual([
      { name: "Notes", reason: "No date and amount/debit/credit columns detected" }
    ]);

    const importResult = importTransactionsFromRows(combined.rows, {
      mapping: {
        date: "Date",
        amount: "",
        debit: "Debit",
        credit: "Credit",
        description: "Particulars"
      }
    });

    expect(importResult.rejectedRows).toEqual([]);
    expect(importResult.records.map(({ amount, description, flow, signedNet }) => ({
      amount,
      description,
      flow,
      signedNet
    }))).toEqual([
      { amount: 1200, description: "Rent", flow: "outflow", signedNet: -1200 },
      { amount: 3000, description: "Client payment", flow: "revenue", signedNet: 3000 }
    ]);
  });
});

function sheet(name: string, rows: ParsedExcelSheet["rows"]): ParsedExcelSheet {
  return {
    name,
    rows,
    rawRowCount: rows.length + 1
  };
}

function makeWorkbookBlob(sheets: Array<{ name: string; rows: unknown[][] }>): Blob {
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": xmlFile(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
${sheets
  .map(
    (_sheet, index) =>
      `  <Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
  )
  .join("\n")}
</Types>`),
    "_rels/.rels": xmlFile(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`),
    "xl/workbook.xml": xmlFile(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
${sheets
  .map(
    (sheet, index) =>
      `    <sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`
  )
  .join("\n")}
  </sheets>
</workbook>`),
    "xl/_rels/workbook.xml.rels": xmlFile(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${sheets
  .map(
    (_sheet, index) =>
      `  <Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`
  )
  .join("\n")}
</Relationships>`)
  };

  sheets.forEach((sheet, index) => {
    files[`xl/worksheets/sheet${index + 1}.xml`] = xmlFile(renderSheetXml(sheet.rows));
  });

  return new Blob([toArrayBuffer(zipSync(files))], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
}

function renderSheetXml(rows: unknown[][]): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
${rows
  .map(
    (row, rowIndex) => `    <row r="${rowIndex + 1}">
${row.map((value, columnIndex) => renderCell(rowIndex + 1, columnIndex, value)).join("\n")}
    </row>`
  )
  .join("\n")}
  </sheetData>
</worksheet>`;
}

function renderCell(rowIndex: number, columnIndex: number, value: unknown): string {
  const ref = `${columnName(columnIndex)}${rowIndex}`;
  return `      <c r="${ref}" t="inlineStr"><is><t>${escapeXml(String(value ?? ""))}</t></is></c>`;
}

function columnName(index: number): string {
  let name = "";
  let current = index + 1;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    current = Math.floor((current - 1) / 26);
  }
  return name;
}

function xmlFile(value: string): Uint8Array {
  return strToU8(value);
}

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (char) => {
    const entities: Record<string, string> = {
      "<": "&lt;",
      ">": "&gt;",
      "&": "&amp;",
      '"': "&quot;",
      "'": "&apos;"
    };
    return entities[char];
  });
}

function toArrayBuffer(value: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(value.byteLength);
  new Uint8Array(buffer).set(value);
  return buffer;
}
