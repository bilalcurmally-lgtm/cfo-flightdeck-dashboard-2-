# Billu.Works Dashboard V2 Session Handoff

Date: 2026-05-23

Scope: dashboard backend/import/export work. Pet/mascot work has been moved out of this repo.

## Current State

- Branch: `main`
- Workspace: `D:\projects\dashboard\v2`
- Git status at handoff: clean, ahead of `origin/main` by 20 commits.
- `pet-runs/` was moved to `D:\projects\pet-runs`, so the dashboard worktree no longer has that unrelated untracked directory.
- A gstack checkpoint was also saved at:
  `C:\Users\Bilal\.gstack\projects\v2\checkpoints\20260523-122424-next-backend-big-tickets.md`

## Vault Policy

- Hard rule: keep the in-repo project vault current for every meaningful dashboard session.
- Use `docs/SESSION_HANDOFF_YYYY-MM-DD.md` as the durable handoff record.
- Each handoff should capture current git state, shipped changes, verification, and first next-session priorities.
- Gstack checkpoints are useful, but they do not replace the in-repo vault note.

## What Changed Recently

### Claude Design Artifacts

- Claude Design dropped a frontend plan at `C:\Users\Bilal\Downloads\dashboard v3 (1)`.
- Files present:
  - `Redesign Plan.html`
  - `Redesign Plan-print.html`
  - `Implementation Plan.html`
- Browser-reviewed the HTML plans through a local static server on `127.0.0.1:8765`.
- Useful direction to keep:
  - staged implementation order instead of a broad UI rewrite.
  - no React assumptions.
  - no inactive/fake tabs.
  - pre-import state first, then KPI cockpit strip, then handoff/export rail, then optional real tabs.
- Important implementation adjustment:
  - The current `src/ui/app-shell.ts` renders a static shell once. `src/main.ts` re-renders `#results` for mapping review and dashboard results. Any pre-import redesign should either keep the existing static import controls or deliberately refactor the shell/event wiring in a small, tested stage.
  - `src/styles.css` already has Billu.Works tokens such as `--color-canvas`, `--color-panel`, `--color-primary`, and `--color-line`. Use Claude's `bw-*` classes as component naming inspiration, but map colors onto the existing design tokens instead of pasting a second token system wholesale.
  - Avoid copying the `color-scheme: light only` snippet from the plan; use valid CSS only if we intentionally change color-scheme behavior.
- Claude Design then dropped an updated Stage 1 patch at `C:\Users\Bilal\Downloads\dashboard v3 (2)\Stage 1 Patch.html`.
- The revised patch correctly recognizes that `src/main.ts` owns state and `#results` repainting, but one important conflict remains:
  - `src/ui/app-shell.ts` already renders the current import panel above `#results`.
  - If the new pre-import panel is also rendered inside `#results` with no shell changes, the app will show duplicate import controls.
  - Stage 1 should choose one of two paths before implementation:
    1. keep controls in `app-shell.ts` and redesign the existing static `.import-panel`; or
    2. move first-run controls into `#results`, but then intentionally simplify/remove the static `.import-panel` in `app-shell.ts`.
- Existing token names to send back to Claude:
  - `--bw-surface` -> `--color-panel`
  - `--bw-surface-2` -> `--color-canvas`
  - `--bw-surface-raised` -> `--color-success-soft`
  - `--bw-rule` -> `--color-line`
  - `--bw-anchor` -> `--color-primary`
  - `--bw-anchor-strong` -> `--color-primary-strong`
  - `--bw-anchor-fg` -> `#fffffc` or `--color-panel`
  - `--bw-data-trust` -> `--color-primary` for trust labels, or `--color-success-soft` only for backgrounds
  - `--bw-ink` -> `--color-ink`
  - `--bw-ink-2` -> `--color-ink-soft`
  - `--bw-ink-3` -> `--color-muted`
  - `--bw-mono` -> no token exists yet; use `ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace`
- Chrome/Codex extension coordination:
  - Successfully claimed the live Claude Design Chrome tab via the Codex Chrome Extension.
  - Sent Claude the duplicate-controls correction and token map directly.
  - Claude replied with Stage 1 Patch v2, choosing Path 2: first-run controls in `#results`, old static shell import panel removed/simplified, and load handlers extracted from `src/main.ts`.
  - Follow-up review sent back to Claude:
    - local `C:\Users\Bilal\Downloads\dashboard v3 (2)\Stage 1 Patch.html` still appears to be the older artifact, so v2/v3 needs to be saved/exported as a distinct file.
    - do not design around nonexistent `paintResults()` or `state.records`; current app uses explicit `renderWorksheetPicker`, `renderMappingReview`, `renderImportResult`, and the clear handler.
    - if shell controls are removed, current boot-time `querySelector!` calls in `src/main.ts` must be updated or they will crash.
    - prefer a `bindPreImportActions(...)` module following existing `*-actions.ts` patterns over a raw document-level dispatcher in `main.ts`.
    - keep the hidden/actual file input and sample-selection flow explicit.
  - A heartbeat automation named `Check Claude Design Stage 1` was created to revisit the Claude tab every 10 minutes and continue coordination if the thread is still active.

