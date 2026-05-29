# Dashboard Session Handoff - 2026-05-29

## Current State

- Branch: `main`. No code changed this session — planning only.
- This was a `/plan-ceo-review` (SCOPE EXPANSION) session plus a codex (gpt-5.5)
  outside-voice review and a grounded engineering architecture pass.
- Three planning docs were created/updated (see below). No `src/` changes; tests/build untouched.

## What Changed

New/updated docs:

- `docs/designs/AUDITABLE_COCKPIT_V2.md` (new) — strategy doc. The "why," the landscape
  research, scope decisions, and explicit out-of-scope calls.
- `docs/designs/MASTER_PLAN_AUDITABLE_COCKPIT.md` (new) — execution plan. Architecture lock
  (audit data model, re-derivation engine, persistent workspace) + phased, session-by-session
  build (Phases A–F, ~11 sessions) with test and review gates.
- `docs/TODOS.md` (new) — deferred work: Budget vs Actual (P1), expected-income forecast
  tagging (P2, forecast-input only, not invoicing).

## Key Decisions

- **Positioning flips** from "privacy-first" (now commoditized — 3+ free local CSV analyzers
  exist) to **"auditable cash truth + workflow trust."** Privacy becomes a supporting feature.
- **The moat is the workflow, not the popover** (codex correction): persistent local workspace
  (IndexedDB + exportable `*.billu.json`), import history, "what changed since last import,"
  saved classification rules, review queue. This is the retention layer and the answer to
  "make it truly usable." Owner chose the FULL workflow version.
- **Anomaly review is non-blocking** — KPIs render instantly with a "needs review" badge,
  preserving the 3-second runway moment. No gate before render.
- **Focused category review** for high-distortion categories only (transfers, owner draws,
  taxes, refunds, reimbursements, loan proceeds).
- **Build the model before the story** — audit data model + one auditable KPI first;
  positioning copy ships LAST, once provably true.
- **Out (owner decisions):** admin panel, invoice creation/sending, full receivables,
  multi-user/server. Boss's admin-panel/invoicing suggestions declined to keep focus
  ("be good at one thing"); Payoneer/Wise already own invoicing.

## Verification Already Run

- None (planning session, no code). Existing baseline from 2026-05-28 handoff: 212 tests pass,
  clean build.
- Codex review ran read-only and returned 18 findings; 8 folded in as refinements, 4 surfaced
  as decisions and resolved by the owner, the rest incorporated into the master plan.

## Eng Review Outcome (2026-05-29)

`/plan-eng-review` ran on the master plan. Verdict: CLEAR, 0 critical gaps. Two architecture
issues found and resolved (master plan §3.2 / §3.3 updated):

- **Issue 1 — math source of truth.** Do NOT re-implement KPI math in `audit-derive.ts`.
  Refactor the EXISTING `cockpit-kpis.ts` / `cash-health.ts` / `summary.ts` to emit lineage
  in the same pass; `deriveCockpit` becomes a thin reader. One source of truth, no drift.
- **Issue 2 — transaction identity.** The persistence fingerprint must use IMMUTABLE import
  fields only (dateISO + amount + rawDescription + account + sourceSheet) + an occurrence
  index. NOT category/counterparty (mutable → orphans decisions; collisions hit wrong rows).

Folded-in recommendations: `src/workspace/` behind a thin `workspaceStore` facade; IndexedDB
degrades to in-memory + warning; corrupted `.billu.json` rejected loudly; lineage drawer caps
row display (~50 + count). Four tests added (signature distinctness, signature stability,
IndexedDB degradation, corrupted-file rejection).

## Design Review Outcome (2026-05-29)

`/plan-design-review` ran on the UI phases (B/C/D), calibrated to `DESIGN.md`. Score 5/10 →
9/10. Two design forks decided; full state/responsive/a11y spec folded into master plan §3.6:

- **Lineage surface = right-side slide-in panel** (matches DESIGN.md's reserved utility rail;
  audit-surface styling, full-screen sheet on mobile, ARIA dialog + focus trap).
- **"What changed since last import" = calm welcome-back summary strip** on re-import
  (olive=improvement, coral=attention, dismissible).
- Folded in: interaction-state table (loading/empty/error/success per surface), token mapping
  (drawer/calc-tree/diff = flat audit surfaces; badge = coral chip not alert banner; toggles =
  tactile chips), responsive rules, and accessibility (load-bearing for a trust product:
  keyboard nav, aria-live on KPI re-derive, 44px targets, AA contrast).

