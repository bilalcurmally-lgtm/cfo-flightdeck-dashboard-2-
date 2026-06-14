# TODOS - Billu.Works Finance Dashboard V2

Last updated: 2026-06-14

This is the unified working backlog. It reconciles the original roadmap, the auditable
cash cockpit master plan, the latest D2 handoff, and the Data Analytics plugin study in
`docs/data-analytics-plugin-study.md`.

## Current Product Thesis

Build a local-first cash cockpit that a small operator can re-import into every week and
trust: every number shows its work, review decisions persist, changes across imports are
visible, and accountant handoff is traceable. The Data Analytics plugin study reinforces
the same direction: metric contracts, KPI roles, validation, readiness, diagnostics, and
portable dashboard manifests matter more than decorative charts.

## P0 - D2 Import History Browser

Status: complete on branch `codex/a1-audit-model`.

Shipped:

- WorkspaceSnapshot v2 + import history migration.
- Pure import-history diff logic.
- Import capture wiring in `main.ts`.
- Welcome-back strip renderer.
- Welcome-back strip wiring and dismiss behavior.
- Import history panel renderer and styles.
- History button and panel wiring.
- E2E coverage for welcome-back strip plus history panel.

Exit: re-importing a known ledger shows the welcome-back strip, and the user can open a
History panel listing prior imports.

Verification on 2026-06-14:

- `npx tsc --noEmit`
- `npx vitest run` - 360 passed
- `npx playwright test --workers=1` - 12 passed
- `npm run build`

## P0 - Land Or PR The Current Branch

Once D2 is finished, decide whether to stop stacking and open a PR for
`codex/a1-audit-model`.

Include in the PR:

- C1/C2 trust/review work.
- D1 persistence/project-file workflow.
- D2 import history and welcome-back/history surfaces.
- Updated docs and handoff notes.

Before PR:

- Confirm branch is pushed.
- Confirm no unrelated untracked files are staged; `mcps/` is pre-existing and should stay
  untouched unless explicitly needed.
- Run the full verification gate above.

## P1 - D3 Saved Rules And Auto-Apply Review Queue

Source: `docs/designs/MASTER_PLAN_AUDITABLE_COCKPIT.md`.

Status: saved-rules and carry-forward slice shipped on 2026-06-14.

Shipped:

- Pure classification rule engine:
  - fields: account, counterparty, description, head, subcategory
  - match: case-insensitive "contains"
  - action: `ClassificationOverride`
  - disabled and blank rules ignored
  - later matching rules can refine earlier matches
- Workspace snapshot v3 with `rules: ClassificationRule[]`.
- `.billu.json` project-file migration from v1/v2 to v3 with `rules: []`.
- Project-file validation for rule field, enabled flag, match text, and override shape.
- IndexedDB write-through persistence for rules.
- Import activation applies saved rules first, then signature-specific overrides win.
- Category review rows with an active recategorization now show `Remember rule`.
- `Remember rule` saves a counterparty-based reusable rule when possible, falling back to
  description.
- E2E coverage confirms recategorize -> remember rule shows a user-facing saved-rule status.
- Local Settings now lists saved rules.
- Saved rules can be enabled, disabled, or deleted from the dashboard.
- E2E coverage confirms saved-rule management works after creating a rule.
- Added `public/sample-owner-next.csv` as a distinct matching import fixture.
- E2E coverage confirms create rule -> distinct matching import -> rule applies automatically,
  independent of signature-specific override persistence.
- Rule matches now expose an import-level signal: row count and saved-rule count applied.
- Saved-rule changes re-activate the current import so disabling/deleting a rule updates the
  current classifications immediately.
- Rule-applied category rows are treated as handled review work instead of carrying forward
  as unresolved category-review rows.
- `Looks right` category confirmations persist by stable transaction signature and carry
  forward across re-imports.
- E2E coverage confirms confirmed category rows do not return as unresolved review work.

What:

- Add saved classification rules, for example "counterparty contains Stripe -> Revenue".
- Auto-apply rules during import.
- Carry only genuinely unresolved review items forward.
- Keep all rules local and exportable in `.billu.json`.

