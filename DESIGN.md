# Design System - Billu.Works Dashboard V2

Last updated: 2026-05-08

## Product Context

- **What this is:** A privacy-first local finance dashboard for importing CSV and Excel exports, reviewing mappings, inspecting rejected rows, and producing accountant-safe summaries.
- **Who it is for:** Freelancers, founders, small agencies, and reviewers who need clarity before trusting imported transaction data.
- **Project type:** Data-heavy dashboard and import review tool.
- **Trust promise:** The interface must feel calm, local, legible, and reviewable before it feels decorative.

## North Star

**Soft financial cockpit.**

The primary visual reference is the soft widget dashboard saved at `docs/design-references/soft-widget-dashboard.png` and mirrored by the screenshot at `C:/Users/Bilal/Pictures/Screenshots/Screenshot 2026-04-29 220712.png`.

This direction is not a clone target. It is a guide for atmosphere and component behavior:

- pale sage and cream workspace
- compact modular widgets
- tactile controls that feel pressable
- soft lifted surfaces with gentle shadows
- sparse coral, muted orange, olive, and plum accents
- dashboard information arranged like an instrument board
- visual charts that are quiet, readable, and scannable

## Aesthetic Direction

- **Mood:** Calm, focused, lightly tactile, and accountant-safe.
- **Density:** Compact but not cramped. The page should feel like a working dashboard, not a marketing site.
- **Decoration level:** Intentional. Texture and glass are allowed only when they help hierarchy.
- **Primary pattern:** Modular widgets on a soft sage canvas.
- **Secondary pattern:** A future vertical action rail for formulas, exports, settings, and review utilities.

Avoid the generic "premium SaaS analytics" look: large hero-first pages, oversized cards, one-note dark green, and broad glass panels everywhere.

## Color

Use a restrained palette with sage as the environment, deep green as the trust anchor, and warm accents for data states.

| Token | Hex | Usage |
| --- | --- | --- |
| Canvas | `#eef3e9` | Page background and dashboard workspace |
| Panel | `#fffef8` | Main widgets, forms, and review cards |
| Panel soft | `#f7f8ef` | Secondary widgets and quiet sections |
| Ink | `#14382a` | Primary text and headings |
| Ink soft | `#52635a` | Body copy and supporting labels |
| Line | `#d9dfcf` | Borders, dividers, table rules |
| Olive | `#899a3f` | Positive bars, selected states, steady health |
| Coral | `#ee7064` | Alerts, rejected rows, negative or review-needed signals |
| Orange | `#f0a24f` | Warning accents and pending states |
| Plum | `#7b3d67` | Rare secondary accent for special categories |
| Mint | `#dfeee4` | Revenue pills and positive chips |
| Peach | `#f4ded1` | Outflow pills and light warning surfaces |

Rules:

- Sage/cream should dominate the page.
- Deep green should carry trust and primary actions.
- Accents should appear in small data elements, chart marks, warning blocks, and selected states.
- Do not use purple-blue gradients, neon dark mode, or saturated marketing colors.

## Typography

The current app uses an Inter fallback stack. The design direction should move toward a less generic system when the visual redesign starts.

- **Display:** `Satoshi` or `General Sans` - strong, modern, softer than default system UI.
- **Body/UI:** `DM Sans` or `Geist` - readable at compact dashboard sizes.
- **Data/Tables:** `Geist` with tabular numbers, or `IBM Plex Mono` for narrow numeric/audit fields.
- **Fallback:** Existing system stack is acceptable until fonts are deliberately installed.

Type rules:

- Use hero-scale text only in the intro area.
- Widget headings should be compact, usually `0.9rem` to `1rem`.
- Labels should be uppercase, small, and spaced by color/weight rather than letter-spacing tricks.
- Tables and audit details must prioritize readability over style.

## Layout

Use a dashboard-first layout, not a landing page layout.

- **Desktop max width:** around `1120px` to `1240px`.
- **Grid:** modular widget grid with mixed spans, similar to the reference board.
- **First viewport:** the import controls and privacy promise should be visible quickly. Do not let a giant hero push the product out of view.
- **Cards:** use cards only for widgets, repeated panels, and review surfaces. Avoid cards inside cards.
- **Right rail:** reserve room conceptually for a future utility rail with icons/actions.
- **Tables:** keep transaction preview and raw audit surfaces flatter, wider, and more utilitarian than metric widgets.

Suggested dashboard hierarchy after import:

1. Import/mapping command strip.
2. Filter and review-preset control band.
3. Compact KPI widgets.
4. Forecast and trend widgets.
5. Top heads, accounts, subcategories, and data quality widgets.
6. Transaction preview, transaction detail, and import quality audit surfaces.

## Surfaces

### Soft Widgets

Use for metrics, forecast, trend, top heads, account balances, and warning summaries.

- Background: warm white or soft panel tint.
- Border: subtle sage line.
- Shadow: soft lift, never heavy.
- Radius: `8px` by default.
- Internal spacing: compact and deliberate.

### Tactile Controls

Use for file upload, sample loading, filter chips, export buttons, toggles, and selected drilldowns.

- Primary button: deep green fill with white text.
- Secondary button: panel background with deep green border.
- Active chip: mint/sage fill with deep green text.
- Disabled chip: low contrast, clearly inactive.
- Hover: small lift or stronger border, not dramatic animation.

### Audit Surfaces

Use for mapping review, transaction table, rejected rows, and raw row details.

- Keep backgrounds flatter.
- Avoid glass blur.
- Preserve high contrast.
- Make horizontal scrolling acceptable for transaction tables on mobile.
- Use compact rows, clear dividers, and stable columns.

## Data Visualization

The reference uses small, friendly charts with minimal axes and clear color coding. Billu.Works should do the same.

- Bars should be rounded, slim, and muted.
- Revenue: olive/deep green.
- Outflow: coral/orange.
- Warnings: peach/coral.
- Forecast: cumulative bars with quiet tracks.
- Avoid chart chrome that competes with the import-review workflow.

## Motion

- **Approach:** Minimal-functional.
- **Use motion for:** hover lift, selected states, panel reveal, filter updates.
- **Avoid:** bouncy transitions, complex scroll choreography, or animated decoration.
- **Durations:** `120ms` for controls, `180ms` to `240ms` for panel changes.

## Implementation Guardrails

- Read this file before making visual UI changes.
- Do not build dashboard UI blindly from generic dashboard instincts.
- Use `docs/DESIGN_REFERENCES.md` for source references and this file for rules.
- Treat `src/styles.css` as provisional until it is reconciled with this design system.
- Keep pet/mascot assets out of dashboard design unless explicitly requested.
- Browser-check desktop and mobile after every meaningful visual change.

## Current Fit Notes

The app already has strong functional surfaces: mapping review, filters, exports, forecast, diagnostics, transaction preview, and import quality. The next visual pass should keep those behaviors and restyle the shell toward the soft widget board:

- reduce oversized hero dominance
- make import controls feel like a command strip
- introduce a more modular widget grid
- use tactile chips/toggles/buttons
- preserve flat, readable audit tables
- consider a right-side utility rail later

## Decisions Log

| Date | Decision | Rationale |
| --- | --- | --- |
| 2026-05-08 | Set north star to "Soft financial cockpit" | User confirmed the soft widget screenshot and May 5 notes are the reference guide for future UI work. |
| 2026-05-08 | Keep liquid/glass as an accent only | The product needs accountant-safe readability, so glass should support controls and selected states rather than cover audit surfaces. |
| 2026-05-08 | Treat current CSS pass as provisional | The previous pass was useful but not grounded tightly enough in the screenshot reference. |