All three plan reviews (CEO, Eng, Design) are CLEAR. Plan is ready to implement.

## First Next-Session Priorities

1. **Phase A1** (from the master plan): refactor `cockpit-kpis.ts` / `cash-health.ts` /
   `summary.ts` to emit `MetricLineage` in-pass + add `src/finance/audit.ts` types, capturing
   lineage for revenue (direct rows) and runway (calc tree with the `cashOnHand` assumption).
   Golden-file lineage tests + drawer-value-equals-cockpit-value test. No UI change. Existing
   212 tests must stay green.
2. Resolve the runway `cashOnHand` source ambiguity (running balance vs inferred vs
   user-entered) as an explicit labeled `Assumption` in A1.
3. Optionally run `/plan-design-review` before the Phase B/C/D UI work.

## Notes

- Two highest-risk abstractions to guard with extra adversarial review: `audit-derive.ts`
  (Phase A) and the persistence layer (Phase D).
- `DESIGN.md` remains required reading before any visual work (Phases B/C/D have UI).
- Review cadence: per session `/code-review` + `codex review`; per phase `/checkpoint`.

---

## Session addendum — 2026-05-29 (later, Opus, A1 committed + B1 started)

Owner reassigned the implementation pen to Opus while Codex was on session cooldown
("pick up the fixes … you may as well do the next session as well … leave him a message
and he can pick up from where you left off"). Bridge messages: `0010` (codex-inbox +
`messages/0010-...md`) and `0011`.

### Git state
- Branch `codex/a1-audit-model`, two new commits on top of `96fbeda`:
  - `a685f26` feat(finance): Phase A1 auditable cockpit lineage model (committed; was
    working-tree-only at the start of this session).
  - `96fd39e` feat(ui): Phase B1 lineage drawer content renderer (first slice).
- Not pushed; not merged to `main`. `.agent-bridge/` and `.playwright-mcp/` remain untracked
  (intentionally not committed with the code).

### What changed
- **A1 review fixes (per bridge 0008/0009):**
  - P2-1: `CalcNode["op"]` gained `"subtract"`; `netCash` derived node now subtracts
    Revenue − Outflow so the audit tree foots. Added a direct footing test.
  - P2-2: `FinanceSummary.lineage` and `CashHealth.lineage` are now **required** (owner-
    confirmed); dropped the `!` assertions in `audit-derive.ts`. New
    `src/finance/audit-fixtures.ts` (`placeholderSummaryLineage` / `placeholderCashHealthLineage`)
    repaired 8 hand-built fixtures.
  - P3-1: direct revenue row-id exactness assertion added.
- **B1 first slice:** `src/ui/lineage-drawer.ts` — pure `renderLineageDrawer(lineage, formatters)`
  producing the drawer body (formula, plain-English, assumptions, direct-rows table OR calc
  tree, excluded list). Escaped, `bw-` classes, DESIGN.md audit-surface semantics.
  Tests in `src/ui/lineage-drawer.test.ts` (5).

### Verification (run this session)
- `npx tsc --noEmit`: clean.
- `npx vitest run`: 52 files, **225 tests** pass.
- `npx vite build`: passes.

### Next-session priorities (B1 remainder — clean seam)
1. **Wire the drawer into `dashboard-cockpit.ts`:** make `bw-kpi` tiles clickable
   (button/role, keyboard + `aria-expanded`), open a non-blocking drawer/panel that renders
   `renderLineageDrawer(audited.lineage[metric], formatters)`. Needs `AuditedCockpit` (from
   `deriveAuditedCockpit`) threaded to the cockpit renderer — today it only gets
   `CockpitViewModel`. Add a `dashboard-cockpit-actions.ts` for the DOM event wiring (mirror
   `dashboard-export-actions.ts`).
2. **CSS:** add `bw-lineage*` styles in `src/styles.css` using DESIGN.md tokens (Panel/Line/Ink,
   8px radius, soft lift; flat readable audit table; motion 180–240ms for the panel reveal).
3. **Tests:** action-layer test for open/close + which metric opens; a render-integration test.
4. Then per cadence: `/code-review` + `codex review`, `/checkpoint`, and B2 (extend drawers to
   outflow/avg burn + polish runway tree).

### Friction logged
- The global `jcodemunch-mcp` PreToolUse Read hook hard-blocks `Read` on code files >~4KB and
  the jCodemunch MCP server wasn't loaded this session, which also blocks harness `Edit`/`Write`
  (they need a prior Read). Worked around via PowerShell edits + `tsc`/`vitest` as the real check.
  Worth fixing so agents can edit large files normally here.