Remaining:

- Decide rule learning copy: "Remember rule" vs "Remember for future imports".
- Decide whether rule-applied rows need a drilldown/audit drawer beyond the compact import
  signal and Local Settings controls.

Verification on 2026-06-14:

- `npx tsc --noEmit`
- `npx vitest run` - 377 passed
- `npx playwright test --workers=1` - 16 passed
- `npm run build`

Why:

- D1 persistence remembers decisions.
- D2 history shows change over time.
- D3 turns the dashboard into a repeat workflow instead of a one-off analyzer.

Analytics-plugin alignment:

- This is our lightweight local version of a semantic layer: reusable source-of-truth rules
  and metric context without enterprise connectors.

## P1 - Metric Contracts Registry

Source: `docs/data-analytics-plugin-study.md`.

Status: foundation shipped on 2026-06-14.

Shipped:

- `src/finance/metric-contract.ts`: `MetricContract` type (id, label, role, decision
  question, formula, format, required inputs, caveats, readiness), `MetricRole` /
  `MetricFormat` unions, `isMetricRole`, and `validateMetricContract` structural check.
- `src/finance/metric-registry.ts`: seeded contracts for the core cockpit metrics
  (netCash, runwayMonths, revenue, outflow, averageMonthlyOutflow,
  revenueConcentration, rejectedRows, duplicates, transfers) with `getMetricContract`
  and `getMetricsByRole` lookups. Ids align with `CockpitViewModel` / cash-health
  fields so values can be joined later.
- Tests beside both files (15 cases): role map, unique ids, structural validity.

Remaining:

- Extend the registry to detail-role metrics (Top Heads/Subcategories, Transaction
  Preview, Raw Row, Import Quality) once those become first-class scalars.
- Feed contracts into the readiness/trust center below.

Wired (2026-06-14):

- The per-KPI lineage drawer now surfaces the contract's decision question (above the
  formula) and a "Good to know" caveats section (below the audit trail), via
  `getMetricContract(metric)` in `src/ui/lineage-drawer.ts`. Verified in-browser on
  desktop + mobile (computed tokens match DESIGN.md; clean wrap at 375px).

What:

- Create a typed registry for finance KPIs.
- Each metric should define:
  - id
  - label
  - role: primary, driver, guardrail, or detail
  - decision question
  - formula
  - unit/format
  - required inputs
  - caveats
  - source/readiness expectations

Likely files:

- `src/finance/metric-contract.ts`
- `src/finance/metric-registry.ts`
- tests beside both files

Why:

- Existing lineage tells us how numbers were computed.
- Metric contracts tell us what the numbers mean, why they exist, and how they should be
  used in the cockpit.

Initial role map:

- Primary: Net Cash, Runway.
- Drivers: Revenue, Outflow, Average Monthly Burn, Top Heads/Subcategories.
- Guardrails: Needs Review, Rejected Rows, Duplicates, Transfers, Revenue Concentration,
  Non-operating Total, Category Review.
- Detail: Transaction Preview, Raw Row, Import Quality.

## P1 - Dashboard Readiness / Trust Center

Source: Data Analytics plugin `validate-data` and `analyze-data-quality` workflows.

Status: shipped on 2026-06-14.

Shipped:

- `src/finance/readiness.ts`: pure `assessReadiness(input)` model. Folds rejected rows,
  duplicates, transfers, category review, unassigned heads/counterparties, missing
  cash-on-hand, non-operating, and import-history availability into one
  `{ status, headline, signals }`. Severity model: blocker -> needs-review, caution ->
  partial, info never downgrades; empty when no transactions.
- `src/ui/readiness-panel.ts`: pure widget + drawer renderers.
- Wired through `CockpitExtras` into the cockpit strip and the existing lineage-panel
  drawer infra (`dashboard-cockpit.ts`, `dashboard-cockpit-actions.ts`,
  `dashboard-results.ts`, `main.ts`). Compact trust widget above the cockpit; click opens
  a detail drawer. Non-blocking (hidden when empty). Status accents per DESIGN.md
  (olive/accent/coral). 16 tests + e2e; browser-verified desktop + mobile.

