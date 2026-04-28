# Billu.Works Finance Formulas

The V2 finance model starts with audited transaction records. Dashboard formulas should only build
on these fields after the import tests pass.

## Imported Transaction Record

- `amount`: absolute value of the imported transaction amount.
- `flow`: `revenue` or `outflow`.
  - If the import has a type/direction column, revenue tokens are checked first.
  - Outflow tokens are checked second.
  - If no token matches, positive and zero amounts are revenue; negative amounts are outflow.
- `signedNet`: revenue as positive `amount`, outflow as negative `amount`.
- `dateISO`: local calendar date formatted as `YYYY-MM-DD`.
- `periodDaily`: same as `dateISO`.
- `periodWeekly`: Monday start date for the transaction week.
- `periodMonthly`: `YYYY-MM`.
- `account`: imported account/bank/wallet name when present; otherwise `Unassigned Account`.
- `runningBalance`: imported running/account balance when present; otherwise `null`.
- `subcategory`: imported subcategory/detail category when present; otherwise `Unassigned Subcategory`.
- `counterparty`: imported vendor, customer, client, merchant, or payee when present; otherwise `Unassigned Counterparty`.

## Current Import Scope

CSV and Excel files are parsed locally. The browser pauses on a mapping review before dashboard
calculations render, so date, amount, flow/type, account, balance, category, subcategory,
counterparty, and description columns can be confirmed or corrected locally.

The mapping review shows import readiness before calculations render:

- accepted rows with valid date and amount fields.
- rows that would be rejected under the current mapping.
- missing required date or amount mappings.
- invalid date and invalid amount counts.
- optional mapped-field coverage for account, balance, category, subcategory, counterparty, and description.

## Phase 2 Summary Formulas

- `revenue`: sum of `amount` where `flow` is `revenue`.
- `outflow`: sum of `amount` where `flow` is `outflow`.
- `netCash`: `revenue - outflow`.
- Monthly trend:
  - group records by `periodMonthly`.
  - calculate revenue, outflow, and net cash per group.
  - sort periods oldest to newest.
- Trend grain:
  - daily uses `periodDaily`.
  - weekly uses `periodWeekly`, with Monday as week start.
  - monthly uses `periodMonthly`.
- Top heads:
  - group by `flow` and `head`.
  - sum `amount` and count transactions.
  - sort by amount descending.
- Top subcategories:
  - group by `flow`, `head`, and `subcategory`.
  - ignore unassigned subcategories.
  - sum `amount` and count transactions.
- Account balances:
  - when a running balance column exists, use the latest dated imported balance per account.
  - otherwise fall back to net activity per account from `signedNet`.
- Duplicate candidates:
  - grouped by date, account, flow, amount, head, and description.
  - groups with more than one row are flagged for review.
- Transfer candidates:
  - same date, same amount, opposite flow, and different accounts.
  - candidates are flagged only; transactions are not automatically excluded.

## Cash Health Formulas

- Average monthly burn: average monthly `outflow` across months that have outflow records.
- Runway months: `cash on hand / average monthly burn`.
  - Runway is shown as unavailable when cash on hand or burn is zero.
- Revenue concentration: largest revenue head divided by total revenue.
- Largest transaction: imported transaction with the highest absolute `amount`.

## 13-Week Forecast Formulas

- Average weekly net: average of weekly `signedNet` totals from imported transactions.
- Manual future event: a line entered as `YYYY-MM-DD, amount, label`.
  - Positive amounts increase projected cash.
  - Negative amounts reduce projected cash.
- Weekly projected cash: previous projected cash plus average weekly net plus that week's manual event net.
- Forecast horizon: 13 weeks starting from the current calendar week.

## Exports

The normalized transaction CSV is the human/accountant-friendly export. It includes:

- `date`
- `flow`
- `head`
- `parent`
- `description`
- `account`
- `amount`
- `signedNet`
- `runningBalance`

The reviewer JSON export is the machine-readable audit export generated locally from already-computed dashboard state. It includes:

- import row counts, date format, and detected mapping.
- summary totals, cash health, account balances, diagnostics, quality signals, top heads, and monthly trend.
- 13-week forecast rows and manual future cash events.
- privacy text noting that the report is generated in-browser without default transaction upload.

The visible trend CSV exports the currently filtered chart data only, using the selected daily,
weekly, or monthly trend grain. It includes:

- `period`
- `revenue`
- `outflow`
- `netCash`

## Local Settings

Display currency, cash on hand, and manual future cash events are stored in browser `localStorage`.
They stay on the user's device and can be cleared by clearing site data. The currency picker uses
the runtime-supported ISO currency list, with code-first labels. Currency changes display
formatting only; imported numeric values are not converted.

The Clear action removes the current imported file from the page state. It does not clear saved
local settings such as display currency, cash on hand, or manual forecast events.

The Reset Settings action clears saved display currency, cash on hand, and manual forecast events
from browser storage while leaving the current reviewed import on screen.

## Dashboard Filters

Flow, account, head, subcategory, counterparty, and date range filters change visible dashboard
calculations and tables only. Date ranges are inclusive. Normalized CSV and reviewer JSON exports
keep the full reviewed import so accountant review does not accidentally inherit an on-screen slice.
