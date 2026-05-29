# TODOS — Billu.Works Finance Dashboard V2

Deferred work captured during the 2026-05-29 CEO review (SCOPE EXPANSION).
See `docs/designs/AUDITABLE_COCKPIT_V2.md` for the accepted-scope plan.

## P1 — Budget vs Actual (next cycle)

- **What:** Manual monthly/per-category budgets compared against imported actuals, shown as
  a first-class cockpit lens (one of Overview / P&L / Runway / Transactions).
- **Why:** Turns the tool from "here's what happened" into "here's whether you're on track"
  — the question solo operators actually lose sleep over. Roadmap calls it "the strongest
  next expansion."
- **Pros:** High product value; differentiates from pure statement analyzers.
- **Cons:** Larger surface; only credible once users trust the actuals (depends on the
  auditability + anomaly work shipping first).
- **Context:** Roadmap "Product Expansion Candidates"; client-side only, manual budget entry.
- **Effort:** L (human ~1.5 wk) → CC ~45 min.
- **Depends on:** Show-the-math auditability layer + anomaly pre-flight (current cycle).

## P2 — Expected-income forecast tagging (FORECAST INPUT ONLY)

- **What:** Let users tag expected future income (due date, amount, optional label) as
  manual cash events so runway/forecast reflect the earned-vs-received timing gap.
- **Why:** Addresses the freelancer Net-30 pain as a forecast input, without building an
  invoicing product.
- **Scope guard:** This is NOT invoicing and NOT receivables management. No client records,
  no invoice creation/sending, no storage of third-party data. Owner decision 2026-05-29:
  invoicing is OUT (privacy hard-rule + Payoneer/Wise already own it). Keep this item purely
  as a forecast input or it drifts back into the rejected territory.
- **Pros:** Reuses the existing manual-future-cash-events forecast primitive; stays local.
- **Cons:** Serves the freelancer persona most; lower priority than budget-vs-actual.
- **Effort:** S-M (human ~3-5 days) → CC ~20-30 min.
- **Depends on:** none hard; best after the cockpit trust core feels excellent.