Remaining:

- Local metric diagnostics ("why did runway change?") below can build on this.

What:

- Add a readiness model that summarizes whether the current dashboard is ready, partial, or
  needs review.
- Inputs:
  - rejected rows
  - duplicate groups
  - transfer candidates
  - unassigned heads/subcategories/counterparties
  - missing cash-on-hand for runway
  - non-operating exclusions
  - category review suggestions
  - import history availability

Why:

- The cockpit already has many trust signals, but they are scattered.
- A compact readiness layer would make "can I trust this dashboard?" answerable at a glance.

Suggested UI:

- Compact trust/readiness widget near the cockpit.
- Click opens a focused audit/readiness drawer.
- Avoid blocking KPI render; keep the current non-blocking trust pattern.

## P1 - Local Metric Diagnostics

Source: Data Analytics plugin `metric-diagnostics`.

Status: first diagnostics family slices shipped on 2026-06-14.

Shipped:

- `src/finance/metric-diagnostics.ts`: pure `explainRunwayChange(prev, curr, formatters)`
  → `{ direction, headline, drivers }`. Decomposes a runway delta into cash-on-hand and
  monthly-burn drivers via an exact counterfactual split (parts sum to the whole), names the
  dominant driver, and handles unavailable-runway / no-comparable-baseline cases.
- `ImportSnapshot.kpiSnapshot` now also captures `cashOnHand` + `averageMonthlyOutflow`
  (open Record, backward compatible; legacy baselines degrade to no drivers).
- Welcome-back strip renders a "why" sub-line under the delta summary when cash/burn drivers
  are available. 12 tests; browser-verified layout.
- Net-cash contributors (`topNetCashContributors`): the per-KPI net-cash audit drawer now
  shows the biggest inflows and outflows behind the number (grouped by head, sorted by
  magnitude), via `src/ui/net-cash-contributors.ts`. 13 tests + e2e.
- Burn contributors (`topBurnContributors`): the average-burn audit drawer now shows the
  biggest outflow drivers by head and by head/subcategory, including share of total burn,
  via `src/ui/burn-contributors.ts`. Covered by model tests, renderer tests, cockpit wiring
  tests, and desktop/mobile e2e.
- Revenue concentration (`revenueConcentration`): the revenue audit drawer now shows top
  revenue sources by head and counterparty, including share of total revenue, via
  `src/ui/revenue-concentration.ts`.
- Readiness now receives `cashHealth.revenueConcentration` and flags concentrated revenue
  at the existing 75% caution threshold.
- Largest-transaction influence (`largestTransactionInfluence`): the net-cash audit drawer
  now calls out the single largest row, its share of gross activity, and its signed net-cash
  impact via `src/ui/largest-transaction-influence.ts`.
- Filter/exclusion impact (`filterExclusionImpact`): the net-cash audit drawer now shows
  how the current review preset, non-operating exclusions, and review decisions changed
  revenue, outflow, net cash, and visible row count via `src/ui/filter-exclusion-impact.ts`.

Remaining:

- The initial diagnostics family from the Data Analytics plugin study is complete. Future
  diagnostics should be driven by concrete user/accountant questions.

Verification after burn contributors on 2026-06-14:

- `npx tsc --noEmit`
- `npx vitest run` - 435 passed
- `npx playwright test --workers=1` - 22 passed
- `npm run build`

Verification after revenue concentration on 2026-06-14:

- `npx tsc --noEmit`
- `npx vitest run` - 444 passed
- `npx playwright test --workers=1` - 24 passed
- `npm run build`

Verification after filter/exclusion impact on 2026-06-14:

- `npx tsc --noEmit`
- `npx vitest run` - 457 passed
- `npx playwright test --workers=1` - 24 passed
- `npm run build`

Verification after largest-transaction influence on 2026-06-14:

- `npx tsc --noEmit`
- `npx vitest run` - 451 passed
- `npx playwright test --workers=1` - 24 passed
- `npm run build`

