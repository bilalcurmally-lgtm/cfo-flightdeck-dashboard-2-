# Master Plan: The Auditable Cash Cockpit (A→Z)

Generated 2026-05-29 from `/plan-ceo-review` (SCOPE EXPANSION) + codex (gpt-5.5) outside-voice + grounded eng review.
Branch: main | Repo: Billu.Works Finance Dashboard V2
Companion strategy doc: `docs/designs/AUDITABLE_COCKPIT_V2.md`

This is the execution plan for a workhorse implementation agent. Each session is a coherent,
shippable, testable unit with a review gate. Reviews are run by Claude (`/code-review` or
`/review`) and codex (`codex review` / `codex challenge`) after each session, with a
checkpoint after each phase.

---

## 1. North Star

A **local-first cash cockpit you re-import into every week and trust** — every number shows
its work, the tool catches its own distortions, it remembers your decisions across imports,
and it exports a workbook your accountant can trace. No account, no server, no upload.

Two things make it durable (the codex correction): auditability earns the first conversion;
the **workflow** (persistent local workspace + "what changed since last import" + saved rules
+ review queue) earns the return. The product is the workflow, not the popover.

## 2. What changed after review (decision log)

- **Auditability is a feature, the workflow is the moat.** Added a persistent local workspace
  layer (full version): import history, review queue, saved classification rules.
- **Anomaly UX is non-blocking.** KPIs render instantly with a "N need review" badge; the
  3-second runway moment is preserved. No gate before render.
- **Focused category review** for high-distortion categories only (transfers, owner draws,
  taxes, refunds, reimbursements, loan proceeds). Not a full categorization UI.
- **Build the model before the story.** Audit data model + one KPI end-to-end first;
  positioning copy ships LAST, only once the claim is provably true.
- **Lineage is typed, not flat.** `direct` / `derived (calc tree)` / `assumption` /
  `excluded`. Runway is a tree, not a row list. Plain-English sentences always carry their
  assumptions.
- **Out (owner decisions):** admin panel, invoice creation/sending, full receivables,
  multi-user/server. Expected-income tagging stays a deferred forecast-input only.
- **Tests are scope.** Golden-file regression tests gate every "auditable" claim.

---

## 3. Architecture Lock (eng review)

### 3.1 The audit data model

Every KPI carries provenance. New types live in `src/finance/audit.ts`.

```ts
type LineageKind = "direct" | "derived" | "assumption" | "excluded";

interface RowRef {            // points at a real TransactionRecord.id
  id: string;
  dateISO: string;
  amount: number;
  head: string;
  flow: CashFlow;
}

interface Assumption {        // non-row inputs (e.g. cashOnHand, burn window)
  label: string;             // "Cash on hand"
  value: number | string;
  source: string;            // "running balance, last row" | "user-entered" | "period: last 3 months"
}

interface CalcNode {          // the calculation tree (runway, burn)
  label: string;             // "Average monthly outflow"
  value: number;
  op: "sum" | "avg" | "divide" | "count" | "identity";
  rows?: RowRef[];           // leaf contributions
  children?: CalcNode[];     // sub-calculations
}

interface ExclusionRef {
  id: string;                // TransactionRecord.id
  reason: string;            // "suspected duplicate" | "transfer counted as income" | "one-time spike" | "user excluded"
  confidence: "high" | "medium" | "low";  // conservative; drives "review suggested" wording
}

interface MetricLineage {
  metric: "revenue" | "outflow" | "netCash" | "averageMonthlyOutflow" | "runwayMonths";
  value: number | null;
  formulaText: string;       // "Runway = cash on hand / avg monthly outflow"
  plainEnglish: string;      // sentence INCLUDING assumptions + period + confidence
  direct: RowRef[];          // empty for purely-derived metrics
  derived?: CalcNode;        // present for runway / burn
  assumptions: Assumption[];
  excluded: ExclusionRef[];
  confidence?: ConfidenceModel; // see 3.4 (forecast/runway only)
}

interface AuditedCockpit extends CockpitViewModel {
  lineage: Record<MetricLineage["metric"], MetricLineage>;
}
```

### 3.2 The re-derivation engine

A single pure function is the spine of items 2, 3, and the workflow:

```ts
// src/finance/audit-derive.ts
function deriveAuditedCockpit(
  records: readonly TransactionRecord[],
  decisions: ExclusionDecision[],      // user include/exclude, keyed by signature
  settings: DashboardSettings
): AuditedCockpit
```

- Pure and synchronous, **single O(n) pass, memoized** (don't recompute untouched metrics
  on a toggle). Toggling any exclusion = re-run this function. No hidden state.
- **SINGLE SOURCE OF TRUTH (eng review issue 1, resolved: refactor).** Do NOT re-implement
  KPI math here. Instead, refactor the EXISTING math in `cockpit-kpis.ts` / `cash-health.ts`
  / `summary.ts` so each function emits its `MetricLineage` (contributing row ids + calc
  tree + assumptions) in the SAME pass that produces the number. `deriveCockpit` then becomes
  a thin reader of the audited result. There must be exactly ONE place each KPI is computed,
  or the "show the math" drawer will eventually display numbers that disagree with the
  dashboard. A test asserts drawer value === cockpit value for every metric.
- This is the ONLY place KPI math happens after this plan. Everything else renders its output.

### 3.3 The persistent workspace (the workflow / retention layer)

Net-new. Lives in `src/workspace/`.

```ts
interface Workspace {
  version: number;
  createdAt: string; updatedAt: string;
  imports: ImportSnapshot[];               // history, newest last
  rules: ClassificationRule[];             // saved, auto-applied on import
  decisions: ExclusionDecision[];          // include/exclude, keyed by txn signature
  categoryOverrides: CategoryOverride[];    // keyed by txn signature
  reviewQueue: ReviewItem[];               // unresolved items carried across imports
  settings: DashboardSettings;
}

interface ImportSnapshot {
  id: string; importedAt: string; fileName: string;
  rowCount: number;
  kpiSnapshot: Record<string, number | null>; // for the "what changed" diff
  signatureSet: string[];                       // txn signatures present in this import
}

// Stable signature so decisions/rules survive re-import of overlapping data.
// ENG REVIEW ISSUE 2 (resolved): build the signature from IMMUTABLE import fields ONLY
// — never from mutable fields like `head`/`counterparty` (the user can recategorize those,
// which would orphan saved decisions). Add an occurrence index so two genuinely identical
// rows (e.g. two $5 coffees same day) stay DISTINCT and an exclude hits only one.
function txnSignature(r: TransactionRecord, occurrenceIndex: number): string
//   = hash(dateISO + amount + rawDescription + account + sourceSheet + occurrenceIndex)
// Tests required: identical-looking rows stay distinct; signature stable across
// recategorization. (Both ★★★, in Phase D.)
```

- **Storage:** IndexedDB (primary), accessed ONLY through a thin `workspaceStore` facade so
  the UI never imports IndexedDB directly (testable + mockable + degradable). Privacy-
  compatible: never leaves the browser.
- **Degradation:** if IndexedDB is unavailable (private browsing / quota), fall back to
  in-memory + a visible warning; the `*.billu.json` export is the durable escape hatch.
- **Portability:** export/import the whole Workspace as a `*.billu.json` project file. This is
  the privacy-safe answer to "durable trust artifacts" — the user owns the file. Corrupted/
  edited files on import are rejected loudly and the current state is preserved (test required).
- **Re-import behavior:** on a new import, apply saved `rules` + `categoryOverrides` +
  `decisions` by signature automatically; surface only NEW unresolved items in the queue.
- **"What changed since last import":** diff newest `ImportSnapshot` vs previous — new rows,
  KPI deltas, newly-flagged anomalies, resolved/unresolved counts.

### 3.4 Confidence model (mechanical, not vibes)

