# Data Analytics Plugin Study

Date: 2026-06-14

Source studied: official OpenAI template checkout at `.reference/role-specific-plugins/plugins/data-analytics`.

## What The Template Actually Contains

The Data Analytics plugin is not just a charting package. It is a workflow system for analytical trust:

- `design-kpis`: turns a business question into a small KPI framework with outcome metrics, drivers, guardrails, targets, definitions, caveats, and measurement plans.
- `kpi-reporting`: turns known KPIs into leadership-ready operating readouts with actuals, comparison periods, targets, driver context, caveats, and next actions.
- `metric-diagnostics`: explains why a metric changed by reproducing the metric, choosing a comparison, decomposing movement, and separating verified drivers from hypotheses.
- `build-dashboard`: defines dashboard purpose, source paths, metric model, layout, filters, chart choices, QA, and handoff.
- `visualize-data`: chooses chart forms from the analytical question, writes a chart contract, and requires final-context QA.
- `validate-data` and `analyze-data-quality`: review methodology, source quality, calculation logic, chart integrity, caveats, and confidence before sharing.
- `user-context`: saves reusable source-of-truth context, semantic-layer details, onboarding state, and source category mappings.
- `src/analytics-app`: a React/Recharts artifact app with typed dashboard manifests, chart specs, KPI cards, tables, sources, filters, and export helpers.

The enterprise connectors in `.app.json` target tools like warehouses, BI systems, product analytics, docs, chat, email, and notebooks. Those are less relevant for our local-first finance app, but the workflow rules are very relevant.

## Strong Ideas To Borrow

### 1. Metric Contracts

The plugin treats every KPI as a contract, not just a number. For Billu.Works, each KPI should carry:

- label
- calculation/formula
- source rows
- time window
- filters applied
- comparison basis, when available
- source freshness/as-of date
- assumptions
- exclusions
- caveats
- confidence/readiness status

Current overlap: `src/finance/audit.ts`, `src/finance/summary.ts`, `src/finance/cash-health.ts`, and the lineage drawer already contain the first version of this.

Recommended next step: evolve `MetricLineage` into a broader `MetricContract` while preserving the existing audit drawer behavior.

### 2. KPI Roles

The template separates metrics by role:

- primary KPI: the thing the user should monitor first
- driver metrics: the numbers that explain movement
- guardrail metrics: the numbers that prevent misleading optimism
- detail metrics: lookup and audit surfaces

For our dashboard:

- Primary: Net Cash, Runway
- Drivers: Revenue, Outflow, Average Monthly Burn, Top Heads/Subcategories
- Guardrails: Needs Review, Rejected Rows, Possible Duplicates, Possible Transfers, Revenue Concentration, Non-operating Total
- Detail: Transaction Preview, Raw Row, Import Quality

Recommended next step: add a small typed registry that assigns each dashboard metric a role and intended decision.

### 3. Dashboard Manifest

The plugin's `DashboardManifest` is a portable description of an analytical surface:

- datasets
- filters
- cards
- charts
- tables
- sources
- blocks

This could be very useful for Billu.Works exports. Today we render HTML directly from view state. A manifest would let us export the dashboard definition, generate reports, support alternate layouts, and test dashboard composition without scraping HTML.

Recommended next step: create a local `FinanceDashboardManifest` derived from `DashboardViewData`, starting with cards, tables, sources, and filters. Charts can follow later.

### 4. Chart Contracts Before Charts

The plugin requires chart specs to explain:

- analytical question
- takeaway
- chart type
- dataset
- encodings
- units
- comparison context
- fallback/empty state
- source metadata

Our current trend chart is compact and useful, but it is not represented as a source-backed chart contract. We should avoid jumping straight to a chart library until we have chart specs that encode meaning.

Recommended next step: define `ChartSpec` for `cashTrend`, `topHeads`, `subcategories`, and `forecast` before introducing a new renderer.

### 5. Validation As Product UX

The plugin makes validation part of the product, not a back-office checklist. It asks whether numbers reconcile, whether comparisons are fair, whether data freshness is known, whether caveats are visible, and whether the conclusion is supported.

Billu.Works already has import warnings, duplicates, transfer checks, category review, non-operating exclusions, and KPI audit trails. This can become a stronger "Trust Center" or "Readiness" layer.

Recommended next step: add a `DashboardReadiness` model that summarizes whether the dashboard is ready, partial, or blocked, with reasons and next actions.

### 6. Metric Diagnostics

The diagnostic workflow is perfect for a finance cockpit. When a KPI changes, the app should help answer "why":

- Is the movement broad or concentrated?
- Which head/subcategory/counterparty/account contributed most?
- Is it caused by one large transaction?
- Did the denominator/time window change?
- Did filters or exclusions change the interpretation?
- Are duplicates/transfers/rejected rows affecting trust?

Recommended next step: implement a deterministic local diagnostic for Net Cash and Burn: contribution by head, subcategory, account, counterparty, and largest transactions.

## What To Skip Or Defer

- Enterprise connectors: Snowflake, Databricks, BigQuery, Hex, Tableau, Slack, docs, and email are not needed for the current local-first app.
- MCP artifact widgets: interesting, but too much surface area until our dashboard data model is more formal.
- Recharts/React migration: useful later, but the current app is TypeScript plus HTML renderers. Introduce typed chart contracts first.
- Notebook workflows: not relevant unless we add advanced analyst exports.
- Full semantic-layer onboarding: useful conceptually, but our first version can be a local metric registry and import profile.

## Proposed Implementation Slices

### Slice 1: Metric Registry And Contracts

Create a local metric registry for finance KPIs.

Likely files:

- `src/finance/metric-contract.ts`
- `src/finance/metric-registry.ts`
- tests beside both files

Shape:

- metric id
- display label
- role: primary, driver, guardrail, detail
- decision question
- formula text
- unit/format
- required inputs
- caveats

Then adapt the lineage drawer to display richer contract context.

### Slice 2: Dashboard Readiness

Create a readiness model that rolls up:

- rejected row count
- duplicate group count
- transfer candidate count
- unassigned category/head count
- missing cash-on-hand/runway status
- non-operating exclusions
- category review suggestions

Render it as a compact trust/readiness widget near the cockpit.

### Slice 3: Local Metric Diagnostics

Add a deterministic diagnostics engine for KPI movement and concentration.

Initial outputs:

- top positive and negative contributors to Net Cash
- burn contributors by head/subcategory
- revenue concentration by head/counterparty
- largest transaction influence
- filter/exclusion impact summary

### Slice 4: Dashboard Manifest Export

Generate a `FinanceDashboardManifest` from `DashboardViewData`.

Use it for:

- JSON export
- print/report generation
- future chart rendering
- regression tests against dashboard composition

### Slice 5: Chart Specs

Define chart specs for existing visuals before adopting a chart library.

Initial specs:

- cash trend
- 13-week forecast
- top heads
- top subcategories
- account balances

Then decide whether to keep lightweight HTML/CSS bars or add a chart renderer.

## Best First Move

Start with Slice 1 and Slice 2.

Reason: the app already has strong import review, cockpit KPIs, and lineage. Metric contracts plus readiness will deepen trust without forcing a visual rewrite or dependency jump. Once the metric model is explicit, diagnostics and chart manifests become much cleaner.

