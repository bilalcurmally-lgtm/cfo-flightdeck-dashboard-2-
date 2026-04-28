# Billu.Works Dashboard V2 Session Handoff

Date: 2026-04-27

## What Shipped

- Mapping review step before calculations render.
  - Detected column selectors.
  - Date format selector.
  - Raw preview.
  - Live import-readiness validation with accepted/rejected counts, missing required mappings, invalid date/amount counts, and optional field coverage.
- CSV and Excel import through the same typed row-to-transaction pipeline.
- Dashboard filters for flow, account, head, subcategory, counterparty, and inclusive date ranges.
- Trend grain selector for daily, weekly, and monthly trend views.
- Full runtime-supported ISO currency picker with code-first labels.
- Local settings controls:
  - display currency.
  - cash on hand.
  - manual future events.
  - reset saved settings without clearing the current import.
- Clear import action that removes the current file from page state.
- In-app formula reference panel.
- Export improvements:
  - normalized transactions CSV keeps the full reviewed import.
  - reviewer JSON keeps the full reviewed import and audit state.
  - visible trend CSV exports the currently filtered daily/weekly/monthly trend.
- Sample datasets for freelancer, agency, and founder modes.
- Additional quality checks:
  - duplicate candidates.
  - transfer candidates.
  - rejected rows.
  - missing category/description/counterparty.
  - zero-amount rows.
- Inline favicon to remove browser 404 noise.

## Verification

Latest verification:

```text
npm test                    18 files passed, 71 tests passed
npm run build               passed
npm audit --audit-level=high found 0 vulnerabilities
```

Browser checks performed on:

```text
http://127.0.0.1:5174
```

Checked:

- sample import, mapping review, and apply flow.
- mapping validation disables Apply when required mapping is removed.
- currency picker includes broad ISO currency set and updates display formatting.
- trend grain switches from monthly to weekly.
- date filters narrow visible records.
- Clear removes current import.
- Formulas panel opens.

## Intentional Limits

- No server-side transaction storage.
- No bank integrations.
- No automatic duplicate removal.
- No automatic transfer exclusion or reclassification.
- No automatic currency conversion.
- No AI workflow in the dashboard.
- Excel support is initial `.xlsx` parsing only; no multi-sheet selector yet.

## Best Next Steps

1. Add a worksheet selector for multi-sheet Excel files.
2. Add a transaction detail drawer or row expansion for audit review.
3. Add preset filter chips for common views: revenue only, outflow only, transfers, duplicates.
4. Add downloadable filtered transaction CSV as a separate explicit export.
5. Add basic chart image export or printable report view.
6. Consider lightweight browser/UI tests for sample import, mapping validation, filters, and trend grain.
7. Split `src/main.ts` into smaller UI modules once one more feature lands; it is now doing a lot.
