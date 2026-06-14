# Billu.Works Finance Dashboard V2 Roadmap

Last updated: 2026-05-23

## Why V2 Exists

V1 proved the useful core: local CSV analysis, CFO-style KPIs, runway, forecast, data quality, and accountant-review thinking.

V2 is where we turn that into a broader Billu.Works tool for small and solo professionals without losing the privacy-first stance.

## Positioning

Private finance tools for small operators who want answers from their CSV/Excel exports without uploading their business data into an AI product.

## Must Preserve From V1

- local-first processing
- current finance dashboard usefulness
- no-AI-by-default workflow
- cash runway and 13-week forecast
- data-quality warnings
- visible privacy language
- export/reviewer support
- tests before confident UI claims

## Reference Ideas To Blend

From `Sagargupta16/Financial-Dashboard`, adapt concepts rather than code:

- Excel import
- running balance
- account balance view
- transfer tracking
- category and subcategory drilldowns
- formula documentation
- chart exports
- stronger import validation
- cleaner feature organization

## Phase 1: Foundation

- Choose app stack.
- Add project scripts and test runner.
- Create finance domain types or schemas.
- Add formula documentation.
- Port only the minimum proven V1 parsing/calculation modules.

Exit: sample CSV can become tested transaction records.

## Phase 2: Core Dashboard

- KPI strip.
- trend by period.
- top categories/heads.
- transaction table.
- data-quality panel.
- visible privacy statement.

Exit: solo pro can upload a sample CSV and understand income, outflow, and net cash.

## Phase 3: Cash Intelligence

- monthly burn/runway.
- 13-week forecast.
- manual future cash events.
- large one-time transaction detection.
- concentration warnings.

Exit: small business/founder mode is credible.

## Phase 4: Import Power

- Excel import. (initial `.xlsx` import added)
- optional account/bank fields.
- optional vendor/customer fields.
- optional subcategory fields.
- duplicate and transfer detection.

Exit: real-world exports need less manual cleanup.

## Phase 5: Billu.Works Packaging

- public tool route framing.
- sample datasets for freelancer, agency, and founder modes. (initial CSV samples added)
- help pages and formula pages. (in-app formula reference added)
- exportable summaries and chart data. (visible monthly trend CSV added)

Exit: ready to publish as a free Billu.Works utility.

## Product Stack: Next Frontend And Product Priorities

These are now part of the working stack and should be layered in while backend hardening continues.

### Immediate UX Priorities

- First-run onboarding state.
  - Let users feel the dashboard before they understand every control.
  - Prefer a loaded sample/demo path or a rich pre-import state with clear `Load Sample`, `Load Excel Demo`, and `Load your own file` actions.
- KPI cockpit treatment.
  - Revenue, outflow, net cash, average burn, and runway should feel like the first instrument panel.
  - The math already exists; the missing piece is emotional hierarchy and first-viewport impact.
- Founder runway emphasis.
  - Cash runway should be prominent enough that a founder sees it without hunting.
  - Keep the calculation client-side and auditable.
- README/product story refresh.
  - README is behind the actual app. Update it so finished features are not mistaken for gaps.

### Product Expansion Candidates

- Budget vs Actual.
  - Start with manual monthly/category budgets compared against imported actuals.
  - This is the strongest next expansion after the finance cockpit feels excellent.
- Invoices / Receivables.
  - Useful, but larger scope. Treat it as a later module rather than bolting on a second admin dashboard.
- One dashboard, wider scope.
  - Prefer one coherent small-business financial cockpit over two half-products stapled together.
  - Suggested information architecture: Overview, P&L, Runway, Transactions.

### Export / Sharing

- Keep improving the print report.
- Consider a true one-click PDF export later if browser print is not enough for accountants/investors.

### Visual Direction Note

- Explore a Bloomberg-terminal level of information density and cockpit confidence, but keep Billu.Works small-business readable.
- Do not sacrifice import review, audit legibility, or calm trust for visual intensity.
- `DESIGN.md` remains the source of truth: soft financial cockpit, sage/cream base, tactile controls, clear audit surfaces.

## Phase 6: Traffic And Monetization

- SEO pages for cash flow dashboard, runway calculator, burn rate calculator, and bank CSV analyzer.
- Keep ads on guide pages first.
- Keep the dashboard workspace clean and trustworthy.
- Consider affiliates and pro exports only after usage proves demand.

## Hard No For Early V2

- no server-side transaction storage
- no bank integrations
- no AI as the hero feature
- no generic financial advice cards
- no ad clutter in the upload/dashboard flow
