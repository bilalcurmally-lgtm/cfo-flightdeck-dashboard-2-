# Billu.Works Dashboard V2: Excel Import Structure Brief

Prepared for: Billu.Works dashboard planning
Date: May 7, 2026
Status: Draft for review, pending the client's actual workbook/sample sheets

## Executive Summary

The recommended structure is one master Excel workbook, with data organized in clean database-style sheets. For the finance dashboard, the strongest structure is a single `Transactions` sheet containing all months together, where every row is one transaction and the month is derived from the `Date` column.

This is better than having separate custom month layouts because it makes the dashboard much easier to compare across months, categories, accounts, vendors, clients, and cash-flow periods. Separate monthly tabs can still be supported later, but only if every monthly sheet uses the same columns and layout.

The dashboard should not rely on merged parent headers or visual Excel grouping. Instead, the hierarchy should be captured in normal columns such as `Parent Group`, `Head / Category`, and `Subcategory`.

## Recommended Workbook Structure

Recommended master workbook:

| Sheet Name | Purpose | Required Now |
| --- | --- | --- |
| `Transactions` | All finance transactions across all months | Yes |
| `Categories` or `Chart of Accounts` | Optional category list used for cleaner mapping and reporting | Later / optional |
| `Opening Balances` | Starting balance by bank/cash account | Later / optional |
| `Notes` or `Assumptions` | Clarifications for finance/admin review | Optional |

Best default:

```text
Master Workbook.xlsx
  - Transactions
  - Categories / Chart of Accounts
  - Opening Balances
  - Notes
```

## Recommended Transactions Columns

The `Transactions` sheet should ideally use one header row and simple columns:

| Column | Purpose | Example |
| --- | --- | --- |
| `Date` | Transaction date | `2026-05-01` |
| `Account` | Bank, cash, wallet, or source account | `HBL Current Account` |
| `Flow` | Revenue/inflow or expense/outflow | `Revenue` |
| `Parent Group` | Broad grouping | `Revenue`, `Expense`, `Assets`, `Liabilities` |
| `Head / Category` | Main reporting category | `Sales`, `Office`, `Payroll` |
| `Subcategory` | More detailed child category | `Website Project`, `Internet`, `Part-time Staff` |
| `Description` | Transaction description/narration | `Client payment for invoice 1021` |
| `Vendor / Customer` | Counterparty | `ABC Client` |
| `Amount` | Positive amount | `250000` |
| `Running Balance` | Account balance after transaction, if available | `1250000` |
| `Reference / Invoice No` | Invoice, receipt, cheque, or transaction ID | `INV-1021` |
| `Notes` | Any manual explanation | `Advance payment` |

Minimum required fields for finance import:

```text
Date
Amount
```

Strongly recommended fields:

```text
Date
Account
Flow
Parent Group
Head / Category
Subcategory
Description
Vendor / Customer
Amount
Running Balance
```

## Parent And Child Headers

The client mentioned that their office sheets may have one parent header and multiple child headers. That is common in human-made Excel reports, but it is not the best format for dashboard import.

Avoid this structure:

| Revenue | Revenue | Expense | Expense |
| --- | --- | --- | --- |
| Sales | Retainers | Rent | Internet |
| 250000 | 100000 | 50000 | 12000 |

The problem is that this layout puts meaning into visual header placement. It is readable to people, but harder to import consistently because parent-child relationships are spread across multiple header rows.

Use this instead:

| Date | Parent Group | Head / Category | Subcategory | Flow | Amount |
| --- | --- | --- | --- | --- | --- |
| 2026-05-01 | Revenue | Sales | Website Project | Revenue | 250000 |
| 2026-05-02 | Revenue | Retainers | Monthly Support | Revenue | 100000 |
| 2026-05-03 | Expense | Office | Rent | Outflow | 50000 |
| 2026-05-04 | Expense | Office | Internet | Outflow | 12000 |

This keeps the same meaning, but makes comparison, filtering, and charts much cleaner.

## One Sheet Vs Monthly Sheets

### Best Option: One Transactions Sheet

Recommended:

```text
Transactions
  Date | Account | Flow | Parent Group | Head | Subcategory | Description | Amount
```

Benefits:

- Monthly comparison is automatic from the `Date` column.
- The dashboard can show month-over-month revenue, expense, net cash, category trends, and account balances.
- It avoids duplicate headers, inconsistent sheet names, and layout drift.
- It is easier to validate and easier for accountant review.

### Acceptable Option: Monthly Sheets

This can work:

```text
Jan 2026
Feb 2026
Mar 2026
...
```

But only if every sheet has the same columns in the same structure. The dashboard would then need a "combine all monthly sheets" import mode that reads each monthly tab, merges the rows, and derives reporting periods from either the `Date` column or the sheet name.