---

## Session addendum — 2026-05-29 (Codex, jCodemunch fixed + B1 wired)

Owner asked Codex to fix the jCodemunch setup first, run an index, then pick up the B1 pen.

### Environment / tooling
- Fixed jCodemunch MCP config drift:
  - `C:\Users\Bilal\.codex\config.toml` now runs `jcodemunch-mcp` directly instead of failing
    `uvx jcodemunch-mcp`.
  - `C:\Users\Bilal\.cursor\mcp.json` now runs `jcodemunch-mcp` directly.
  - `claude mcp add --scope user jcodemunch -- jcodemunch-mcp` added a working Claude Code MCP
    entry; `claude mcp list` reports `jcodemunch` connected.
  - Removed the blocking `PreToolUse: Read` hook from `C:\Users\Bilal\.claude\settings.json`;
    kept lifecycle and post-edit reindex hooks.
- Ran jCodemunch index for `D:\projects\dashboard\v2` via watcher fallback after `init --index`
  hit an upstream wrapper bug (`index_folder() got an unexpected keyword argument 'folder_path'`).
  Index result: 122 files accepted, 934 symbols.

### Git state
- Branch: `codex/a1-audit-model`.
- New commit after this session: B1 cockpit lineage drawer wiring (this handoff update is included).
- Still not pushed or merged to `main`.
- `.agent-bridge/` and `.playwright-mcp/` remain untracked and intentionally outside the code commit.

### What changed
- Threaded `AuditedCockpit` into `renderDashboardResults` via `deriveAuditedCockpit`.
- Updated `renderCockpitStrip` so Revenue, Outflow, Net cash, and Runway KPIs render as real
  buttons with `data-bw-lineage-trigger` and `aria-expanded`.
- Added hidden lineage templates and a non-blocking right-side audit panel using the existing
  `renderLineageDrawer(...)` renderer.
- Added `src/ui/dashboard-cockpit-actions.ts` for click / close / Escape wiring.
- Bound the cockpit actions from `main.ts` after dashboard render.
- Added `bw-lineage*` CSS for the right-side desktop panel and full-screen mobile sheet using
  DESIGN.md tokens and flat audit-table styling.

### Verification
- `npm test`: 53 files, 227 tests passed.
- `npm run build`: passed.
- Browser QA with Vite at `http://127.0.0.1:5176`:
  - Loaded sample CSV → mapping review → Apply Mapping.
  - Revenue KPI opened the audit trail panel with formula, plain-English text, and contributing rows.
  - Escape closed the panel and returned state.
  - Mobile viewport (390px) showed the drawer as a full-screen sheet; Runway lineage was readable.

### Next-session priorities
1. Have Opus review the B1 wiring diff against the master plan §3.6 accessibility/design spec.
2. Tighten focus-trap behavior if review requires it; current implementation moves focus to close
   and supports Escape, but does not trap Tab inside the dialog yet.
3. Begin B2 after review: extend/polish the remaining KPI drawers and runway tree presentation.

---

## Session addendum — 2026-05-29 (Opus, B1 polish: mobile layout + focus-trap)

Owner flagged two items on Codex's wired drawer (`622f7ee`): a jumbled mobile calc-tree
(screenshot) and the outstanding focus-trap. Both fixed in **`f01b8e0`** on `codex/a1-audit-model`.

- **Mobile calc-tree overlap** (`src/styles.css`): `.bw-lineage__node` was a 3-col grid but
  nodes have up to 5 children; the row-count span and nested `<ul>` auto-flowed into the grid
  and collided with the value/label. Fixed by pinning op/label/value to cols 1–3 and forcing
  `.bw-lineage__node-rows` + nested `.bw-lineage__tree` onto their own full-width rows
  (baseline align, label `overflow-wrap: anywhere`).
