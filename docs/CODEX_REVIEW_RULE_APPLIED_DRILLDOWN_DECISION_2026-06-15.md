# Codex Review — Rule-Applied Drilldown Decision

Date: 2026-06-15
Slice: C from `docs/GROK_COMPOSER_2_5_P3_BATCH_2026-06-15.md`

## Question

Should rule-applied rows get a dedicated drilldown drawer beyond the compact applied-rules
signal and Local Settings rule list?

## Current Auditability

Operators already have:

1. **Compact signal** — `appliedRuleFeedback` banner with row/rule counts after import
2. **Category review queue** — rule-applied rows are hidden from the manual review queue
   (by design) but overrides are visible on affected transactions
3. **Local Settings** — full saved-rules list with edit/delete
4. **Exports** — manifest caveat + workbook context when rules applied; overrides in CSV exports
5. **Re-import** — rules re-apply deterministically via `applyClassificationRulesWithMatches`

## Decision

**Do not implement a rule-applied drilldown drawer in V1.**

### Rationale

| Factor | Assessment |
|--------|------------|
| User value | Low for typical small-operator rule counts (1–5 rules) |
| Implementation cost | New drawer, row↔rule mapping UI, tests, Playwright surface |
| Existing coverage | Banner + settings + export caveats answer “did rules run?” |
| Risk | Drawer duplicates category-review patterns and blurs “auto vs manual” semantics |
| P3 scope | Budget and forecast slices deliver higher product leverage |

### When to Revisit

Re-open if any of these become true:

- Operators routinely maintain **10+** rules and need per-import match audit
- Support requests ask “which rule changed this row?” without opening exports
- Accountant workbook gains a **Rules Applied** sheet with match detail (export-first path)

### Preferred Future Path (if needed)

1. Export-first: workbook sheet listing `{ruleId, ruleLabel, matchedRecordIds[]}` per import
2. Light UI: expandable list under the applied-rules banner (no full drawer)
3. Full drawer only if export + expandable list still fail QA

## Code Shipped

None — decision doc only.

## Suggested Commit

`docs: rule-applied drilldown decision (defer drawer)`