# Billu.Works Dashboard Design References

Last updated: 2026-05-08

These references are saved for the later frontend redesign pass. They are mood and direction references, not clone targets.

## Direction

Target phrase: **orbital cash cockpit**.

The primary visual north star for the June redesign pass is `design-references/orbital-cash-cockpit-concept.png`, generated from the product direction: auditable finance cockpit, functional sci-fi, no generic purple AI gloss. The earlier soft-widget direction remains useful for density and calm, but the product now needs a stronger command-deck identity.

The likely landing zone is a Billu.Works finance version of an accountant-grade spacecraft instrument panel:

- Dark graphite canvas with warm ivory readouts.
- Compact modular widgets that feel tactile, technical, and scannable.
- Thin phosphor cyan signal lines, amber caution accents, and coral review states.
- Rich chart/instrument styling only where it helps scanning and audit confidence.
- Flat, high-contrast audit surfaces for transaction tables, raw rows, mapping, and rejected rows.

See the root `DESIGN.md` for the implementation rules. This file is the reference inventory; `DESIGN.md` is the source of truth.

## Saved References

| File | Why it matters |
| --- | --- |
| `design-references/orbital-cash-cockpit-concept.png` | Current north star: auditable command-deck atmosphere, dark instrument panels, KPI/readiness/export density, practical sci-fi without AI-slop gloss. |
| `design-references/soft-widget-dashboard.png` | Primary north star: soft modular widget density, muted sage/cream palette, tactile dashboard controls, right-side action rail idea. |
| `design-references/liquid-glass-ui-kit-light.jpg` | Light liquid-glass controls, luminous edges, soft transparent card language. |
| `design-references/liquid-glass-ui-kit-dark.jpg` | Dark liquid-glass controls with stronger neon edge treatment and component states. |
| `design-references/liquid-glass-overview-dark.jpg` | Compact component showcase for buttons, cards, toggles, and tabs. |
| `design-references/liquid-glass-controls-dark-light.jpg` | High-gloss controls with strong depth; useful for accent/button inspiration only. |
| `design-references/liquid-glass-controls-light.jpg` | Cleaner light glass controls that could map to upload/export/filter chips. |
| `design-references/dark-instrument-dashboard.jpg` | Dense cockpit energy, high-contrast instrumentation, serious operator feel. |
| `design-references/light-premium-analytics-dashboard.jpg` | Calm premium analytics layout, airy panels, soft chart treatment. |

## Guardrails

- Do not turn the whole dashboard into liquid glass.
- Do not build from generic dashboard instincts; reconcile visual changes against `DESIGN.md`.
- Do not let a giant hero push the dashboard workflow out of the first viewport.
- Keep tables, audit details, mapping controls, and rejected rows highly legible.
- Use glass on a small component vocabulary: primary actions, chips, selected states, key highlight panels, and maybe a future action rail.
- Full dark cockpit is now allowed, but keep it accountant-legible: tables, inputs, exports, and audit drawers must stay high contrast.
- Preserve the privacy-first, accountant-review trust signal.

## Possible Redesign Sequence

1. Finalize feature/function surface.
2. Reconcile `src/styles.css` with `DESIGN.md` tokens: sage canvas, warm panels, olive/coral/orange/plum accents, compact widget grid.
3. Restyle existing components without changing behavior.
4. Browser QA on desktop and mobile.
5. Polish microinteractions for drilldowns, exports, mapping review, and forecast editing.
