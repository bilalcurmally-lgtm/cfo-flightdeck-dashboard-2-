# Codex Review — Runway Confidence Mechanics

Date: 2026-06-15
Slice: B from `docs/GROK_COMPOSER_2_5_BACKLOG_BATCH_2026-06-15.md`

## What Changed

Pure mechanical runway confidence model with UI and export wiring.

### Scoring model

- **Score:** 0–100 deterministic, rounded integer
- **Levels:** high ≥ 70, medium ≥ 40, low < 40
- **Base:** 50, then adjustments for:

| Factor | Effect |
|--------|--------|
| Cash on hand set | +15 / missing −25 |
| History coverage (months) | +15 (≥6), +8 (≥3), −8 (1–2), −20 (0) |
| Income/expense volatility (CV) | +5 low, −5 moderate, −12 high |
| Rejected import rows | −10 |
| Pending category review | −5 each (cap −15) |
| Readiness ready/partial/needs-review | +5 / −6 / −12 |
| Revenue concentration ≥75% / ≥50% | −10 / −4 |
| Manual forecast events | −4 (1–2), −10 (≥3) |
| Rejected manual event lines | −5 |

### UI wiring

- Cockpit **Runway** tile meta: `{level} confidence · …`
- **Cash Health** panel: confidence headline paragraph
- No new large panel

### Export wiring

- **Dashboard Manifest:** `context.runwayConfidence` + `runwayConfidence` diagnostic entry
- **Accountant Workbook Summary:** level, score, headline rows

## Files Changed

| File | Change |
|------|--------|
| `src/finance/runway-confidence.ts` | **NEW** — model + `buildRunwayConfidenceInput()` |
| `src/finance/runway-confidence.test.ts` | **NEW** — high/medium/low + determinism tests |
| `src/ui/dashboard-results.ts` | Computes and threads confidence |
| `src/ui/dashboard-cockpit.ts` | Runway tile meta |
| `src/ui/dashboard-sections.ts` | Cash Health confidence line |
| `src/export/dashboard-manifest.ts` | Context + diagnostic |
| `src/export/accountant-workbook.ts` | Summary rows |
| `src/export/dashboard-manifest.test.ts` | Context assertion |

## Tests Run

```bash
npx vitest run src/finance/runway-confidence.test.ts src/export/dashboard-manifest.test.ts src/ui/dashboard-results.test.ts
# passed
```

## Limitations

- Volatility uses monthly CV on visible KPI scope only.
- No prior-import runway delta folded into confidence (same deferral as workbook diagnostics).
- Readiness drawer does not duplicate confidence (Cash Health + cockpit meta are the surfaces).

## Manual QA

1. Import sample with 3+ months of data, set cash on hand → expect high/medium confidence in Cash Health.
2. Clear cash on hand or import thin history → expect low confidence and risk reasons in headline.
3. Export Dashboard Manifest → confirm `context.runwayConfidence` present.