- **Focus-trap** (`src/ui/dashboard-cockpit-actions.ts`): Tab/Shift+Tab now cycle within the
  open panel (queries focusables; today that's just the close button). Escape-close and
  focus-restore were already present. Unit test added.

Verification: `tsc` clean, **228 tests** pass, `vite build` passes.
**Caveat:** not re-checked in a live mobile browser this session — Playwright isn't installed
locally and the Playwright MCP wasn't loaded. The CSS fix is deterministic grid-column placement;
a visual confirm in the open Chrome tab (Codex Chrome Extension per CLAUDE.md) is still worth doing.

Next: visual confirm on mobile; then B2 (extend drawers to outflow/avg burn, polish runway tree).

---

## Session addendum — 2026-05-29 (Opus, Playwright + B1 mobile confirmed)

Closed the open item from the previous addendum. Owner re-enabled jCodemunch and asked to
fix Playwright; done.

- **Playwright browser QA added** (`4207f26`): `@playwright/test` devDep (chromium already
  cached), `playwright.config.ts` (desktop + Pixel-7 mobile projects, webServer auto-starts
  `npm run dev`), specs in `e2e/` (kept out of vitest's `src/**` glob and the app `tsc` build).
  Scripts: `npm run test:e2e`, `test:e2e:ui`. Artifacts/report gitignored.
- **`e2e/lineage-drawer.spec.ts`**: drives the real flow (load sample -> **Apply Mapping** ->
  open Runway drawer) and asserts every calc-node label/value box does not overlap — a
  regression guard for the f01b8e0 mobile fix. Both viewports green.
- **Mobile fix visually confirmed**: the runway audit drawer now renders cleanly on mobile
  (op · label · right-aligned value, `6 rows` on its own line) — no jumble. B1 layout is done.

How to browser-check going forward: `npm run test:e2e` (auto-starts dev server). Note the app
flow gotcha: a sample doesn't reach the cockpit until **Apply Mapping** is clicked.

Branch `codex/a1-audit-model` tip: `4207f26`. Still not pushed/merged. Next: B2.

---

## Session addendum — 2026-05-29 (Opus, Phase B2 — all KPIs traceable)

Resumed with the B2 pre-flight from memory. **Both tools verified working this
session**: jCodemunch (`resolve_repo` → indexed, 970 symbols / 126 files;
`search_symbols`/`get_symbol_source` callable) and Playwright (`npm run test:e2e`
green, exit 0). Then built **Phase B2** on `codex/a1-audit-model`.

### Decision (owner, this session)
Average burn had full lineage in the model but no UI entry point. Asked how to
surface it → owner chose **Both**: a standalone tile AND an expandable avg-burn
node inside the runway tree.

### Git state
- Branch `codex/a1-audit-model`, one new commit: **`091d823`**
  `feat(ui): Phase B2 — avg-burn KPI tile + expandable runway calc-tree`.
- Built on `2ec77da` (B1 tip). Not pushed; not merged to `main`.
- `.agent-bridge/` and `.playwright-mcp/` remain untracked (outside the commit).

### What changed (TDD, 3 slices)
1. **Avg-burn tile** (`dashboard-cockpit.ts`): fifth metric tile
   `averageMonthlyOutflow` ("Avg burn", meta "per month") inserted before Runway,
   wired as a lineage trigger + template like the others. Grid is now 5 tiles
   base / 6 with the review tile → new `.bw-cockpit--6` track; the orphaned
   `.bw-cockpit--4` rule was removed (code-review finding, no remaining caller).
2. **Expandable calc-tree buckets** (`lineage-drawer.ts`): each monthly outflow
   bucket renders a native `<details>` disclosure that expands to its rows
   (date · head · amount) via new `renderBucketRows`, instead of a dead "N rows"
   count. Covers both the runway tree and the avg-burn drawer (same renderer).
   New `bw-lineage__bucket-*` + `__node-rows-summary` CSS (DESIGN.md tokens, flat
   audit list, ▸/▾ marker).
3. **Focus-trap reach** (`dashboard-cockpit-actions.ts`): `FOCUSABLE_SELECTOR`
   exported + `summary` added so the new disclosures stay keyboard-reachable
   inside the trapped panel.

### Verification
- `npx tsc --noEmit`: clean.
- `npx vitest run`: 54 files, **231 tests** pass (228 → +3: cockpit 6-tile/template,
  bucket-row expansion, `<summary>` focusable via jsdom `.matches()`).
- `npx vite build`: passes.
- `npm run test:e2e`: Playwright desktop + Pixel-7 green (collapsed `<details>`
  keep the runway calc-node no-overlap guard passing).
- `/code-review` (medium): 1 finding (dead `.bw-cockpit--4`) — fixed.
- `codex review --commit 091d823` (codex-cli 0.125.0, high reasoning): **GATE PASS**,
  0 actionable findings. (Note: codex `review` rejects a positional prompt alongside
  `--commit`/`--base`, so the filesystem-boundary prompt was dropped; codex stayed on
  the repo diff anyway.)

### Exit criterion met
Every cockpit KPI (Revenue, Outflow, Net cash, Avg burn, Runway) is now clickable
and traceable. **Phase B (surface the math) is complete.**

### Next-session priorities
1. ~~`codex review` on `091d823`~~ — **done this session**: GATE PASS, 0 findings
   (codex-cli 0.125.0, high reasoning). Both review passes complete for B2. (Bridge
   `0015` had Codex holding on B2; that gate is now cleared.)
2. Visual confirm in a live browser that the avg-burn tile + expandable buckets
   read well on desktop and mobile (the 6-tile row is tighter; e2e only guards
   overlap, not aesthetics).
3. **Phase C1** (master plan): "Needs review" badge → review drawer with
   include/exclude toggles that re-derive KPIs live (the "Needs review" tile is
   already a non-clickable placeholder div, ready to wire). Reuse
   `import-review.ts` patterns; KPIs never blocked.

---

## Session addendum — 2026-05-29 (Codex, Agent Room inaugural test + Phase C1)

Owner used the new Agent Room dashboard as a live coordination test. Codex opened the room at
`http://127.0.0.1:8787`, registered `codex-desktop`, Claude replied in-message, and the shared
MCP was wired globally via direct Node commands for Claude, Cursor, and Codex config:
`node D:\projects\agent-room-mcp\dist\server.js --room D:\projects\.agent-room`.

### Git state
- Branch `codex/a1-audit-model`.
- New commit from this session: Phase C1 review drawer + in-session KPI re-derive.
- Still not pushed or merged to `main`.
- `.agent-bridge/` and `.playwright-mcp/` remain untracked (intentionally outside code commits).

### What changed
- The "Needs review" cockpit tile is now a real button (`data-bw-review-trigger`) that opens the
  existing non-blocking right-side drawer shell as a **Review queue**.
- Added `src/ui/review-drawer.ts` and `src/ui/review-queue.ts`:
  - Conservative "Review suggested" wording for duplicate, transfer, and rejected-row items.
  - Include/exclude toggles for actionable row-backed items.
  - Warm empty state: "Nothing to review — your numbers look clean."
  - `aria-live` update text for re-derived runway.
- Added in-session review exclusions:
  - `buildDashboardView(...)` accepts `excludedTransactionIds`.
  - Excluding a transfer removes both the matched outflow + revenue row from KPI math.
  - Excluding a duplicate group removes all but the first matching row.
  - Toggling re-renders immediately through the existing `deriveAuditedCockpit` path.
- Reused the Phase B drawer wiring/focus trap; review toggles remain keyboard-reachable.
- Added `bw-review*` CSS using DESIGN.md-style flat audit surfaces, coral review chips, and
  44px touch-target toggles.

### Verification
- TDD red run confirmed missing review drawer, review action wiring, and exclusion derivation.
- `npm test`: 56 files, **241 tests** pass.
- `npm run build`: passes.
- `npm run test:e2e`: Playwright desktop + mobile lineage guards pass.
- Browser smoke at `http://127.0.0.1:5173`: loaded sample CSV, applied mapping, opened
  "Needs review" drawer; review queue rendered in the shared panel and kept cockpit visible.
- Codex review on first C1 commit found one P2: excluded duplicate/transfer items disappeared
  from the drawer, preventing "Include in KPIs". Fixed by keeping review-queue diagnostics
  anchored to the pre-exclusion filtered records while KPI math uses included rows.
- Codex review on the amended C1 commit found a P2 (excluded rows not represented in KPI
  lineage) and P3 (review tile count/meta mismatch after partial exclusions). Fixed both:
  excluded review rows now populate the relevant `lineage.*.excluded` arrays, and the review
  tile value + meta are derived from the same review item set.
- Final Codex review pass found one rejected-row grouping edge case: multiple rejected rows
  collapsed into one drawer item but the tile still displayed raw row count. Fixed by counting
  review queue items whenever the drawer has an itemized queue.
- Follow-up Codex review found Reviewer JSON export still rebuilt from original records after
  review exclusions. Fixed by threading the reviewed record set into the reviewer export path.
- Follow-up Codex review found overlapping review items could drop row exclusions when one
  item was included while another still excluded the same row. Fixed by tracking active
  decisions by review item id and deriving excluded transaction ids as a union.
- Follow-up Codex review found saved review exclusions could be lost after changing filters.
  Fixed by deriving excluded transaction ids from the full import review queue, independent of
  the currently visible filtered queue.

### Next-session priorities
1. Run review gates for C1 (`/code-review` + `codex review`) and address findings.
2. Live-browser check with a dataset containing transfer/duplicate candidates to exercise the
   toggle path visually, not only by unit tests.
3. If C1 review passes, continue to C2 focused category review.