```ts
interface ConfidenceModel {
  level: "high" | "medium" | "low";
  factors: { dataCoverageMonths: number; incomeVolatility: number;
             expenseVolatility: number; unresolvedAnomalies: number;
             futureEventDependence: number };
}
```
Forecast/runway sentences must cite the driving factor ("low confidence: only 2 months of
data, 3 unresolved anomalies").

### 3.5 Data-flow (happy + shadow paths)

```
CSV/XLSX ─▶ parse/map ─▶ TransactionRecord[] ─▶ apply workspace (rules/overrides/decisions)
                                                      │
                                                      ▼
                                        deriveAuditedCockpit(records, decisions, settings)
                                                      │
              ┌───────────────────────┬───────────────┼───────────────┬──────────────────┐
              ▼                       ▼               ▼               ▼                  ▼
        KPI value              lineage drawer    review queue     calc tree         workbook export
              │                       │               │               │                  │
   [no rows? → empty state]  [no rows for metric?  [0 items? hide  [assumption    [export with 0 rows?
   [all excluded? → 0 +       → "no contributing   badge]          missing? show   → header-only sheet +
    "all excluded" note]      rows" not blank]                     "unknown"]      "no data" note]
```

Shadow paths to test explicitly: nil/empty import, every row excluded for a metric, runway
with `cashOnHand <= 0` (already returns `null` — surface "unknown, no cash basis"), single
month of data (avg over 1 bucket → flag low confidence), re-import of identical file (no new
review items), corrupted/edited `.billu.json` on import (reject loudly, keep current state).

---

## 3.6 UI & Design Spec (design review)

Calibrated to `DESIGN.md` (soft financial cockpit, sage/cream, flat high-contrast audit
surfaces, coral = review-needed, calm trust). New surfaces map to existing tokens — no new
visual vocabulary.

### Surface decisions
- **Lineage surface = right-side slide-in panel.** Clicking a KPI slides in a panel from the
  right (the reserved utility-rail space in DESIGN.md §Layout); cockpit stays visible behind.
  It is an **audit surface**: flat, high-contrast, no glass blur, compact rows, stable columns.
  ESC / click-outside closes. On mobile (<640px) it becomes a full-screen sheet.
- **Calc tree (runway) = indented audit breakdown**, not nested JSON. Plain-English line at
  top ("Runway = cash on hand ÷ avg monthly outflow = $43k ÷ $6k = 7.2 months"), then an
  expandable indented tree: ending-cash assumption → monthly buckets (each expands to its
  rows) → average → result. Tabular numbers, Line dividers (`#d9dfcf`).
- **"Needs review" badge = calm coral chip** on the cockpit (`Coral #ee7064` text/border on a
  soft surface), NOT a full-width red alert banner. Reads "3 items to review", non-blocking,
  links to the review panel (same right-panel pattern).
- **Include/exclude + category confirm = tactile chips** per DESIGN.md §Tactile Controls
  (active = mint/sage fill + deep-green text; 120ms hover lift).
- **"What changed" = welcome-back summary strip.** On a recognized re-import, the cockpit
  leads with a calm, dismissible strip: "Since your last import (Apr 30): runway 7.2 → 5.9
  months, +4 transactions, 1 new item to review." Olive for improvements, coral for
  attention. Then the normal cockpit renders.

### Interaction state table
```
SURFACE            | LOADING            | EMPTY                         | ERROR                        | SUCCESS / PARTIAL
-------------------|--------------------|------------------------------|------------------------------|---------------------------
Lineage panel      | skeleton rows      | "No rows fed this number"    | "Could not trace this KPI"   | rows + calc tree shown
                   | (rare, local)      | (e.g. metric fully excluded) | (keep cockpit value visible) |
Needs-review badge | n/a (derived)      | hidden when 0 items          | n/a                          | "N items to review"
Review panel       | n/a                | "Nothing to review — your    | n/a                          | list + toggles; live
                   |                    | numbers look clean" (warm)   |                              | re-derive on toggle
Category review    | n/a                | hidden if no high-risk cats  | n/a                          | confirm/correct chips
Welcome-back strip | n/a                | hidden on first-ever import  | hidden if no prior snapshot  | delta summary, dismissible
Workspace / persist| "Restoring your    | first-run: normal pre-import | IndexedDB unavailable →      | silent restore
                   | workspace…" (brief)| (no workspace yet)           | in-memory + visible warning  |
Import diff        | n/a                | "First import — nothing to   | corrupted .billu.json →      | diff list
                   |                    | compare yet"                 | "Couldn't read that file"    |
```
Every empty state has warmth + context (not "No data"). The review-empty state doubles as
positive reinforcement ("your numbers look clean").

### Responsive
- Right panel → full-screen sheet <640px; cockpit KPIs reflow to 2-up then 1-up.
- Audit tables keep horizontal scroll on mobile (DESIGN.md §Audit Surfaces) — do not crush columns.
- Welcome-back strip stacks its deltas vertically on narrow screens.

### Accessibility (load-bearing for a "trust" product)
- Lineage/review panels are an ARIA disclosure/dialog: focus moves in on open, focus trap,
  ESC closes, focus returns to the triggering KPI. KPIs are real `<button>`s, not clickable divs.
- Include/exclude toggles announce state changes (aria-live polite) so a screen-reader user
  hears "Runway updated to 5.9 months" after a toggle.
- 44px min touch targets on chips/toggles. Tabular-number audit text meets WCAG AA contrast
  on panel surfaces (Ink `#14382a` on Panel `#fffef8` passes; verify coral chip text).
- The welcome-back strip is announced on render and is keyboard-dismissible.

## 4. Phased Sessions

Effort shown human / CC. Each session ends with: tests green, `/code-review` + `codex review`,
commit. Each phase ends with a `/checkpoint`.

### PHASE A — Audit foundation (no UI)

**A1. Audit model + re-derivation engine.** (~3 days / ~30 min)
- Build: `src/finance/audit.ts` (types), `src/finance/audit-derive.ts` (`deriveAuditedCockpit`).
- Capture lineage for the two archetypes: **revenue** (direct rows) and **runway** (calc tree
  with `cashOnHand` assumption). Refactor `cockpit-kpis.ts`/`cash-health.ts` to feed it
  without changing existing numeric outputs.
- Tests: golden-file lineage snapshots for the sample CSVs (`docs` samples); shadow paths
  from 3.5. Existing 212 tests must stay green.
- Exit: one sample import → `AuditedCockpit` with correct revenue rows AND a correct runway
  calc tree, fully tested. **No visible UI change yet.**

### PHASE B — Surface the math

**B1. Lineage drawer for revenue + runway.** (~3 days / ~25 min)
- Build: clickable KPI in `dashboard-cockpit.ts` opens a drawer: formula, plain-English
  sentence (with assumptions, per finding 11), direct rows table / calc tree.
- Non-blocking, escaped dynamic content, DESIGN.md tokens only.
- Tests: render tests for drawer with direct rows vs calc tree vs empty.
- Exit: clicking Revenue and Runway shows traceable, correct provenance.

**B2. Extend to all KPIs.** (~2 days / ~20 min)
- Outflow, net cash, average burn get lineage drawers. Runway calc-tree view polished.
- Exit: every cockpit KPI is clickable and traceable.

### PHASE C — Trust pass (non-blocking)

**C1. "Needs review" badge + review drawer.** (~4 days / ~30 min)
- Build: badge on the cockpit ("N items need review") sourced from
  `summary.diagnostics` (duplicates, transfers) + spike detection. Drawer lists each with
  conservative "review suggested" wording + include/exclude toggle → calls
  `deriveAuditedCockpit` → live KPI update. Decisions recorded (in-session first).
- Reuse `import-review.ts` patterns. KPIs NEVER blocked.
- Tests: toggle re-derivation golden files; confidence wording; empty queue hides badge.
- Exit: a transfer-counted-as-income can be excluded in one click and runway updates live.

**C2. Focused category review.** (~3 days / ~25 min)
- Build: surface only high-distortion categories (transfers, owner draws, taxes, refunds,
  reimbursements, loan proceeds) for quick confirm/correct. Reuse `dashboard-settings-form`
  / `import-review-form`.
- Exit: a misclassified owner draw can be recategorized and KPIs re-derive.

### PHASE D — The workflow (retention) — biggest phase

**D1. Local persistence + project file.** (~4 days / ~35 min)
- Build: `src/workspace/` — `Workspace` model, IndexedDB store, `txnSignature`. Persist
  decisions + category overrides across reloads. Export/import `*.billu.json`.
- Tests: round-trip persistence; signature stability; corrupted-file rejection (loud).
- Exit: exclude a row, reload the page, the exclusion is still there. Export → re-import → identical state.

**D2. Import history + "what changed since last import".** (~3 days / ~25 min)
- Build: `ImportSnapshot` history; a diff view (new rows, KPI deltas, new anomalies,
  resolved/unresolved). Surfaces on re-import.
- Exit: re-importing next month shows "Runway 7.2 → 5.9 months; 4 new transactions; 1 new item to review."

**D3. Saved rules + auto-apply review queue.** (~4 days / ~30 min)
- Build: `ClassificationRule` (e.g. "counterparty contains 'Stripe' → revenue"), applied
  automatically on import by signature; review queue carries only unresolved items forward.
- Exit: a rule set last import auto-classifies this import; the user only reviews genuinely new items.

### PHASE E — Accountant export (narrow first)

**E1. Workbook export v1.** (~3 days / ~25 min)
- Build: extend `downloads.ts` — workbook with THREE sheets: (1) KPI audit (value + formula +
  assumptions), (2) normalized ledger (all included rows), (3) exclusions (excluded rows +
  reason). Formulas only where stable. No anomaly sheet in v1.
- Tests: golden-file reference checks (cell references resolve, totals match cockpit).
- Exit: export opens clean; an accountant can tie every KPI to ledger rows.

### PHASE F — Make the claim true (LAST)

**F1. Forecast/runway confidence mechanics.** (~2 days / ~20 min)
- Build: `ConfidenceModel` wired into runway + 13-week forecast sentences.
- Exit: confidence is computed from real factors and explained.

**F2. Positioning rewrite + privacy-safe success signals.** (~half day / ~20 min)
- Build: rewrite README, roadmap `Positioning`, in-app copy → "auditable cash truth +
  workflow trust + speed" (drop the absolute "nobody does this"). Privacy as support.
- Success signals: local-only, no phone-home. Define qualitative ship gates instead of
  tracking users (e.g. "an accountant can verify a sample export unaided" usability check).
- Exit: the public claim matches a shipped, tested reality.

---

## 5. Test Strategy (gate, not afterthought)

- Golden-file fixtures per sample dataset: input CSV → expected `AuditedCockpit` lineage.
- Re-derivation invariants: excluding then re-including a row returns the original KPIs.
- Signature stability: same logical txn across two imports yields the same signature.
- Export reference integrity: workbook KPI cells reconcile to ledger rows.
- Shadow paths from 3.5 each get a test.
- Rule: no session may rewrite user-facing "auditable/traceable" copy until its lineage tests pass.

## 6. Review Cadence

- Per session: `/code-review` (Claude) + `codex review` on the diff; fix P1s before commit.
- Per phase: `/checkpoint` + a short `codex challenge` on the phase's core abstraction.
- Phase A's `audit-derive.ts` and Phase D's persistence are the two highest-risk abstractions —
  give them an extra adversarial pass.

## 7. Risks & open items

- **Cash-on-hand source for runway is ambiguous** (running balance vs inferred vs user-entered).
  A1 must make it an explicit, labeled `Assumption`; if no basis exists, runway shows "unknown."
- **Spike detection** does not yet exist in `diagnostics` — C1 adds it; keep it conservative.
- **IndexedDB quota / private-browsing** can fail; D1 must degrade to in-memory + warn, and the
  `.billu.json` export is the durable fallback.
- **Deferred (TODOS.md):** Budget vs Actual (P1 next cycle); expected-income forecast tagging (P2).

## 8. Out of scope (recorded)

Admin panel; invoice creation/sending; full receivables; multi-user/server; bank integrations;
AI-as-hero. See `AUDITABLE_COCKPIT_V2.md` for rationale.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | CLEAR | SCOPE_EXPANSION; 6 proposals, 4 accepted, 2 deferred |
| Outside Voice | `codex (gpt-5.5)` | Independent 2nd opinion | 1 | issues_found | 18 findings; 8 folded in, 4 decided, rest in plan |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 2 arch issues resolved, 0 critical gaps, +4 tests |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | CLEAR | score 5/10 → 9/10; 2 design forks decided + state/responsive/a11y specs folded into §3.6 |

- **CROSS-MODEL:** codex and the CEO review disagreed on (a) moat (workflow vs auditability)
  and (b) anomaly UX (non-blocking vs blocking); owner sided with codex on both. No open tension.
- **UNRESOLVED:** 0.
- **VERDICT:** CEO + ENG + DESIGN CLEARED — ready to implement. Build per §4 phasing;
  UI built per the §3.6 design spec.