What:

- Add deterministic local explanations for why cash metrics changed or look risky.
- Initial diagnostics:
  - top positive and negative contributors to Net Cash
  - burn contributors by head/subcategory
  - revenue concentration by head/counterparty
  - largest transaction influence
  - filter and exclusion impact summary
  - comparison against previous import when D2 history exists

Why:

- This turns "what changed?" into "why did it change?" without AI, server storage, or
  external analytics connectors.

Good first target:

- "Why did runway change?" explainer using import history, cash-on-hand, burn, exclusions,
  and top outflow contributors.

## P2 - Accountant Workbook Export V1

Source: master plan Phase E.

What:

- Extend export to a multi-sheet workbook:
  - KPI audit: values, formulas, assumptions, caveats.
  - Normalized ledger: included rows.
  - Exclusions/review: excluded rows and reasons.
  - Rejected/import quality rows if feasible in V1.

Why:

- Completes the auditability loop: the accountant can tie every cockpit number to ledger
  rows and review decisions.

Depends on:

- Stable metric lineage/contracts.
- Current review/exclusion model.

## P2 - Dashboard Manifest Export

Source: Data Analytics plugin `DashboardManifest`.

What:

- Generate a local `FinanceDashboardManifest` from `DashboardViewData`.
- Include:
  - datasets
  - filters
  - KPI cards
  - charts/specs
  - tables
  - source metadata
  - readiness/caveats

Why:

- Gives us a portable dashboard definition for JSON export, print reports, future charts,
  testing, and possible plugin-like artifacts.
- Lets us test dashboard composition without scraping rendered HTML.

Do before:

- Any major chart-library migration.

## P2 - Chart Specs Before Chart Library

Source: Data Analytics plugin `visualize-data`.

What:

- Define chart specs for existing visuals before adding heavier rendering.
- Initial specs:
  - cash trend
  - 13-week forecast
  - top heads
  - top subcategories
  - account balances

Why:

- Chart choice should follow the analytical question, not the other way around.
- Existing CSS bars are fine until specs prove a richer chart renderer is worth it.

## P2 - Forecast / Runway Confidence Mechanics

Source: master plan Phase F and Data Analytics validation standards.

What:

- Compute confidence from mechanical factors:
  - data coverage months
  - income volatility
  - expense volatility
  - unresolved review items
  - dependence on manual future events
- Surface the main reason in plain English.

Why:

- "7.2 months runway" is stronger when the app can say whether that number is high,
  medium, or low confidence and why.

## P2 - README / Positioning Refresh

Source: roadmap and master plan Phase F.

What:

- Refresh README and in-app copy once the trust workflow is true in shipped behavior.
- Lead with auditable cash truth and repeat re-import workflow.
- Keep privacy as a supporting trust promise, not the whole positioning.

Do after:

- D2 complete.
- D3 at least planned or partially shipped.
- Metric/readiness language is stable.

## P3 - Budget Vs Actual

Source: original TODO P1.

What:

- Manual monthly/per-category budgets compared against imported actuals.
- First-class cockpit lens, likely within Overview / P&L / Runway / Transactions.

Why:

- Moves the tool from "what happened?" to "are we on track?"

Depends on:

- Actuals must be trusted first: auditability, persistence, review workflow, and readiness
  should feel solid before adding plan/budget semantics.

## P3 - Expected-Income Forecast Tagging

Source: original TODO P2.

What:

- Let users tag expected future income with due date, amount, and optional label as manual
  forecast events.

Scope guard:

- Forecast input only.
- Not invoicing.
- Not receivables management.
- No client records, invoice creation/sending, or third-party data storage.

Why:

- Helps freelancer Net-30 timing without turning the product into an invoicing app.

## Explicitly Out Of Scope

- Admin panel.
- Invoice creation/sending.
- Full receivables module.
- Bank integrations.
- Server-side transaction storage.
- Multi-user hosted SaaS backend.
- AI as the hero workflow.
- Enterprise analytics connectors from the Data Analytics plugin template.
