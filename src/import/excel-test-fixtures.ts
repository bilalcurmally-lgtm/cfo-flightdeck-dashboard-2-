import { strToU8, zipSync } from "fflate";

/**
 * Cell value emitted into a synthetic xlsx workbook. Strings become inline
 * string cells, finite numbers become numeric (`t="n"`) cells so that
 * read-excel-file returns them as numbers (e.g. for Excel serial dates).
 */
export type WorkbookCellValue = string | number | null | undefined;

export interface WorkbookSheetDefinition {
  name: string;
  rows: WorkbookCellValue[][];
}

export function makeWorkbookBlob(sheets: WorkbookSheetDefinition[]): Blob {
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

function renderSheetXml(rows: WorkbookCellValue[][]): string {
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

function renderCell(rowIndex: number, columnIndex: number, value: WorkbookCellValue): string {
  const ref = `${columnName(columnIndex)}${rowIndex}`;
  if (typeof value === "number" && Number.isFinite(value)) {
    return `      <c r="${ref}" t="n"><v>${value}</v></c>`;
  }
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

/**
 * Excel serial date for 2026-01-12 (used by the bank-export fixture below).
 * 25569 = 1970-01-01 in Excel's 1900 date system; +20465 days reaches 2026-01-12.
 */
export const NORTHSTAR_SERIAL_DATE_2026_01_12 = 46034;

/**
 * Fictional finance workbook for "Northstar Trading Co." used by the import
 * test harness. Sheets intentionally exercise the different shapes the
 * importer must handle so we can keep hardening behavior without waiting for
 * a real client workbook.
 */
export const NORTHSTAR_TRANSACTIONS_HEADER: WorkbookCellValue[] = [
  "Date",
  "Account",
  "Flow",
  "Parent Group",
  "Head",
  "Subcategory",
  "Description",
  "Vendor / Customer",
  "Amount",
  "Running Balance",
  "Reference"
];

export const NORTHSTAR_TRANSACTIONS_ROWS: WorkbookCellValue[][] = [
  NORTHSTAR_TRANSACTIONS_HEADER,
  // Revenue, expense, payroll mix in January
  ["2026-01-05", "HBL Current", "Revenue", "Revenue", "Sales", "Wholesale", "Invoice #1001 - hardware", "Northwind Imports", 850000, 1850000, "INV-1001"],
  ["2026-01-08", "HBL Current", "Outflow", "Operating", "Rent", "Office", "January rent - Block 6", "Snowdrop Realty", 150000, 1700000, "RENT-2026-01"],
  ["2026-01-12", "HBL Current", "Outflow", "Operating", "Internet", "Connectivity", "PTCL fiber", "PTCL", 8500, 1691500, "BILL-PTCL-01"],
  ["2026-01-15", "HBL Current", "Outflow", "Payroll", "Salaries", "Staff payroll", "January salaries x6", "Internal Staff", 420000, 1271500, "PAY-2026-01"],
  ["2026-01-20", "Meezan Savings", "Revenue", "Revenue", "Retainer", "Monthly retainer", "Monthly retainer - logistics", "Crescent Logistics", 180000, 880000, "INV-1002"],
  ["2026-01-22", "HBL Current", "Outflow", "Operating", "Software", "SaaS", "AWS infra", "AWS Pakistan", 32000, 1239500, "AWS-2026-01"],
  // Refund (revenue side, small amount)
  ["2026-01-25", "HBL Current", "Revenue", "Revenue", "Refund", "Vendor refund", "Refund for cancelled hosting", "AWS Pakistan", 5000, 1244500, "RFND-AWS"],
  // Missing optional subcategory/description on purpose
  ["2026-01-28", "Petty Cash", "Outflow", "Operating", "Office Supplies", "", "", "Atlas Stationers", 3500, 11500, "PC-204"],
  // Consulting + partial payment in February
  ["2026-02-02", "HBL Current", "Revenue", "Revenue", "Consulting", "Hourly", "Consulting - Atlas Honda", "Atlas Honda", 240000, 1469500, "INV-1003"],
  ["2026-02-10", "HBL Current", "Outflow", "Operating", "Rent", "Office", "February rent", "Snowdrop Realty", 150000, 1319500, "RENT-2026-02"],
  ["2026-02-14", "HBL Current", "Outflow", "Payroll", "Salaries", "Staff payroll", "February salaries x6", "Internal Staff", 430000, 889500, "PAY-2026-02"],
  ["2026-02-18", "Meezan Savings", "Revenue", "Revenue", "Sales", "Wholesale partial", "Partial payment for INV-1004", "Pace Pakistan", 75000, 955000, "INV-1004-P"],
  ["2026-02-25", "HBL Current", "Outflow", "Operating", "Travel", "Domestic", "Lahore trip - client visit", "PIA", 42500, 847000, "TRVL-01"],
  // March
  ["2026-03-05", "HBL Current", "Revenue", "Revenue", "Sales", "Wholesale", "Invoice #1005", "Aga Khan Foundation", 560000, 1407000, "INV-1005"],
  ["2026-03-10", "HBL Current", "Outflow", "Operating", "Rent", "Office", "March rent", "Snowdrop Realty", 150000, 1257000, "RENT-2026-03"],
  ["2026-03-15", "HBL Current", "Outflow", "Payroll", "Salaries", "Staff payroll", "March salaries x6", "Internal Staff", 430000, 827000, "PAY-2026-03"],
  ["2026-03-20", "HBL Current", "Outflow", "Operating", "Software", "SaaS", "Adobe Creative Cloud", "Adobe", 18000, 809000, "ADOBE-2026-Q1"]
];

const MONTHLY_SHEET_HEADER: WorkbookCellValue[] = ["Date", "Description", "Amount", "Head"];

export const NORTHSTAR_MONTHLY_SHEETS: WorkbookSheetDefinition[] = [
  {
    name: "Jan 2026",
    rows: [
      MONTHLY_SHEET_HEADER,
      ["2026-01-05", "Sales - Northwind", 850000, "Sales"],
      ["2026-01-08", "Rent - Snowdrop", -150000, "Rent"],
      ["2026-01-12", "PTCL fiber", -8500, "Internet"],
      ["2026-01-20", "Crescent retainer", 180000, "Retainer"]
    ]
  },
  {
    name: "Feb 2026",
    rows: [
      MONTHLY_SHEET_HEADER,
      ["2026-02-02", "Consulting - Atlas Honda", 240000, "Consulting"],
      ["2026-02-10", "Rent - Snowdrop", -150000, "Rent"],
      ["2026-02-18", "Partial payment - Pace", 75000, "Sales"]
    ]
  },
  {
    name: "Mar 2026",
    rows: [
      MONTHLY_SHEET_HEADER,
      ["2026-03-05", "Aga Khan invoice", 560000, "Sales"],
      ["2026-03-10", "Rent - Snowdrop", -150000, "Rent"],
      ["2026-03-15", "Salaries", -430000, "Salaries"]
    ]
  }
];

export const NORTHSTAR_GROUPED_SHEET: WorkbookSheetDefinition = {
  name: "Grouped Totals",
  rows: [
    ["", "", "Revenue", "Revenue", "Expense", "Expense"],
    // Blank child header under "Expense" exercises the parent fallback
    ["Date", "Description", "Sales", "Retainer", "", "Internet"],
    ["2026-01-31", "Jan operating totals", 850000, 180000, 150000, 8500],
    ["2026-02-28", "Feb operating totals", 240000, 50000, 150000, 9200]
  ]
};

export const NORTHSTAR_BANK_EXPORT_SHEET: WorkbookSheetDefinition = {
  name: "Bank Export",
  rows: [
    ["Monthly bank statement - HBL Current", "", "", "", "", "", ""],
    ["Txn Date", "Particulars", "Beneficiary", "Debit Amount", "Credit Amount", "Balance", "Reference"],
    ["2026-01-05", "Wire from Northwind", "Northwind Imports", "", "850,000", "1,850,000", "REF-1"],
    // Trailing minus on debit
    ["2026-01-08", "Cheque to Snowdrop", "Snowdrop Realty", "150,000-", "", "1,700,000", "CHQ-1"],
    // Excel serial date + DR suffix
    [NORTHSTAR_SERIAL_DATE_2026_01_12, "PTCL Bill auto-debit", "PTCL", "PKR 8,500 DR", "", "1,691,500", "ACH-1"],
    ["2026-01-15", "Salary batch", "Internal Staff", "PKR 420,000 DR", "", "1,271,500", "PAY-01"],
    // CR suffix on credit
    ["2026-01-20", "Crescent retainer", "Crescent Logistics", "", "180,000 CR", "1,451,500", "REF-2"],
    // Unicode minus on debit
    ["2026-01-28", "Office supplies petty top up", "Atlas Stationers", "−3,500", "", "1,448,000", "PC-204"],
    // Negative format "PKR 1,200.50-" on debit
    ["2026-01-30", "Misc card charge", "Daraz", "PKR 1,200.50-", "", "1,446,799.50", "CARD-99"]
  ]
};

export const NORTHSTAR_NOTES_SHEET: WorkbookSheetDefinition = {
  name: "Notes",
  rows: [
    ["Topic", "Detail"],
    ["Owner", "Northstar Trading Co. - Finance"],
    ["Fiscal Year", "Jan-Dec 2026"],
    ["Currency", "PKR"],
    ["Prepared By", "Finance team"]
  ]
};

export const NORTHSTAR_TARGETS_SHEET: WorkbookSheetDefinition = {
  name: "Quarterly Targets",
  rows: [
    ["Category", "Q1 Target", "Q1 Actual"],
    ["Revenue", 2500000, 2855000],
    ["Outflow", 1500000, 1465500]
  ]
};

export const NORTHSTAR_TRANSACTIONS_SHEET: WorkbookSheetDefinition = {
  name: "Transactions",
  rows: NORTHSTAR_TRANSACTIONS_ROWS
};

export const NORTHSTAR_WORKBOOK_SHEETS: WorkbookSheetDefinition[] = [
  NORTHSTAR_TRANSACTIONS_SHEET,
  ...NORTHSTAR_MONTHLY_SHEETS,
  NORTHSTAR_GROUPED_SHEET,
  NORTHSTAR_BANK_EXPORT_SHEET,
  NORTHSTAR_NOTES_SHEET,
  NORTHSTAR_TARGETS_SHEET
];

export function buildNorthstarWorkbookBlob(): Blob {
  return makeWorkbookBlob(NORTHSTAR_WORKBOOK_SHEETS);
}
