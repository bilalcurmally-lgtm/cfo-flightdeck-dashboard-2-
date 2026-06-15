# Codex Review — UI Microcopy Audit

Date: 2026-06-15
Slice: D from `docs/GROK_COMPOSER_2_5_HARDENING_BATCH_2026-06-15.md`

## What Changed

Copy-only polish for recently shipped surfaces in `src/ui/dashboard-sections.ts`.

| Surface | Before | After |
|---------|--------|-------|
| Budget panel title | Budget Vs Actual | Budget vs Actual |
| Budget empty helper | compare plan against | compare your plan against |
| Exports intro | CSV/JSON/trend only | Names Accountant Workbook, Dashboard Manifest, trend exports |
| Forecast helper | Tag expected income below or keep… | Added comma and terminal period |
| Expected income guard | em dash separator | sentence break for readability |

Unchanged (already consistent):

- **Expected Income** section heading
- **Runway confidence:** prefix in Cash Health
- **Remember for future imports** in category review drawer
- Export button labels: Accountant Workbook, Dashboard Manifest

## Files Changed

| File | Change |
|------|--------|
| `src/ui/dashboard-sections.ts` | Copy updates only |

## Suggested Commit

`copy(ui): align planning and export microcopy`