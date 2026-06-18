# Design System - Billu.Works Dashboard V2

Last updated: 2026-06-18

## Product Context

- **What this is:** A privacy-first local finance dashboard for importing CSV and Excel exports, reviewing mappings, inspecting rejected rows, and producing accountant-safe summaries.
- **Who it is for:** Freelancers, founders, small agencies, and reviewers who need clarity before trusting imported transaction data.
- **Project type:** Data-heavy dashboard and import review tool.
- **Trust promise:** The interface must feel local, legible, and reviewable before it feels decorative. Sci-fi atmosphere is welcome; it must never cost accountant-legibility.

## North Star

**Orbital cash cockpit.**

The primary visual reference is the generated concept saved at `docs/design-references/orbital-cash-cockpit-concept.png`.

Core phrase:

> Functional sci-fi, accountant-legible, no purple AI slop, no white slab.

This direction is not a clone target. It is a guide for atmosphere and component behavior:

- dark graphite command-deck canvas
- warm ivory readouts as the primary data surface
- phosphor-cyan signal lines for ready/action/positive states
- amber caution states; coral review/danger states
- dense, accountant-grade instrumentation arranged like a flight deck
- quiet, readable charts with clear color coding
- the feel of a creative operator who built a serious auditable finance cockpit — not toy neon, not generic SaaS dark mode

The earlier "soft financial cockpit" (pale sage/cream) is retained only as a density and calm reference (`docs/design-references/soft-widget-dashboard.png`), not the active direction. See `docs/DESIGN_REFERENCES.md`.

## Aesthetic Direction

- **Mood:** Serious, focused, lightly sci-fi, and accountant-safe.
- **Density:** Dense but legible — a working command deck, not a marketing site.
- **Decoration level:** Intentional. Scanlines, hairline grids, and glass are allowed only when they support hierarchy and never reduce readout legibility.
- **Primary pattern:** Dark instrument panels with cyan hairline borders and ivory readouts.
- **Secondary pattern:** A vertical action rail (Local command deck) for files, projects, formulas, and review utilities.

Avoid: purple/blue AI-gloss gradients, neon-for-neon's-sake, one-note cyan/green mud, and large white slabs.

## Color

Dark graphite environment, ivory readouts, cyan as the signal anchor, amber/coral for data states. Hex values mirror the implemented tokens in `src/styles.css`.

| Token | Hex | Usage |
| --- | --- | --- |
| Canvas | `#070b0c` | Page background / deck |
| Panel | `#111915` | Main panels, forms, review cards |
| Panel soft | `#17221d` | Secondary panels and quiet sections |
| Deck raised | `#121b18` | Lifted instrument surfaces |
| Line | `#26352f` | Borders, dividers, table rules |
| Ink (ivory) | `#f5f0df` | Primary text and headings |
| Ink soft | `#c7c2ad` | Body copy and supporting labels |
| Muted | `#858b86` | Lowest-contrast supporting text (body size only) |
| Ivory readout | `#f2e7bf` | Hero/headline readouts |
| Signal (cyan) | `#5fd4c6` / `#66e3d0` | Ready/action/positive, signal lines, primary buttons |
| Amber | `#d5964e` / `#f1aa55` | Caution, non-operating, Apply states |
| Coral | `#ff7568` | Review-needed, rejected rows, danger |
| Olive | `#9fb866` | Steady/positive secondary marks |

Rules:

- Dark graphite should dominate; ivory carries the readouts.
- Cyan = signal/ready/action. Amber = caution/non-operating/apply. Coral = review/danger.
- Keep accents distinct — don't let everything collapse into one cyan/green note.
- Do not use purple-blue AI gradients or saturated marketing colors.

## Typography

The app uses a Windows-native sans stack with a mono accent for instrument labels and audit numerics.

- **Display/UI:** `Bahnschrift`, `Aptos`, `Segoe UI Variable`, `Segoe UI`, then system sans.
- **Mono/labels/audit:** `Cascadia Mono`, `IBM Plex Mono`, `Consolas` for the eyebrow, instrument labels, and narrow numeric/audit fields.
- **Numerals:** prefer tabular numbers for KPI readouts and tables.

Type rules:

- Hero-scale text only in the intro/readout area.
- Instrument labels are uppercase, small, with light letter-spacing (~0.05em).
- Tables and audit details prioritize readability over style.

## Layout

Dashboard-first, not landing-page.

- **Desktop max width:** ~`1120px` to `1280px`.
- **Grid target:** a multi-column instrument board (as in the concept). The current pass is a single-column vertical stack; densifying into a real grid is the main outstanding layout gap.
- **First viewport:** import controls and the privacy/command-deck rail visible quickly; the hero must not bury the workflow.
- **Tables:** keep transaction preview and raw audit surfaces flatter, wider, and more utilitarian than metric panels.

Suggested hierarchy after import:

1. Import/mapping command strip.
2. Readiness/trust strip + filter band.
3. Cockpit KPI readouts (primary).
4. Forecast and trend instruments.
5. Top heads, accounts, subcategories, data-quality panels.
6. Transaction preview, detail, and import-quality audit surfaces.

## Surfaces

### Instrument Panels

Use for metrics, forecast, trend, top heads, account balances, readiness.

- Background: dark panel tint (`#111915` / `#17221d`).
- Border: cyan hairline (`--color-line` with low-opacity cyan accents).
- Shadow: deep but soft; inset top highlight for a lifted glass feel.
- Radius: `8px` by default.

### Tactile Controls

Use for file upload, sample loading, filter chips, export buttons, toggles, drilldowns.

- Primary button: cyan fill / dark ink, or dark fill with cyan border + cyan text.
- Apply/caution actions may use amber.
- Active chip: cyan/amber tint with legible ink.
- Hover: small lift or stronger border, not dramatic animation.

### Audit Surfaces

Use for mapping review, transaction tables, rejected rows, raw row details.

- Keep backgrounds flatter than instrument panels.
- Preserve high contrast; do not let glass/scanline texture wash out values.
- Compact rows, clear dividers, stable columns; horizontal scroll acceptable on mobile.

## Data Visualization

- Bars rounded, slim, on quiet dark tracks.
- Revenue/positive: cyan/olive. Outflow: amber/coral. Warnings: amber/coral.
- Forecast: cumulative bars/lines with quiet tracks.
- Avoid chart chrome that competes with the import-review workflow.

## Motion

- **Approach:** Minimal-functional.
- **Use motion for:** hover lift, selected states, panel reveal, filter updates.
- **Avoid:** bouncy transitions, scroll choreography, animated decoration.
- **Durations:** `120ms` for controls, `180ms`–`240ms` for panel changes.

## Implementation Guardrails

- Read this file before making visual UI changes.
- Cyan/amber/coral/ivory legend is canonical — keep states consistent.
- The current `src/styles.css` carries an "Orbital cockpit visual pass" appended over the prior light theme. This is the active direction, but a follow-up should consolidate the superseded light-theme rules into a single token set per component.
- Preserve flat, readable audit tables; never trade legibility for flair.
- Browser-check desktop and mobile after every meaningful visual change.

## Current Fit Notes

The orbital reskin is shipped at the CSS layer across shell, hero, import/mapping, cockpit KPIs, readiness, filters, exports, settings, budget, forecast, tables, diagnostics, transaction detail, and lineage drawer. Outstanding work toward the north star:

- densify the single-column stack into a multi-column instrument board
- polish hero headline wrapping
- consolidate the dual token sets / superseded light rules

## Decisions Log

| Date | Decision | Rationale |
| --- | --- | --- |
| 2026-06-18 | Reset north star to "Orbital cash cockpit" | First full visual redesign pass (Codex) reviewed and accepted; dark graphite + ivory/cyan/amber/coral replaces the soft sage/cream direction. Concept ref: `docs/design-references/orbital-cash-cockpit-concept.png`. |
| 2026-06-18 | Keep soft-widget refs as density/calm references only | The prior soft direction still informs compactness and calm, but is no longer the active visual target. |
| 2026-06-18 | Accept the appended CSS visual pass for this phase | Reskin-by-cascade is acceptable to avoid renderer refactors now; a later slice should consolidate tokens/classes. |
| 2026-05-08 | (Superseded) Set north star to "Soft financial cockpit" | Original soft sage/cream direction; superseded 2026-06-18. |
