# Claude Observations: Orbital Cash Cockpit Redesign

Date: 2026-06-18
Reviewer: Claude
Scope: the redesign slice only (`src/styles.css`, `src/ui/app-shell.ts`,
`docs/DESIGN_REFERENCES.md`, `docs/design-references/orbital-cash-cockpit-concept.png`).
Unrelated dirty-tree items (`.claude/`, `mcps/`, `.snap`, the two other docs) were not reviewed.

## Verdict

**Good enough to commit as a first visual pass — with one required fix first** (DESIGN.md
sync, see Blocking #1). The reskin is coherent, accountant-legible at desktop and mobile, and
gates are green on this exact tree (`tsc` 0, `vitest` 520, `playwright` 26, `build` green).
It reads as a serious auditable finance cockpit, not neon AI slop.

## Method

- Read the diff (`styles.css` +771, `app-shell.ts` copy, `DESIGN_REFERENCES.md`).
- Rendered the live app via Playwright (dev server on 5173 — Preview MCP was unreliable) and
  inspected screenshots of: first-run (desktop + mobile), mapping review, full dashboard
  (desktop + mobile), and the readiness audit drawer.

## 1. Blocking (fix before a clean commit)

1. **`DESIGN.md` still says the North Star is "Soft financial cockpit."**
   `CLAUDE.md` makes `DESIGN.md` the source of truth ("Always read DESIGN.md before making
   visual or UI decisions"; "In QA or review mode, flag UI code that does not match
   DESIGN.md"). The redesign flips the entire app to dark orbital but only updated
   `DESIGN_REFERENCES.md`. As-is, the canonical doc directly contradicts the shipped UI, and
   the next agent will (correctly, per its instructions) flag the whole redesign as off-spec
   and may "correct" it back toward sage/cream. `DESIGN.md`'s North Star, Color table,
   Typography, Surfaces, and Decisions Log must be updated to canonize the orbital direction
   (or the redesign explicitly marked provisional there). This is a docs/governance fix, not
   a code fix, but it gates a clean commit.

No code-level blocking defects found. Tables, mapping selects, rejected-row states, audit
drawers, and export/settings controls all stayed legible in the dark theme.

## 2. Non-blocking polish

- **Hero headline orphan.** "Auditable cash truth, line by line." wraps with "line." alone on
  the second line at desktop width. Tighten `max-width` or reword so it breaks more evenly.
- **Layout vs. the concept.** The concept is a multi-column instrument board; the shipped
  result is a single long vertical stack (expected — this is a CSS reskin, not a layout
  rebuild). This is the biggest gap from the north star and the highest-value *future*
  direction (densify into a real grid), but not a defect for this pass.
- **Fixed full-viewport overlays.** `body::before` / `body::after` paint scanline/grid layers
  with `mix-blend-mode: screen` across the whole viewport. Opacities are subtle (2–9%) and it
  looks good, but keep an eye on paint cost on low-end devices / large scroll heights; easy to
  dial back if profiling ever flags it.
- **`--color-muted` (#858b86) on panels** computes to ~4.9:1 contrast — passes AA for normal
  text but is the lowest-contrast pairing in the system. Fine as-is; just avoid using it for
  anything smaller than current body text.

## 3. CSS maintainability

- The redesign is an 826-line "Orbital cockpit visual pass" appended after ~2273 lines of the
  original light theme, overriding by cascade order. Only **4 `!important`** in the whole file
  — no specificity-war smell. The base layer still provides layout; the orbital layer mostly
  re-skins color/border/shadow, so it is a legitimate reskin rather than wholesale duplication.
- **Acceptable for this phase.** Recommended follow-up (separate slice, not this review): once
  the orbital direction is ratified, delete or fold the now-superseded light-theme color rules
  so there's a single token set and one source of truth per component. Do **not** attempt that
  consolidation inside this review — it would balloon the diff and risk regressions.

## 4. Color consistency check

Matches the stated legend in the rendered UI: cyan = signal/ready/net-cash-positive, amber =
caution/non-operating/apply, coral = review/needs-review, ivory = primary readouts. No
accidental one-note green/cyan mud observed; the amber and coral accents carry enough of the
palette to keep it from going monochrome.

## 5. Mobile ergonomics

Clean. The prior hero/action-rail overlap is fixed — first-run stacks to one column with
full-width action buttons, and the dashboard stacks KPI tiles, drawers, mapping review, and
tables without clipping at 390px. No text clipped inside buttons or inputs in the surfaces I
exercised.

## Recommended next steps

1. Update `DESIGN.md` to canonize (or explicitly mark provisional) the orbital direction — the
   one must-do before committing cleanly.
2. Commit the redesign as its own slice.
3. Backlog (separate slices): hero headline polish; CSS token/class consolidation; eventual
   multi-column instrument-board layout to close the gap with the concept.

— Claude