Monthly sheets should not use different layouts, merged headers, or manually placed summary blocks above the data.

## What V2 Can Support Today

Dashboard v2 already has a local-first finance import foundation:

- CSV import
- Excel workbook parsing
- Worksheet picking
- Header detection
- Mapping review
- Transaction validation
- Finance fields for date, amount, flow, parent/group, category/head, subcategory, description, counterparty, account, and running balance

Current v2 is best suited to clean transaction-style data. Once we receive the client's actual workbook, we can customize the import flow around their real column names and office format.

## What We Still Need From The Client

Before finalizing import behavior, we need one real or anonymized sample workbook.

Requested sample:

- At least one normal month of data
- All columns they expect to use
- Any parent/child headers they currently use
- Example revenue, expense, transfer, payroll, inventory, and admin rows if those exist
- Any notes explaining what each column means
- A few rows with messy or real-world cases, such as missing category, partial payment, advance payment, refund, or transfer

If privacy is a concern, names and amounts can be anonymized as long as the structure remains the same.

## Future Platform Direction

The client's mention of inventory, admin, attendance, and stock is useful. These should probably become separate platform modules, not mixed directly into the finance transaction import.

Recommended future structure:

| Module | Suggested Sheet | What It Tracks |
| --- | --- | --- |
| Finance | `Transactions` | Revenue, expenses, cash flow, balances |
| Inventory | `Inventory` or `Stock Ledger` | Items, stock in/out, units, cost, suppliers |
| Attendance | `Attendance` | Employee, date, status, check-in/out, overtime |
| Admin | `Admin Tasks` or `Operations` | Renewals, documents, licenses, assignments |
| Payroll | `Payroll` | Staff, salary, deductions, payments |

This would let Billu.Works grow from a finance dashboard into a broader small-business operating platform. The key is to keep each module's data in its own clean sheet or table, then connect them through shared fields such as dates, accounts, employees, vendors, customers, and items.

## How Inventory Could Work Later

Inventory should be handled as a stock ledger rather than a simple list of current stock.

Recommended columns:

| Column | Purpose |
| --- | --- |
| `Date` | Stock movement date |
| `Item Code` | Unique item/SKU |
| `Item Name` | Product/item name |
| `Category` | Item group |
| `Movement Type` | Purchase, sale, adjustment, return, damage |
| `Quantity In` | Stock added |
| `Quantity Out` | Stock removed |
| `Unit Cost` | Cost per unit |
| `Supplier / Customer` | Related party |
| `Reference` | Invoice/order number |
| `Location` | Warehouse/store/location |
| `Notes` | Explanation |

This allows the platform to calculate current stock, stock value, fast-moving items, low-stock alerts, purchase trends, and inventory-linked cash flow.

## How Attendance Could Work Later

Attendance should also be row-based:

| Column | Purpose |
| --- | --- |
| `Date` | Attendance date |
| `Employee ID` | Unique employee code |
| `Employee Name` | Staff name |
| `Department` | Team/department |
| `Status` | Present, absent, leave, half-day, remote |
| `Check In` | Start time |
| `Check Out` | End time |
| `Overtime Hours` | Overtime, if any |
| `Notes` | Manual explanation |

This can later support attendance summaries, absences, overtime, payroll preparation, and admin reporting.

## Implementation Recommendation

For now, keep building the remaining finance dashboard functions in v2 using a clean import model. Do not over-customize before seeing the client's real workbook.

Recommended approach:

1. Continue building v2 around the standard transaction model.
2. Ask the client for one real or anonymized Excel workbook.
3. Test the workbook in the dashboard.
4. Identify which columns map cleanly and which need custom logic.
5. Add import improvements only after seeing the real format.
6. Keep inventory, attendance, admin, and payroll as future modules with separate data models.

## Suggested Message To Client

You can send this:

> For the dashboard, the cleanest option is one master Excel workbook with a `Transactions` sheet that contains all months together. Each row should be one transaction, and the month should come from the `Date` column. If you prefer separate sheets for each month, that can also work, but every monthly sheet should use the exact same columns and layout.
>
> For parent and child categories, please avoid merged headers or visual grouped headers. Instead, use separate columns like `Parent Group`, `Head / Category`, and `Subcategory`. That gives us the same structure but makes the dashboard much better for comparison, filtering, and reporting.
>
> Once you share a real or anonymized sample workbook, we can test it in the v2 dashboard and customize the import flow around your actual office format.

## Bottom Line

Use one master workbook, one clean `Transactions` sheet, and explicit hierarchy columns. Keep the office's human-friendly summaries separate from the raw import data. This will make the dashboard easier to build, easier to audit, and easier to extend into future Billu.Works modules like inventory, attendance, payroll, and admin operations.