### Excel Import And Workbook Handling

- `.xlsx` parsing is now robust enough for the fictional Northstar workbook harness.
- Compatible sheet combining now chooses the largest compatible transaction-like sheet group instead of blindly using the first transaction-like sheet.
- Mixed workbooks with a master `Transactions` sheet plus monthly tabs now combine the monthly tabs correctly.
- Worksheet provenance flows from combined Excel rows into normalized records and exports as `sourceSheet`.

### Northstar Demo Harness

- Added a built-in `Load Excel Demo` button.
- The demo generates the Northstar Trading Co. workbook locally and opens the normal worksheet picker.
- Browser verification confirmed:
  - 8 sheets are shown.
  - Combine plan shows `3 sheets · 10 rows can be combined`.
  - Combining lands on mapping review with `10/10 rows ready`.

### Export Work

- Normalized transaction CSV now includes `sourceSheet`.
- Added normalized transaction Excel workbook export.
  - UI button: `Transactions Excel`.
  - Workbook sheet: `Transactions`.
  - Amount, signed net, and running balance are emitted as spreadsheet numbers.
- Reviewer JSON now includes:
  - accepted row counts by source worksheet.
  - compact diagnostic counts for duplicate groups/records and transfer candidates/records.
- Existing exports remain: filtered CSV, reviewer JSON, trend CSV, trend SVG, trend PNG, print report.

### Test Harness

- Added reusable xlsx writer at `src/export/xlsx-workbook.ts`.
- `src/import/excel-test-fixtures.ts` now reuses the production xlsx writer instead of owning a test-only copy.
- Northstar workbook tests cover parsing, monthly combine, clean master sheet, messy bank export, grouped totals, provenance, readiness, exports, and dashboard view.

## Verification

Latest checks run before this handoff:

```text
npm test              47 files passed, 198 tests passed
npm run build         passed
git diff --check      passed, with CRLF warnings only
Browser checks        passed for Northstar demo combine and Transactions Excel download
```

The recurring CRLF warnings are from Git touching existing Windows-line-ending files.

## First Things To Knock Out Next Session

### Backend First

1. Multi-sheet accountant Excel export packet.
   - Add an `.xlsx` export with sheets such as `Transactions`, `Monthly Trend`, `Diagnostics`, `Rejected Rows`, and `Source Sheets`.
   - Reuse `src/export/xlsx-workbook.ts`.
   - Test by parsing the generated workbook back through `parseExcelWorkbook`.

2. Rejected rows export.
   - Add rejected-row CSV/XLSX export with row number, rejection reason, and original row fields.

3. Better sheet-combine metadata.
   - Backend should expose compatible candidate groups, not only the selected best group.
   - This lets UI eventually choose master `Transactions` vs monthly tabs intentionally.

4. Stronger diagnostics.
   - Add duplicate/transfer confidence reasons.
   - Consider near-duplicate checks for same date/amount/account with slightly different descriptions or counterparties.

5. Mapping presets / recurring bank formats.
   - Save/import column mapping profiles for repeat bank/client exports once real formats arrive.

### Frontend / Product Stack

1. First-run onboarding state.
   - Users should feel the dashboard before understanding every feature.
   - Candidate direction: sample/demo-forward pre-import state with clear `Load Sample`, `Load Excel Demo`, and `Load your own file`.

2. KPI cockpit treatment.
   - Promote revenue, outflow, net cash, average burn, and runway into a stronger first-viewport instrument panel.
   - The calculations already exist; this is hierarchy and visual treatment.

3. Founder runway emphasis.
   - Make runway visually unavoidable once data is loaded.

4. README/product story refresh.
   - README is behind the product and should be updated so finished features are not mistaken for missing features.

5. Later product expansion.
   - Budget vs Actual before Receivables.
   - Prefer one coherent small-business financial cockpit over a separate admin dashboard.

6. Visual exploration.
   - Explore Bloomberg-terminal density and cockpit confidence while preserving Billu.Works audit legibility and the `DESIGN.md` soft financial cockpit rules.

## Current Git Notes

Recent commits:

- `5603c3b fix: combine best compatible workbook sheets`
- `2fc7e04 feat: add northstar excel demo import`
- `c42270e feat: export normalized transactions workbook`
- `32b8064 feat: add reviewer diagnostic summary`
- `bb6d819 feat: summarize worksheet provenance in reviewer export`
- `ffedfdf feat: preserve worksheet provenance in exports`

Commit this handoff doc if keeping repo docs as the durable vault for the project.
